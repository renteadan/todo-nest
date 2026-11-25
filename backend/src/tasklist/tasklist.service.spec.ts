import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthorizationModule } from '@nestjs/authorization';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthUser } from '../auth/auth-types.js';
import { OwnerPolicy } from '../auth/owner.policy.js';
import { TaskService } from '../task/task.service.js';
import { MAX_TASKS_PER_LIST, TasklistService } from './tasklist.service.js';
import { TaskGateway } from '../task/task.gateway.js';
import { NotificationService } from '../notification/notification.service.js';
import { acceptedMembers } from '../task/list-role.js';

const owner: AuthUser = { id: 1, email: 'o@x.io', name: null, role: 'USER' };
const other: AuthUser = { id: 3, email: 'p@x.io', name: null, role: 'USER' };
const admin: AuthUser = { id: 2, email: 'a@x.io', name: null, role: 'ADMIN' };
const member: AuthUser = { id: 4, email: 'm@x.io', name: null, role: 'USER' };
// Invited to list 14 but not yet accepted: not among its accepted members.
const invitee: AuthUser = { id: 5, email: 'i@x.io', name: null, role: 'USER' };

// List 10 and tasks 20 (in no list) and 21 (in list 10) belong to user 1;
// task 30 belongs to user 3; list 11 belongs to the admin; list 13 to user 1;
// list 14 belongs to user 1 and is shared with user 4 (accepted).
// List 15 belongs to user 4. Task 40 is user 4's, in no list; task 41 was
// created by user 4 in list 14.
// TaskListMember holds accepted members only, as the acceptedMembers include does.
const lists: Record<number, { id: number; userId: number }> = {
  10: { id: 10, userId: 1, Task: [], TaskListMember: [] },
  11: { id: 11, userId: 2, Task: [], TaskListMember: [] },
  13: { id: 13, userId: 1, Task: [], TaskListMember: [] },
  14: { id: 14, userId: 1, Task: [], TaskListMember: [{ userId: 4 }] },
  15: { id: 15, userId: 4, Task: [], TaskListMember: [] },
} as Record<number, { id: number; userId: number }>;
const tasks: Record<number, object> = {
  20: { id: 20, userId: 1, taskListId: null, TaskList: null },
  21: {
    id: 21,
    userId: 1,
    taskListId: 10,
    TaskList: { id: 10, userId: 1, TaskListMember: [] },
  },
  30: { id: 30, userId: 3, taskListId: null, TaskList: null },
  40: { id: 40, userId: 4, taskListId: null, TaskList: null },
  41: {
    id: 41,
    userId: 4,
    taskListId: 14,
    TaskList: { id: 14, userId: 1, TaskListMember: [{ userId: 4 }] },
  },
  // In list 15, owned by user 4.
  42: {
    id: 42,
    userId: 4,
    taskListId: 15,
    TaskList: { id: 15, userId: 4, TaskListMember: [] },
  },
};

