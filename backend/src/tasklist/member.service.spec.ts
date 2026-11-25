import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthorizationModule } from '@nestjs/authorization';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthUser } from '../auth/auth-types.js';
import { OwnerPolicy } from '../auth/owner.policy.js';
import { TaskGateway } from '../task/task.gateway.js';
import { NotificationService } from '../notification/notification.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { TasklistService } from './tasklist.service.js';
import { MemberService } from './member.service.js';

const owner: AuthUser = { id: 1, email: 'o@x.io', name: 'Olga', role: 'USER' };
const admin: AuthUser = { id: 2, email: 'a@x.io', name: null, role: 'ADMIN' };
const member: AuthUser = { id: 4, email: 'm@x.io', name: null, role: 'USER' };
const invitee: AuthUser = { id: 5, email: 'i@x.io', name: null, role: 'USER' };
const b = { id: 6, email: 'b@x.io', name: 'Bea' };
const users = [owner, admin, member, invitee, b];

const created = new Date('2026-01-01');
const accepted = new Date('2026-01-03');
// List 14 belongs to user 1: user 4 accepted, user 5 is invited.
const list = { id: 14, userId: 1, title: 'Groceries', createdAt: created };
let rows: {
  taskListId: number;
  userId: number;
  invitedAt: Date;
  acceptedAt: Date | null;
}[];

const roles: Record<number, 'owner' | 'member'> = { 1: 'owner', 4: 'member' };
const role = (u: AuthUser) => roles[u.id] ?? null;

