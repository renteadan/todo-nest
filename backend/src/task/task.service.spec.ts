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
      create: vi.fn(({ data }) => Promise.resolve({ id: 9, ...data })),
      delete: vi.fn(({ where }) => Promise.resolve(tasks[where.id])),
    },
  };
  const gateway = { taskChanged: vi.fn() };
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

  it('completes a task with the server’s time, and reopens it', async () => {
    const before = Date.now();
    const done = (await service.update(1, { completed: true }, owner)) as {
      completedAt: Date;
    };
    expect(done.completedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(prisma.task.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ completed: expect.anything() }),
      }),
    );
    await expect(
      service.update(2, { completed: false }, owner),
    ).resolves.toMatchObject({ completedAt: null });
    expect(gateway.taskChanged).toHaveBeenCalledWith('task.updated', done);
  });

  it('keeps the first completion time when completing a done task again', async () => {
    await expect(
      service.update(2, { completed: true }, owner),
    ).resolves.toMatchObject({ completedAt: doneAt });
  });

  it('leaves completedAt alone when `completed` is not sent', async () => {
    await expect(
      service.update(2, { title: 'Renamed' }, owner),
    ).resolves.toMatchObject({ completedAt: doneAt });
  });

  it('tells the task’s users it was created, updated or deleted', async () => {
    const created = await service.create({ title: 'New' } as never, owner);
    const updated = await service.update(1, { title: 'Renamed' }, owner);
    const deleted = await service.remove(1, owner);
    expect(gateway.taskChanged.mock.calls).toEqual([
      ['task.created', created],
      ['task.updated', updated],
      ['task.deleted', deleted],
    ]);
  });

  it('404s on someone else’s task', async () => {
    await expect(service.update(1, { completed: true }, other)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});
