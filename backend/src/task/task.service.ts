import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthUser } from '../auth/auth-types.js';
import { OwnerPolicy } from '../auth/owner.policy.js';
import { type CreateTaskDto } from './dto/create-task.dto.js';
import { type UpdateTaskDto } from './dto/update-task.dto.js';
import { TaskGateway } from './task.gateway.js';

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly gateway: TaskGateway,
  ) {}

  create(createTaskDto: CreateTaskDto, user: AuthUser) {
    return this.prisma.task.create({
      data: { ...createTaskDto, userId: user.id, updatedAt: new Date() },
    });
  }

  async findAll(user: AuthUser) {
    const all = await this.authorization.can(OwnerPolicy, 'viewAll', user);
    return this.prisma.task.findMany({
      where: all ? {} : { userId: user.id },
      orderBy: { id: 'asc' },
    });
  }

  /** The task if the user may access it; 404 otherwise, so ids don't leak. */
  async findOne(id: number, user: AuthUser) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (
      !task ||
      !(await this.authorization.can(OwnerPolicy, 'owns', user, task))
    ) {
      throw new NotFoundException(`Task ${id} not found`);
    }
    return task;
  }

  async update(id: number, updateTaskDto: UpdateTaskDto, user: AuthUser) {
    await this.findOne(id, user);
    return this.prisma.task.update({
      where: { id },
      data: { ...updateTaskDto, updatedAt: new Date() },
    });
  }

  /** Idempotent: completing a done task keeps its original completion time. */
  async complete(id: number, user: AuthUser) {
    const task = await this.findOne(id, user);
    return task.completedAt ? task : this.setCompletedAt(id, new Date());
  }

  async uncomplete(id: number, user: AuthUser) {
    const task = await this.findOne(id, user);
    return task.completedAt ? this.setCompletedAt(id, null) : task;
  }

  async remove(id: number, user: AuthUser) {
    await this.findOne(id, user);
    return this.prisma.task.delete({ where: { id } });
  }

  private async setCompletedAt(id: number, completedAt: Date | null) {
    const task = await this.prisma.task.update({
      where: { id },
      data: { completedAt, updatedAt: new Date() },
    });
    await this.gateway.taskStatusChanged(task);
    return task;
  }
}
