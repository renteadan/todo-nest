import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthorizationModule } from '@nestjs/authorization';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthUser } from '../auth/auth-types.js';
import { OwnerPolicy } from '../auth/owner.policy.js';
import { TaskService } from '../task/task.service.js';
import { TasklistService } from './tasklist.service.js';
import { TaskGateway } from '../task/task.gateway.js';

const owner: AuthUser = { id: 1, email: 'o@x.io', name: null, role: 'USER' };
const other: AuthUser = { id: 3, email: 'p@x.io', name: null, role: 'USER' };
const admin: AuthUser = { id: 2, email: 'a@x.io', name: null, role: 'ADMIN' };

// List 10 and tasks 20 (in no list) and 21 (in list 10) belong to user 1;
// task 30 belongs to user 3; list 11 belongs to the admin; list 13 to user 1.
const lists: Record<number, object> = {
  10: { id: 10, userId: 1, Task: [] },
  11: { id: 11, userId: 2, Task: [] },
  13: { id: 13, userId: 1, Task: [] },
};
const tasks: Record<number, object> = {
  20: { id: 20, userId: 1, taskListId: null },
  21: { id: 21, userId: 1, taskListId: 10 },
  30: { id: 30, userId: 3, taskListId: null },
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
      findUnique: vi.fn(({ where }) =>
        Promise.resolve(tasks[where.id] ?? null),
      ),
      update: vi.fn(({ where, data }) =>
        Promise.resolve({ ...tasks[where.id], ...data }),
      ),
    },
  };
  const gateway = { tasklistUpdated: vi.fn(), tasklistDeleted: vi.fn() };
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
      ],
    }).compile();
    service = moduleRef.get(TasklistService);
  });

  it('lists only the user’s own lists, and every list for an admin', async () => {
    await service.findAll(owner);
    expect(prisma.taskList.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { userId: 1 } }),
    );
    await service.findAll(admin);
    expect(prisma.taskList.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('404s on someone else’s list', async () => {
    await expect(service.findOne(10, other)).rejects.toThrow(NotFoundException);
    await expect(service.findOne(10, admin)).resolves.toMatchObject({ id: 10 });
  });

  it('adds one of the owner’s tasks to the list', async () => {
    await expect(service.addTask(10, 20, owner)).resolves.toMatchObject({
      id: 20,
      taskListId: 10,
    });
  });

  it('refuses tasks the user can’t see, and other owners’ tasks even for an admin', async () => {
    await expect(service.addTask(10, 30, owner)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.addTask(11, 30, admin)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.task.update).not.toHaveBeenCalled();
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
    expect(gateway.tasklistDeleted).toHaveBeenCalledWith(lists[10]);
  });

  it('pushes both lists when a task moves from one list to another', async () => {
    await service.addTask(13, 21, owner);
    expect(gateway.tasklistUpdated.mock.calls).toEqual([[13], [10]]);
  });

  it('pushes nothing when the change is refused', async () => {
    await expect(service.addTask(10, 20, admin)).rejects.toThrow();
    expect(gateway.tasklistUpdated).not.toHaveBeenCalled();
  });
});
