import {
  BadRequestException,
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
  ) {}

  async create(createTasklistDto: CreateTasklistDto, user: AuthUser) {
    const list = await this.prisma.taskList.create({
      data: { ...createTasklistDto, userId: user.id, updatedAt: new Date() },
    });
    await this.gateway.tasklistUpdated(list.id);
    return list;
  }

  async findAll(user: AuthUser) {
    const all = await this.authorization.can(OwnerPolicy, 'viewAll', user);
    return this.prisma.taskList.findMany({
      where: all ? {} : { userId: user.id },
      orderBy: { id: 'asc' },
    });
  }

  /** The list with its tasks if the user may access it; 404 otherwise. */
  async findOne(id: number, user: AuthUser) {
    const list = await this.prisma.taskList.findUnique({
      where: { id },
      include: { Task: { orderBy: { id: 'asc' } } },
    });
    if (
      !list ||
      !(await this.authorization.can(OwnerPolicy, 'owns', user, list))
    ) {
      throw new NotFoundException(`Task list ${id} not found`);
    }
    return list;
  }

  /** Like findOne, but only the owner may change a list: admins can only view it. */
  private async findOwned(id: number, user: AuthUser) {
    const list = await this.findOne(id, user);
    if (list.userId !== user.id) {
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

  /** Its tasks stay, outside any list (onDelete: SetNull). */
  async remove(id: number, user: AuthUser) {
    await this.findOwned(id, user);
    const list = await this.prisma.taskList.delete({ where: { id } });
    this.gateway.tasklistDeleted(list.id, [list.userId]);
    return list;
  }

  /** Puts one task in this list, moving it out of any other list. */
  async addTask(id: number, taskId: number, user: AuthUser) {
    const list = await this.findOwned(id, user);
    const task = await this.taskService.findOne(taskId, user);
    // An admin can reach both, but a list only holds its owner's tasks.
    if (task.userId !== list.userId) {
      throw new BadRequestException(
        'The task and the list have different owners',
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
    const task = await this.taskService.findOne(taskId, user);
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
