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

  async create(createTaskDto: CreateTaskDto, user: AuthUser) {
    const task = await this.prisma.task.create({
      data: { ...createTaskDto, userId: user.id, updatedAt: new Date() },
    });
    await this.gateway.taskChanged('task.created', task);
    return task;
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

  /** `completed: true` stamps completedAt with the server's time, keeping an earlier one; false clears it. */
  async update(
    id: number,
    { completed, ...fields }: UpdateTaskDto,
    user: AuthUser,
  ) {
    const existing = await this.findOne(id, user);
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
    return task;
  }

  async remove(id: number, user: AuthUser) {
    await this.findOne(id, user);
    const task = await this.prisma.task.delete({ where: { id } });
    await this.gateway.taskChanged('task.deleted', task);
    return task;
  }
}