describe('TasklistService', () => {
  const prisma = {
    taskList: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(({ where }) =>
        Promise.resolve(lists[where.id] ?? null),
      ),
      update: vi.fn(({ where, data }) =>
        Promise.resolve({ ...lists[where.id], ...data }),
      ),
      delete: vi.fn(({ where }) => Promise.resolve(lists[where.id])),
      create: vi.fn(({ data }) => Promise.resolve({ id: 12, ...data })),
    },
    task: {
      count: vi.fn().mockResolvedValue(0),
      findUnique: vi.fn(({ where }) =>
        Promise.resolve(tasks[where.id] ?? null),
      ),
      update: vi.fn(({ where, data }) =>
        Promise.resolve({ ...tasks[where.id], ...data }),
      ),
      deleteMany: vi.fn(),
    },
    taskListMember: { findMany: vi.fn().mockResolvedValue([]) },
  };
  // The transaction runs on the same mock; FOR UPDATE is a no-op here.
  Object.assign(prisma, {
    $queryRaw: vi.fn(),
    $transaction: vi.fn((fn: (tx: typeof prisma) => unknown) => fn(prisma)),
  });
  const gateway = {
    tasklistUpdated: vi.fn(),
    tasklistDeleted: vi.fn(),
    taskChanged: vi.fn(),
  };
  const notifications = { deleteForList: vi.fn() };
  let service: TasklistService;

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
        TasklistService,
        TaskService,
        { provide: PrismaService, useValue: prisma },
        { provide: TaskGateway, useValue: gateway },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(TasklistService);
  });

  it('lists the user’s own and joined lists, and every list for an admin', async () => {
    await service.findAll(owner, false);
    expect(prisma.taskList.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { userId: 1 },
            {
              TaskListMember: {
                some: { userId: 1, acceptedAt: { not: null } },
              },
            },
          ],
        },
      }),
    );
    await service.findAll(admin, false);
    expect(prisma.taskList.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('gives each list the caller’s role, without the member array', async () => {
    prisma.taskList.findMany.mockResolvedValue([lists[10], lists[14]]);
    await expect(service.findAll(member, false)).resolves.toEqual([
      { id: 10, userId: 1, Task: [], role: null },
      { id: 14, userId: 1, Task: [], role: 'member' },
    ]);
    const owned = await service.findAll(owner, false);
    expect(owned.map((l) => l.role)).toEqual(['owner', 'owner']);
    const all = await service.findAll(admin, false);
    expect(all.map((l) => l.role)).toEqual([null, null]);
    expect(all[0]).not.toHaveProperty('TaskListMember');
    prisma.taskList.findMany.mockResolvedValue([]);
  });

  it('loads tasks only with include=tasks', async () => {
    await service.findAll(owner, true);
    expect(prisma.taskList.findMany.mock.lastCall?.[0].include.Task).toEqual({
      orderBy: { id: 'asc' },
    });
    await service.findAll(owner, false);
    expect(
      prisma.taskList.findMany.mock.lastCall?.[0].include.Task,
    ).toBeFalsy();
  });

  it('404s on someone else’s list', async () => {
    await expect(service.findOne(10, other)).rejects.toThrow(NotFoundException);
    await expect(service.findOne(10, admin)).resolves.toMatchObject({
      id: 10,
      role: null,
    });
  });

  it('returns a list with its tasks and the caller’s role', async () => {
    await expect(service.findOne(14, owner)).resolves.toEqual({
      id: 14,
      userId: 1,
      Task: [],
      role: 'owner',
    });
    await expect(service.findOne(14, member)).resolves.toMatchObject({
      role: 'member',
    });
    expect(prisma.taskList.findUnique).toHaveBeenLastCalledWith({
      where: { id: 14 },
      include: { ...acceptedMembers, Task: { orderBy: { id: 'asc' } } },
    });
  });

  it('404s for a pending invitee', async () => {
    await expect(service.findOne(14, invitee)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lets a member read but not change or delete a list', async () => {
    await expect(service.update(14, { title: 'x' }, member)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.remove(14, member)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.taskList.update).not.toHaveBeenCalled();
    expect(prisma.taskList.delete).not.toHaveBeenCalled();
  });

  it('adds one of the owner’s tasks to the list', async () => {
    await expect(service.addTask(10, 20, owner)).resolves.toMatchObject({
      id: 20,
      taskListId: 10,
    });
  });

  it('refuses tasks the user can’t see, and other users’ Inbox tasks even for an admin', async () => {
    await expect(service.addTask(10, 30, owner)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.addTask(11, 30, admin)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('lets a member move their own Inbox task into the shared list', async () => {
    await expect(service.addTask(14, 40, member)).resolves.toMatchObject({
      id: 40,
      taskListId: 14,
    });
    expect(gateway.tasklistUpdated.mock.calls).toEqual([[14]]);
  });

  it('404s when a member moves someone else’s Inbox task', async () => {
    await expect(service.addTask(14, 20, member)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('403s when a member moves a task out of a list they don’t own, even one they created', async () => {
    await expect(service.addTask(15, 41, member)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.task.update).not.toHaveBeenCalled();
    expect(gateway.tasklistUpdated).not.toHaveBeenCalled();
  });

  it('403s when an owner moves a task from their list into one they only joined', async () => {
    await expect(service.addTask(14, 42, member)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.task.update).not.toHaveBeenCalled();
    expect(gateway.tasklistUpdated).not.toHaveBeenCalled();
  });

  it('lets the owner remove a member-created task, but not a member', async () => {
    await expect(service.removeTask(14, 41, owner)).resolves.toMatchObject({
      id: 41,
      taskListId: null,
    });
    await expect(service.removeTask(14, 41, member)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.task.update).toHaveBeenCalledTimes(1);
  });

  it('deletes a shared list with members’ tasks, notifications and events', async () => {
    const ownTask = { id: 21, userId: 1, taskListId: 10 };
    prisma.taskList.findUnique.mockResolvedValueOnce({
      ...lists[10],
      Task: [ownTask, { id: 22, userId: 4, taskListId: 10 }],
      TaskListMember: [{ userId: 4 }],
    });
    prisma.taskListMember.findMany.mockResolvedValueOnce([{ userId: 4 }]);
    await service.remove(10, owner);
    expect(prisma.task.deleteMany).toHaveBeenCalledWith({
      where: { taskListId: 10, NOT: { userId: 1 } },
    });
    expect(notifications.deleteForList).toHaveBeenCalledWith(10, prisma);
    expect(prisma.taskList.delete).toHaveBeenCalledWith({ where: { id: 10 } });
    expect(gateway.tasklistDeleted).toHaveBeenCalledWith(10, [1, 4]);
    expect(gateway.taskChanged.mock.calls).toEqual([
      ['task.updated', { ...ownTask, taskListId: null }],
    ]);
  });

  it('removes a task only from the list it is in', async () => {
    await expect(service.removeTask(10, 21, owner)).resolves.toMatchObject({
      id: 21,
      taskListId: null,
    });
    await expect(service.removeTask(10, 20, owner)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lets only the owner change or delete a list, not an admin or another user', async () => {
    for (const user of [admin, other]) {
      const error = user === admin ? ForbiddenException : NotFoundException;
      await expect(service.update(10, { title: 'x' }, user)).rejects.toThrow(
        error,
      );
      await expect(service.remove(10, user)).rejects.toThrow(error);
      await expect(service.addTask(10, 20, user)).rejects.toThrow(error);
      await expect(service.removeTask(10, 21, user)).rejects.toThrow(error);
    }
    expect(prisma.taskList.update).not.toHaveBeenCalled();
    expect(prisma.taskList.delete).not.toHaveBeenCalled();
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('deletes the owner’s list (its tasks are unassigned by the FK, onDelete: SetNull)', async () => {
    await expect(service.remove(10, owner)).resolves.toMatchObject({ id: 10 });
    expect(prisma.taskList.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  it('pushes each list change over the gateway', async () => {
    await service.create({ title: 'New' }, owner);
    expect(gateway.tasklistUpdated).toHaveBeenLastCalledWith(12);
    await service.update(10, { title: 'Renamed' }, owner);
    expect(gateway.tasklistUpdated).toHaveBeenLastCalledWith(10);
    await service.removeTask(10, 21, owner);
    expect(gateway.tasklistUpdated).toHaveBeenLastCalledWith(10);
    await service.remove(10, owner);
    expect(gateway.tasklistDeleted).toHaveBeenCalledWith(10, [
      lists[10].userId,
    ]);
  });

  it('pushes both lists when a task moves from one list to another', async () => {
    await service.addTask(13, 21, owner);
    expect(gateway.tasklistUpdated.mock.calls).toEqual([[13], [10]]);
  });

  it('pushes nothing when the change is refused', async () => {
    await expect(service.addTask(10, 20, admin)).rejects.toThrow();
    expect(gateway.tasklistUpdated).not.toHaveBeenCalled();
  });

  it(`refuses a task when the list already has ${MAX_TASKS_PER_LIST}, done or not`, async () => {
    prisma.task.count.mockResolvedValueOnce(MAX_TASKS_PER_LIST);
    await expect(service.addTask(10, 20, owner)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.task.count).toHaveBeenCalledWith({
      where: { taskListId: 10, NOT: { id: 20 } },
    });
    expect(prisma.task.update).not.toHaveBeenCalled();
    expect(gateway.tasklistUpdated).not.toHaveBeenCalled();
  });

  it('still accepts a task that is already in the full list', async () => {
    // The list holds the maximum, this task included: the others are one fewer.
    prisma.task.count.mockResolvedValue(MAX_TASKS_PER_LIST - 1);
    await expect(service.addTask(10, 21, owner)).resolves.toMatchObject({
      id: 21,
      taskListId: 10,
    });
    prisma.task.count.mockResolvedValue(0);
  });
});
