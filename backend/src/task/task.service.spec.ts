import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthorizationModule } from '@nestjs/authorization';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthUser } from '../auth/auth-types.js';
import { OwnerPolicy } from '../auth/owner.policy.js';
import { NotificationService } from '../notification/notification.service.js';
import { TaskService } from './task.service.js';
import { TaskGateway } from './task.gateway.js';

const owner: AuthUser = { id: 1, email: 'o@x.io', name: null, role: 'USER' };
const other: AuthUser = { id: 3, email: 'p@x.io', name: null, role: 'USER' };
const admin: AuthUser = { id: 2, email: 'a@x.io', name: null, role: 'ADMIN' };
const member: AuthUser = { id: 5, email: 'm@x.io', name: 'Mia', role: 'USER' };
const invitee: AuthUser = { id: 7, email: 'i@x.io', name: null, role: 'USER' };
const doneAt = new Date('2026-01-01T00:00:00Z');
// Tasks 1 (open) and 2 (done) are user 1's, in no list. List 10 is user 1's,
// with members 5 and 6 and a pending invite for 7; member 5 created its
// tasks 21 (open) and 22 (done). List 11 is user 1's alone, with task 31.
const tasks: Record<number, Record<string, unknown>> = {
  1: { id: 1, userId: 1, taskListId: null, completedAt: null },
  2: { id: 2, userId: 1, taskListId: null, completedAt: doneAt },
  21: { id: 21, userId: 5, taskListId: 10, title: 'Milk', completedAt: null },
  22: { id: 22, userId: 5, taskListId: 10, title: 'Eggs', completedAt: doneAt },
  31: { id: 31, userId: 1, taskListId: 11, title: 'Solo', completedAt: null },
};
const lists: Record<number, Record<string, unknown>> = {
  10: { id: 10, userId: 1, title: 'Groceries' },
  11: { id: 11, userId: 1, title: 'Mine' },
};
const memberRows: Record<
  number,
  { userId: number; acceptedAt: Date | null }[]
> = {
  10: [
    { userId: 5, acceptedAt: doneAt },
    { userId: 6, acceptedAt: doneAt },
    { userId: 7, acceptedAt: null },
  ],
  11: [],
};

type FindArgs = {
  where: { id: number };
  include?: {
    TaskList?: {
      include?: { TaskListMember?: { where?: { acceptedAt?: unknown } } };
    };
  };
};

/** Mimics `include: { TaskList: { include: { TaskListMember: { where } } } }`. */
function findTask({ where, include }: FindArgs) {
  const task = tasks[where.id];
  if (!task) return Promise.resolve(null);
  if (!include?.TaskList) return Promise.resolve(task);
  const listId = task.taskListId as number | null;
  const acceptedOnly =
    include.TaskList.include?.TaskListMember?.where?.acceptedAt !== undefined;
  const TaskList =
    listId === null
      ? null
      : {
          ...lists[listId],
          TaskListMember: memberRows[listId]
            .filter((m) => !acceptedOnly || m.acceptedAt)
            .map(({ userId }) => ({ userId })),
        };
  return Promise.resolve({ ...task, TaskList });
}

