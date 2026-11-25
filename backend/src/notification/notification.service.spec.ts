import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationService } from './notification.service.js';
import {
  actorName,
  type NotificationPayload,
  notificationSchema,
} from './notification.types.js';

const LIST_ID = 10;
const TASK_ID = 5;
const ACTOR_ID = 1;
const USER_ID = 2;
const OTHER_USER_ID = 3;
const VALID_ROW_ID = 1;
const INVALID_ROW_ID = 2;
const FOREIGN_ROW_ID = 7;

const invite: NotificationPayload = {
  type: 'INVITE',
  data: {
    taskListId: LIST_ID,
    listTitle: 'Groceries',
    actorId: ACTOR_ID,
    actorName: 'Ann',
  },
};
const completed: NotificationPayload = {
  type: 'TASK_COMPLETED',
  data: {
    taskListId: LIST_ID,
    listTitle: 'Groceries',
    taskId: TASK_ID,
    taskTitle: 'Milk',
    actorId: ACTOR_ID,
    actorName: 'Ann',
  },
};

describe('notificationSchema', () => {
  it('parses INVITE and TASK_COMPLETED', () => {
    expect(notificationSchema.parse(invite)).toEqual(invite);
    expect(notificationSchema.parse(completed)).toEqual(completed);
  });

  it('rejects TASK_COMPLETED without taskId and unknown types', () => {
    const { taskId: _taskId, ...data } = (
      completed as Extract<NotificationPayload, { type: 'TASK_COMPLETED' }>
    ).data;
    expect(
      notificationSchema.safeParse({ type: 'TASK_COMPLETED', data }).success,
    ).toBe(false);
    expect(
      notificationSchema.safeParse({ type: 'FOO', data: invite.data }).success,
    ).toBe(false);
  });

  it('actorName falls back to email', () => {
    expect(actorName({ name: 'Ann', email: 'a@x.io' })).toBe('Ann');
    expect(actorName({ name: null, email: 'a@x.io' })).toBe('a@x.io');
  });
});

describe('NotificationService', () => {
  const rows = [
    {
      id: VALID_ROW_ID,
      userId: USER_ID,
      ...invite,
      createdAt: new Date(),
      readAt: null,
    },
    {
      id: INVALID_ROW_ID,
      userId: USER_ID,
      type: 'INVITE',
      data: {},
      createdAt: new Date(),
    },
  ];
  const prisma = {
    notification: {
      createManyAndReturn: vi.fn(({ data }) => Promise.resolve(data)),
      // Applies `select` like Prisma does.
      findMany: vi.fn(({ select }) =>
        Promise.resolve(
          rows.map((row) =>
            Object.fromEntries(
              Object.entries(row).filter(([key]) => select?.[key]),
            ),
          ),
        ),
      ),
      findUnique: vi.fn(({ where }) =>
        Promise.resolve(
          where.id === VALID_ROW_ID
            ? rows[0]
            : { ...rows[0], userId: OTHER_USER_ID },
        ),
      ),
      update: vi.fn(({ data }) => Promise.resolve({ ...rows[0], ...data })),
      updateMany: vi.fn(() => Promise.resolve({ count: 1 })),
      deleteMany: vi.fn(() => Promise.resolve({ count: 1 })),
    },
  };
  let service: NotificationService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(NotificationService);
  });

  it('creates one row per recipient', async () => {
    await service.create([USER_ID, OTHER_USER_ID], invite);
    expect(prisma.notification.createManyAndReturn).toHaveBeenCalledWith({
      data: [
        { userId: USER_ID, type: 'INVITE', data: invite.data },
        { userId: OTHER_USER_ID, type: 'INVITE', data: invite.data },
      ],
    });
  });

  it('rejects an invalid payload', async () => {
    await expect(
      service.create([USER_ID], { type: 'INVITE', data: {} } as never),
    ).rejects.toThrow();
    expect(prisma.notification.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('uses the transaction client when given', async () => {
    const tx = { notification: { deleteMany: vi.fn() } };
    await service.deleteForList(LIST_ID, tx as never);
    expect(tx.notification.deleteMany).toHaveBeenCalled();
    expect(prisma.notification.deleteMany).not.toHaveBeenCalled();
  });

  it('findAll filters unread only when asked and drops invalid rows', async () => {
    const [feed, ...rest] = await service.findAll(USER_ID, true);
    expect(rest).toEqual([]);
    expect(Object.keys(feed).sort()).toEqual(
      ['createdAt', 'data', 'id', 'readAt', 'type'].sort(),
    );
    expect(feed).toMatchObject({ id: VALID_ROW_ID, ...invite });
    expect(prisma.notification.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, readAt: null } }),
    );
    await service.findAll(USER_ID, false);
    expect(prisma.notification.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } }),
    );
  });

  it('markRead 404s on another user’s notification', async () => {
    await expect(
      service.markRead(FOREIGN_ROW_ID, USER_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notification.update).not.toHaveBeenCalled();
    await expect(
      service.markRead(VALID_ROW_ID, USER_ID),
    ).resolves.toMatchObject({
      readAt: expect.any(Date),
    });
  });

  it('deleteForList filters on the JSON taskListId', async () => {
    await service.deleteForList(LIST_ID);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { data: { path: ['taskListId'], equals: LIST_ID } },
    });
  });

  it('deleteInvite and markInviteRead target the user’s invite', async () => {
    const where = {
      userId: USER_ID,
      type: 'INVITE',
      data: { path: ['taskListId'], equals: LIST_ID },
    };
    await service.deleteInvite(LIST_ID, USER_ID);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where });
    await service.markInviteRead(LIST_ID, USER_ID);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { ...where, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
