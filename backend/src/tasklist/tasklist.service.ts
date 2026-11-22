import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthUser } from '../auth/auth-types.js';
import { OwnerPolicy } from '../auth/owner.policy.js';
import { TaskService } from '../task/task.service.js';
import { type CreateTasklistDto } from './dto/create-tasklist.dto.js';
import { type UpdateTasklistDto } from './dto/update-tasklist.dto.js';

@Injectable()
export class TasklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly taskService: TaskService,
  ) {}

  create(createTasklistDto: CreateTasklistDto, user: AuthUser) {
    return this.prisma.taskList.create({
      data: { ...createTasklistDto, userId: user.id, updatedAt: new Date() },
    });
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

  async update(
    id: number,
    updateTasklistDto: UpdateTasklistDto,
    user: AuthUser,
  ) {
    await this.findOne(id, user);
    return this.prisma.taskList.update({
      where: { id },
      data: { ...updateTasklistDto, updatedAt: new Date() },
    });
  }

  /** Its tasks stay, outside any list (onDelete: SetNull). */
  async remove(id: number, user: AuthUser) {
    await this.findOne(id, user);
    return this.prisma.taskList.delete({ where: { id } });
  }

  /** Puts one task in this list, moving it out of any other list. */
  async addTask(id: number, taskId: number, user: AuthUser) {
    const list = await this.findOne(id, user);
    const task = await this.taskService.findOne(taskId, user);
    // An admin can reach both, but a list only holds its owner's tasks.
    if (task.userId !== list.userId) {
      throw new BadRequestException(
        'The task and the list have different owners',
      );
    }
    return this.moveTask(taskId, id);
  }

  async removeTask(id: number, taskId: number, user: AuthUser) {
    await this.findOne(id, user);
    const task = await this.taskService.findOne(taskId, user);
    if (task.taskListId !== id) {
      throw new NotFoundException(`Task ${taskId} is not in task list ${id}`);
    }
    return this.moveTask(taskId, null);
  }

  private moveTask(taskId: number, taskListId: number | null) {
    return this.prisma.task.update({
      where: { id: taskId },
      data: { taskListId, updatedAt: new Date() },
    });
  }
}