describe('TaskService', () => {
  const prisma = {
    task: {
      findUnique: vi.fn(findTask),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(({ where, data }) =>
        Promise.resolve({ ...tasks[where.id], ...data }),
      ),
      create: vi.fn(({ data }) => Promise.resolve({ id: 9, ...data })),
      delete: vi.fn(({ where }) => Promise.resolve(tasks[where.id])),
    },
  };
  const gateway = { taskChanged: vi.fn(), notificationsCreated: vi.fn() };
  const rows = [{ id: 1, userId: 1 }];
  const notifications = { create: vi.fn() };
  let service: TaskService;

  beforeEach(async () => {
    vi.clearAllMocks();
    notifications.create.mockResolvedValue(rows);
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
        { provide: NotificationService, useValue: notifications },
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

  it('lists every task for an admin only', async () => {
    await expect(service.findAll(owner)).rejects.toThrow(ForbiddenException);
    await service.findAll(admin);
    expect(prisma.task.findMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
    });
  });

  it('lists the inbox: the caller’s tasks in no list', async () => {
    await service.findInbox(owner);
    expect(prisma.task.findMany).toHaveBeenCalledWith({
      where: { userId: 1, taskListId: null },
      orderBy: { id: 'asc' },
    });
  });

  it('shows a list’s task to its owner, members and admins only', async () => {
    for (const user of [owner, member, admin]) {
      const task = await service.findOne(21, user);
      expect(task).toMatchObject({ id: 21 });
      expect(task).not.toHaveProperty('TaskList');
    }
    // A pending invite (no acceptedAt) gives no access yet.
    for (const user of [other, invitee]) {
      await expect(service.findOne(21, user)).rejects.toThrow(
        NotFoundException,
      );
    }
  });

  it('lets a member only complete or reopen a list’s tasks', async () => {
    await expect(
      service.update(21, { completed: true }, member),
    ).resolves.toMatchObject({ id: 21 });
    await expect(service.update(21, { title: 'x' }, member)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.update(21, { completed: true, title: 'x' }, member),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.remove(21, member)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.task.update).toHaveBeenCalledTimes(1);
    expect(prisma.task.delete).not.toHaveBeenCalled();
  });

  it('lets the list owner edit and delete a member’s task', async () => {
    await expect(
      service.update(21, { title: 'Oat milk' }, owner),
    ).resolves.toMatchObject({ title: 'Oat milk' });
    await expect(service.remove(21, owner)).resolves.toMatchObject({ id: 21 });
    expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 21 } });
  });

  it('lets an admin outside the list edit and delete its task', async () => {
    await expect(
      service.update(31, { title: 'Admin edit' }, admin),
    ).resolves.toMatchObject({ title: 'Admin edit' });
    await expect(service.remove(31, admin)).resolves.toMatchObject({ id: 31 });
    expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 31 } });
  });

  it('keeps admin rights for an admin who joined the list', async () => {
    memberRows[10].push({ userId: admin.id, acceptedAt: doneAt });
    try {
      await expect(
        service.update(21, { title: 'Admin edit' }, admin),
      ).resolves.toMatchObject({ title: 'Admin edit' });
      await expect(service.remove(21, admin)).resolves.toMatchObject({
        id: 21,
      });
    } finally {
      memberRows[10].pop();
    }
  });

  it('tells the list’s other users when a task gets completed', async () => {
    await service.update(21, { completed: true }, member);
    expect(notifications.create).toHaveBeenCalledWith([1, 6], {
      type: 'TASK_COMPLETED',
      data: {
        taskListId: 10,
        listTitle: 'Groceries',
        taskId: 21,
        taskTitle: 'Milk',
        actorId: 5,
        actorName: 'Mia',
      },
    });
    expect(gateway.notificationsCreated).toHaveBeenCalledWith(rows);
  });

  it('sends no notice unless an open task in a shared list gets completed', async () => {
    await service.update(22, { completed: true }, member); // already done
    await service.update(21, { completed: false }, member); // reopened
    await service.update(1, { completed: true }, owner); // in no list
    await service.update(31, { completed: true }, owner); // nobody else
    expect(notifications.create).not.toHaveBeenCalled();
    expect(gateway.notificationsCreated).not.toHaveBeenCalled();
  });

  it('sends no notice from an admin completing a task in a list without members', async () => {
    await service.update(31, { completed: true }, admin);
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('403s a member body without `completed`', async () => {
    await expect(service.update(21, {}, member)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('still completes the task when the notice fails', async () => {
    notifications.create.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.update(21, { completed: true }, member),
    ).resolves.toMatchObject({ id: 21 });
    expect(gateway.notificationsCreated).not.toHaveBeenCalled();
  });
});
