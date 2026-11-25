import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthUser } from '../auth/auth-types.js';
import { OwnerPolicy } from '../auth/owner.policy.js';
import { TaskService } from '../task/task.service.js';
import { TaskGateway } from '../task/task.gateway.js';
import { NotificationService } from '../notification/notification.service.js';
import { acceptedMembers, listRole, listUserIds } from '../task/list-role.js';
import { type CreateTasklistDto } from './dto/create-tasklist.dto.js';
import { type UpdateTasklistDto } from './dto/update-tasklist.dto.js';

/** Completed tasks count too. */
export const MAX_TASKS_PER_LIST = 50;

@Injectable()
export class TasklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly taskService: TaskService,
    private readonly gateway: TaskGateway,
    private readonly notifications: NotificationService,
  ) {}

  async create(createTasklistDto: CreateTasklistDto, user: AuthUser) {
    const list = await this.prisma.taskList.create({
      data: { ...createTasklistDto, userId: user.id, updatedAt: new Date() },
    });
    await this.gateway.tasklistUpdated(list.id);
    return list;
  }

  /** The user's own and joined lists (all for an admin), with their role. */
  async findAll(user: AuthUser, includeTasks: boolean) {
    const all = await this.authorization.can(OwnerPolicy, 'viewAll', user);
    const lists = await this.prisma.taskList.findMany({
      where: all
        ? {}
        : {
            OR: [
              { userId: user.id },
              {
                TaskListMember: {
                  some: { userId: user.id, acceptedAt: { not: null } },
                },
              },
            ],
          },
      include: {
        ...acceptedMembers,
        Task: includeTasks && { orderBy: { id: 'asc' } },
      },
      orderBy: { id: 'asc' },
    });
    return lists.map(({ TaskListMember, ...list }) => ({
      ...list,
      role: listRole({ userId: list.userId, TaskListMember }, user.id),
    }));
  }

  /**
   * The list with its tasks and the caller's role (null for an admin who
   * neither owns nor joined it); 404 for anyone else, pending invitees included.
   */
  async findOne(id: number, user: AuthUser) {
    const list = await this.prisma.taskList.findUnique({
      where: { id },
      include: { ...acceptedMembers, Task: { orderBy: { id: 'asc' } } },
    });
    if (list) {
      const { TaskListMember: _members, ...rest } = list;
      const role = listRole(list, user.id);
      if (role || (await this.authorization.can(OwnerPolicy, 'viewAll', user)))
        return { ...rest, role };
    }
    throw new NotFoundException(`Task list ${id} not found`);
  }

  /** Like findOne, but only the owner may change a list: admins can only view it. */
  private async findOwned(id: number, user: AuthUser) {
    const list = await this.findOne(id, user);
    if (list.role !== 'owner') {
      throw new ForbiddenException(`Only the owner can change task list ${id}`);
    }
    return list;
  }

  async update(
    id: number,
    updateTasklistDto: UpdateTasklistDto,
    user: AuthUser,
  ) {
    await this.findOwned(id, user);
    const list = await this.prisma.taskList.update({
      where: { id },
      data: { ...updateTasklistDto, updatedAt: new Date() },
    });
    await this.gateway.tasklistUpdated(id);
    return list;
  }

  /**
   * The owner's tasks go back to their Inbox (onDelete: SetNull); tasks anyone
   * else created are deleted, and members and invites cascade.
   */
  async remove(id: number, user: AuthUser) {
    const { Task: tasks, userId: ownerId } = await this.findOwned(id, user);
    const members = await this.prisma.taskListMember.findMany({
      where: { taskListId: id, acceptedAt: { not: null } },
      select: { userId: true },
    });
    const list = await this.prisma.$transaction(async (tx) => {
      await tx.task.deleteMany({
        where: { taskListId: id, NOT: { userId: ownerId } },
      });
      await this.notifications.deleteForList(id, tx);
      return tx.taskList.delete({ where: { id } });
    });
    this.gateway.tasklistDeleted(
      id,
      listUserIds({ userId: ownerId, TaskListMember: members }),
    );
    for (const task of tasks.filter((t) => t.userId === ownerId)) {
      await this.gateway.taskChanged('task.updated', {
        ...task,
        taskListId: null,
      });
    }
    return list;
  }

  /**
   * Puts one task in this list (owner or member), moving it out of the
   * caller's Inbox or out of another list the caller owns.
   */
  async addTask(id: number, taskId: number, user: AuthUser) {
    const { role } = await this.findOne(id, user);
    if (!role) {
      throw new ForbiddenException(
        `Only list users can add to task list ${id}`,
      );
    }
    const { task } = await this.taskService.findAccessible(taskId, user);
    const fromInbox = task.TaskList === null && task.userId === user.id;
    // A list-to-list move needs both lists owned by the caller.
    const fromOwned =
      task.TaskList !== null &&
      listRole(task.TaskList, user.id) === 'owner' &&
      role === 'owner';
    if (!fromInbox && !fromOwned) {
      throw new ForbiddenException(
        `Only the owner can move task ${taskId} out of its list`,
      );
    }
    const moved = await this.prisma.$transaction(async (tx) => {
      // Locks the list row, so two concurrent adds can't both pass the count.
      await tx.$queryRaw`SELECT 1 FROM "TaskList" WHERE id = ${id} FOR UPDATE`;
      // The others, counted under the lock: whether this task is in the list
      // was read before it, and may have changed since.
      if (
        (await tx.task.count({
          where: { taskListId: id, NOT: { id: taskId } },
        })) >= MAX_TASKS_PER_LIST
      ) {
        throw new ConflictException(
          `Task list ${id} already has ${MAX_TASKS_PER_LIST} tasks`,
        );
      }
      return tx.task.update({
        where: { id: taskId },
        data: { taskListId: id, updatedAt: new Date() },
      });
    });
    await this.gateway.tasklistUpdated(id);
    // The list it came from changed too.
    if (task.taskListId !== null && task.taskListId !== id) {
      await this.gateway.tasklistUpdated(task.taskListId);
    }
    return moved;
  }

  async removeTask(id: number, taskId: number, user: AuthUser) {
    await this.findOwned(id, user);
    // findAccessible, not findOne: a member-created task must be found too.
    const { task } = await this.taskService.findAccessible(taskId, user);
    if (task.taskListId !== id) {
      throw new NotFoundException(`Task ${taskId} is not in task list ${id}`);
    }
    const moved = await this.prisma.task.update({
      where: { id: taskId },
      data: { taskListId: null, updatedAt: new Date() },
    });
    await this.gateway.tasklistUpdated(id);
    return moved;
  }
}
