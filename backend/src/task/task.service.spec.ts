import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuthorizationModule } from '@nestjs/authorization';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthUser } from '../auth/auth-types.js';
import { OwnerPolicy } from '../auth/owner.policy.js';
import { TaskService } from './task.service.js';
import { TaskGateway } from './task.gateway.js';

const owner: AuthUser = { id: 1, email: 'o@x.io', name: null, role: 'USER' };
const other: AuthUser = { id: 3, email: 'p@x.io', name: null, role: 'USER' };
const doneAt = new Date('2026-01-01T00:00:00Z');
// Task 1 is open, task 2 is done; both belong to user 1.
const tasks: Record<number, object> = {
  1: { id: 1, userId: 1, completedAt: null },
  2: { id: 2, userId: 1, completedAt: doneAt },
};

describe('TaskService', () => {
  const prisma = {
    task: {
      findUnique: vi.fn(({ where }) =>
        Promise.resolve(tasks[where.id] ?? null),
      ),
      update: vi.fn(({ where, data }) =>
        Promise.resolve({ ...tasks[where.id], ...data }),
      ),
    },
  };
  const gateway = { taskStatusChanged: vi.fn() };
  let service: TaskService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthorizationModule.forRoot({
          globalGuard: false,
          policies: [OwnerPolicy],
        }),
      ],
      providers: [
        TaskService,
        { provide: PrismaService, useValue: prisma },
        { provide: TaskGateway, useValue: gateway },
      ],
    }).compile();
    service = moduleRef.get(TaskService);
  });

  it('completes an open task with the server’s time', async () => {
    const before = Date.now();
    const task = (await service.complete(1, owner)) as { completedAt: Date };
    expect(task.completedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(gateway.taskStatusChanged).toHaveBeenCalledWith(task);
  });

  it('keeps the original time when completing a done task again', async () => {
    await expect(service.complete(2, owner)).resolves.toMatchObject({
      completedAt: doneAt,
    });
    expect(prisma.task.update).not.toHaveBeenCalled();
    expect(gateway.taskStatusChanged).not.toHaveBeenCalled();
  });

  it('reopens a done task, and leaves an open one alone', async () => {
    await expect(service.uncomplete(2, owner)).resolves.toMatchObject({
      completedAt: null,
    });
    await service.uncomplete(1, owner);
    expect(prisma.task.update).toHaveBeenCalledTimes(1);
    expect(gateway.taskStatusChanged).toHaveBeenCalledTimes(1);
  });

  it('404s on someone else’s task', async () => {
    await expect(service.complete(1, other)).rejects.toThrow(NotFoundException);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});
