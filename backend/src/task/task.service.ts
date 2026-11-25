import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthUser } from '../auth/auth-types.js';
import { OwnerPolicy } from '../auth/owner.policy.js';
import { NotificationService } from '../notification/notification.service.js';
import { actorName } from '../notification/notification.types.js';
import { type CreateTaskDto } from './dto/create-task.dto.js';
import { type UpdateTaskDto } from './dto/update-task.dto.js';
import { TaskGateway } from './task.gateway.js';
import {
  acceptedMembers,
  type ListWithMembers,
  listRole,
  listUserIds,
} from './list-role.js';

export type TaskRole = 'owner' | 'member' | 'creator' | 'admin';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly gateway: TaskGateway,
    private readonly notifications: NotificationService,
  ) {}

  async create(createTaskDto: CreateTaskDto, user: AuthUser) {
    const task = await this.prisma.task.create({
      data: { ...createTaskDto, userId: user.id, updatedAt: new Date() },
    });
    await this.gateway.taskChanged('task.created', task);
    return task;
  }

  /** Every task: admins only. */
  async findAll(user: AuthUser) {
    if (!(await this.authorization.can(OwnerPolicy, 'viewAll', user))) {
      throw new ForbiddenException();
    }
    return this.prisma.task.findMany({ orderBy: { id: 'asc' } });
  }

  /** The caller's tasks in no list. */
  findInbox(user: AuthUser) {
    return this.prisma.task.findMany({
      where: { userId: user.id, taskListId: null },
      orderBy: { id: 'asc' },
    });
  }

  /**
   * The task with the caller's role on it: its creator while in no list,
   * else its list's owner or accepted members; admins see all.
   * 404 otherwise, so ids don't leak.
   */
  async findAccessible(id: number, user: AuthUser) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { TaskList: { include: acceptedMembers } },
    });
    if (task) {
      const creator = task.userId === user.id ? 'creator' : null;
      let role: TaskRole | null = task.TaskList
        ? listRole(task.TaskList, user.id)
        : creator;
      // An admin who joined the list keeps admin rights over its tasks.
      if (
        (!role || role === 'member') &&
        (await this.authorization.can(OwnerPolicy, 'viewAll', user))
      )
        role = 'admin';
      if (role) return { task, role };
    }
    throw new NotFoundException(`Task ${id} not found`);
  }

  async findOne(id: number, user: AuthUser) {
    const {
      task: { TaskList: _list, ...task },
    } = await this.findAccessible(id, user);
    return task;
  }

  /** `completed: true` stamps completedAt with the server's time, keeping an earlier one; false clears it. */
  async update(id: number, dto: UpdateTaskDto, user: AuthUser) {
    const { task: existing, role } = await this.findAccessible(id, user);
    // A member's body must be exactly `{ completed }`.
    const keys = Object.keys(dto);
    if (role === 'member' && (keys.length !== 1 || keys[0] !== 'completed')) {
      throw new ForbiddenException('List members can only complete tasks');
    }
    const { completed, ...fields } = dto;
    const now = new Date();
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        ...fields,
        ...(completed !== undefined && {
          completedAt: completed ? (existing.completedAt ?? now) : null,
        }),
        updatedAt: now,
      },
    });
    await this.gateway.taskChanged('task.updated', task);
    if (completed && !existing.completedAt && existing.TaskList) {
      await this.notifyCompleted(existing.TaskList, task, user);
    }
    return task;
  }

  async remove(id: number, user: AuthUser) {
    const { role } = await this.findAccessible(id, user);
    if (role === 'member') {
      throw new ForbiddenException('List members cannot delete tasks');
    }
    const task = await this.prisma.task.delete({ where: { id } });
    await this.gateway.taskChanged('task.deleted', task);
    return task;
  }

  /** TASK_COMPLETED for the list's other users; never fails the update. */
  private async notifyCompleted(
    list: ListWithMembers & { id: number; title: string },
    task: { id: number; title: string },
    user: AuthUser,
  ) {
    // Only shared lists: an outside admin completing in a solo list notifies no one.
    if (!list.TaskListMember.length) return;
    const userIds = listUserIds(list).filter((id) => id !== user.id);
    try {
      const rows = await this.notifications.create(userIds, {
        type: 'TASK_COMPLETED',
        data: {
          taskListId: list.id,
          listTitle: list.title,
          taskId: task.id,
          taskTitle: task.title,
          actorId: user.id,
          actorName: actorName(user),
        },
      });
      this.gateway.notificationsCreated(rows);
    } catch (error) {
      this.logger.error(`TASK_COMPLETED for task ${task.id} not sent`, error);
    }
  }
}