describe('MemberService', () => {
  const findRow = ({
    where,
  }: {
    where: { taskListId_userId: { taskListId: number; userId: number } };
  }) =>
    Promise.resolve(
      rows.find(
        (r) =>
          r.taskListId === where.taskListId_userId.taskListId &&
          r.userId === where.taskListId_userId.userId,
      ) ?? null,
    );
  const prisma = {
    user: {
      findUnique: vi.fn(({ where }) =>
        Promise.resolve(
          users.find((u) => u.email === where.email || u.id === where.id) ??
            null,
        ),
      ),
      findUniqueOrThrow: vi.fn(({ where }) =>
        Promise.resolve(users.find((u) => u.id === where.id)),
      ),
    },
    taskList: {
      findUnique: vi.fn(({ where }) =>
        Promise.resolve(where.id === 14 ? list : null),
      ),
      update: vi.fn(({ data }) => Promise.resolve({ ...list, ...data })),
    },
    taskListMember: {
      findUnique: vi.fn(findRow),
      findMany: vi.fn(() =>
        Promise.resolve(
          [...rows]
            .sort((x, y) => +x.invitedAt - +y.invitedAt)
            .map((r) => ({ ...r, User: users.find((u) => u.id === r.userId) })),
        ),
      ),
      create: vi.fn(({ data }) =>
        Promise.resolve({ ...data, invitedAt: new Date(), acceptedAt: null }),
      ),
      update: vi.fn(({ data }) => Promise.resolve(data)),
      deleteMany: vi.fn(
        ({ where }: { where: { taskListId: number; userId: number } }) =>
          Promise.resolve({
            count: rows.some(
              (r) =>
                r.taskListId === where.taskListId && r.userId === where.userId,
            )
              ? 1
              : 0,
          }),
      ),
    },
  };
  Object.assign(prisma, {
    $transaction: vi.fn((fn: (tx: typeof prisma) => unknown) => fn(prisma)),
  });
  const gateway = {
    tasklistUpdated: vi.fn(),
    tasklistDeleted: vi.fn(),
    notificationsCreated: vi.fn(),
  };
  const notifications = {
    create: vi.fn((ids: number[]) =>
      Promise.resolve(ids.map((userId) => ({ userId }))),
    ),
    deleteInvite: vi.fn(),
    markInviteRead: vi.fn(),
  };
  const tasklists = {
    findOne: vi.fn((id: number, u: AuthUser) => {
      const r = role(u);
      if (id !== 14 || (!r && u.role !== 'ADMIN'))
        return Promise.reject(new NotFoundException());
      return Promise.resolve({ ...list, Task: [], role: r });
    }),
  };
  let service: MemberService;

  beforeEach(async () => {
    vi.clearAllMocks();
    rows = [
      {
        taskListId: 14,
        userId: 4,
        invitedAt: new Date('2026-01-02'),
        acceptedAt: accepted,
      },
      {
        taskListId: 14,
        userId: 5,
        invitedAt: new Date('2026-01-04'),
        acceptedAt: null,
      },
    ];
    const moduleRef = await Test.createTestingModule({
      imports: [
        AuthorizationModule.forRoot({
          globalGuard: false,
          policies: [OwnerPolicy],
        }),
      ],
      providers: [
        MemberService,
        { provide: PrismaService, useValue: prisma },
        { provide: TaskGateway, useValue: gateway },
        { provide: NotificationService, useValue: notifications },
        { provide: TasklistService, useValue: tasklists },
      ],
    }).compile();
    service = moduleRef.get(MemberService);
  });

  describe('invite', () => {
    it('creates a pending row and an INVITE notification', async () => {
      const entry = await service.invite(14, 'b@x.io', owner);
      expect(prisma.taskListMember.create).toHaveBeenCalledWith({
        data: { taskListId: 14, userId: 6 },
      });
      // The first invite makes the list shared, for good.
      expect(prisma.taskList.update).toHaveBeenCalledWith({
        where: { id: 14 },
        data: { visibility: 'SHARED' },
      });
      expect(notifications.create).toHaveBeenCalledWith(
        [6],
        {
          type: 'INVITE',
          data: {
            taskListId: 14,
            listTitle: 'Groceries',
            actorId: 1,
            actorName: 'Olga',
          },
        },
        prisma,
      );
      expect(gateway.notificationsCreated).toHaveBeenCalledWith([
        { userId: 6 },
      ]);
      expect(entry).toEqual({
        id: 6,
        name: 'Bea',
        email: 'b@x.io',
        role: 'member',
        acceptedAt: null,
      });
    });

    it('404s for an unknown email', async () => {
      await expect(service.invite(14, 'nobody@x.io', owner)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('400s for the owner’s own email', async () => {
      await expect(service.invite(14, 'o@x.io', owner)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.taskListMember.create).not.toHaveBeenCalled();
    });

    it('409s for an existing member or invitee', async () => {
      await expect(service.invite(14, 'i@x.io', owner)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.taskListMember.create).not.toHaveBeenCalled();
    });

    it('409s when a concurrent invite wins the race (P2002)', async () => {
      prisma.taskListMember.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'x',
        }),
      );
      await expect(service.invite(14, 'b@x.io', owner)).rejects.toThrow(
        ConflictException,
      );
      expect(gateway.notificationsCreated).not.toHaveBeenCalled();
    });

    it('403s for a member and for an admin on a foreign list', async () => {
      await expect(service.invite(14, 'b@x.io', member)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.invite(14, 'b@x.io', admin)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('accept', () => {
    it('sets acceptedAt and marks the invite read', async () => {
      // The findOne mock doesn't see the acceptance, so stub its answer.
      tasklists.findOne.mockResolvedValueOnce({
        ...list,
        Task: [],
        role: 'member',
      });
      const result = await service.accept(14, invitee);
      expect(prisma.taskListMember.update).toHaveBeenCalledWith({
        where: { taskListId_userId: { taskListId: 14, userId: 5 } },
        data: { acceptedAt: expect.any(Date) },
      });
      expect(notifications.markInviteRead).toHaveBeenCalledWith(14, 5, prisma);
      expect(gateway.tasklistUpdated).toHaveBeenCalledWith(14);
      expect(tasklists.findOne).toHaveBeenCalledWith(14, invitee);
      expect(result).toBeDefined();
    });

    it('404s without a pending row, admins included', async () => {
      await expect(service.accept(14, member)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.accept(14, admin)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.taskListMember.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('lets the owner kick a member', async () => {
      await service.remove(14, 4, owner);
      expect(prisma.taskListMember.deleteMany).toHaveBeenCalledWith({
        where: { taskListId: 14, userId: 4 },
      });
      expect(notifications.deleteInvite).toHaveBeenCalledWith(14, 4, prisma);
      expect(gateway.tasklistDeleted).toHaveBeenCalledWith(14, [4]);
      expect(gateway.tasklistUpdated).toHaveBeenCalledWith(14);
    });

    it('lets a member leave via me', async () => {
      await service.remove(14, 'me', member);
      expect(prisma.taskListMember.deleteMany).toHaveBeenCalledWith({
        where: { taskListId: 14, userId: 4 },
      });
      expect(gateway.tasklistDeleted).toHaveBeenCalledWith(14, [4]);
    });

    it('lets an invitee decline via me, without tasklist events', async () => {
      await service.remove(14, 'me', invitee);
      expect(notifications.deleteInvite).toHaveBeenCalledWith(14, 5, prisma);
      expect(gateway.tasklistDeleted).not.toHaveBeenCalled();
      expect(gateway.tasklistUpdated).not.toHaveBeenCalled();
    });

    it('lets the owner cancel a pending invite, without tasklist events', async () => {
      await service.remove(14, 5, owner);
      expect(prisma.taskListMember.deleteMany).toHaveBeenCalledWith({
        where: { taskListId: 14, userId: 5 },
      });
      expect(notifications.deleteInvite).toHaveBeenCalledWith(14, 5, prisma);
      expect(gateway.tasklistDeleted).not.toHaveBeenCalled();
      expect(gateway.tasklistUpdated).not.toHaveBeenCalled();
    });

    it('lets an admin who joined the list leave via me', async () => {
      rows.push({
        taskListId: 14,
        userId: admin.id,
        invitedAt: new Date('2026-01-05'),
        acceptedAt: accepted,
      });
      await service.remove(14, 'me', admin);
      expect(prisma.taskListMember.deleteMany).toHaveBeenCalledWith({
        where: { taskListId: 14, userId: admin.id },
      });
      expect(gateway.tasklistDeleted).toHaveBeenCalledWith(14, [admin.id]);
    });

    it('400s for the owner removing themselves', async () => {
      await expect(service.remove(14, 'me', owner)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('403s for a member removing another member, and for an admin', async () => {
      await expect(service.remove(14, 5, member)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.remove(14, 4, admin)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.taskListMember.deleteMany).not.toHaveBeenCalled();
    });

    it('404s for a missing row or an invisible list', async () => {
      await expect(service.remove(14, 6, owner)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove(14, 4, invitee)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove(99, 'me', member)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('gives a stranger the same 404 whether or not the list exists', async () => {
      const stranger = { ...invitee, id: b.id, email: b.email };
      await expect(service.remove(14, 'me', stranger)).rejects.toThrow(
        'Task list 14 not found',
      );
      await expect(service.remove(99, 'me', stranger)).rejects.toThrow(
        'Task list 99 not found',
      );
    });

    it('404s, not 500s, when a concurrent remove deleted the row first', async () => {
      prisma.taskListMember.deleteMany.mockResolvedValueOnce({ count: 0 });
      await expect(service.remove(14, 4, owner)).rejects.toThrow(
        NotFoundException,
      );
      expect(gateway.tasklistDeleted).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('404s for a pending invitee', async () => {
      await expect(service.list(14, invitee)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the owner first, then members by invitedAt', async () => {
      expect(await service.list(14, member)).toEqual([
        {
          id: 1,
          name: 'Olga',
          email: 'o@x.io',
          role: 'owner',
          acceptedAt: created,
        },
        {
          id: 4,
          name: null,
          email: 'm@x.io',
          role: 'member',
          acceptedAt: accepted,
        },
        {
          id: 5,
          name: null,
          email: 'i@x.io',
          role: 'member',
          acceptedAt: null,
        },
      ]);
    });
  });
});
