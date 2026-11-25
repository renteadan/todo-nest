import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthorizationService } from '@nestjs/authorization';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { type AuthUser } from '../auth/auth-types.js';
import { OwnerPolicy } from '../auth/owner.policy.js';
import { TaskGateway } from '../task/task.gateway.js';
import { NotificationService } from '../notification/notification.service.js';
import { actorName } from '../notification/notification.types.js';
import { TasklistService } from './tasklist.service.js';

export type MemberEntry = {
  id: number;
  name: string | null;
  email: string;
  role: 'owner' | 'member';
  acceptedAt: Date | null;
};

const userFields = { id: true, name: true, email: true } as const;

const memberKey = (taskListId: number, userId: number) => ({
  taskListId_userId: { taskListId, userId },
});

@Injectable()
export class MemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly tasklists: TasklistService,
    private readonly notifications: NotificationService,
    private readonly gateway: TaskGateway,
  ) {}

  /** Owner first (accepted when the list was made), then members by invite date, pending included. */
  async list(listId: number, user: AuthUser): Promise<MemberEntry[]> {
    const list = await this.tasklists.findOne(listId, user);
    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: list.userId },
      select: userFields,
    });
    const rows = await this.prisma.taskListMember.findMany({
      where: { taskListId: listId },
      include: { User: { select: userFields } },
      orderBy: { invitedAt: 'asc' },
    });
    return [
      { ...owner, role: 'owner', acceptedAt: list.createdAt },
      ...rows.map((row) => ({
        ...row.User,
        role: 'member' as const,
        acceptedAt: row.acceptedAt,
      })),
    ];
  }

  async invite(
    listId: number,
    email: string,
    user: AuthUser,
  ): Promise<MemberEntry> {
    const list = await this.tasklists.findOne(listId, user);
    if (list.role !== 'owner') {
      throw new ForbiddenException(
        `Only the owner can invite to list ${listId}`,
      );
    }
    const invitee = await this.prisma.user.findUnique({
      where: { email },
      select: userFields,
    });
    if (!invitee) throw new NotFoundException(`No user with email ${email}`);
    // The owner must never get a member row for their own list.
    if (invitee.id === list.userId) {
      throw new BadRequestException('You cannot invite yourself');
    }
    if (
      await this.prisma.taskListMember.findUnique({
        where: memberKey(listId, invitee.id),
      })
    ) {
      throw new ConflictException(`${email} is already in list ${listId}`);
    }
    const { row, notices } = await this.prisma
      .$transaction(async (tx) => ({
        row: await tx.taskListMember.create({
          data: { taskListId: listId, userId: invitee.id },
        }),
        notices: await this.notifications.create(
          [invitee.id],
          {
            type: 'INVITE',
            data: {
              taskListId: listId,
              listTitle: list.title,
              actorId: user.id,
              actorName: actorName(user),
            },
          },
          tx,
        ),
      }))
      .catch((error: unknown) => {
        // A concurrent invite of the same user won the race.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException(`${email} is already in list ${listId}`);
        }
        throw error;
      });
    this.gateway.notificationsCreated(notices);
    return { ...invitee, role: 'member', acceptedAt: row.acceptedAt };
  }

  async accept(listId: number, user: AuthUser) {
    const row = await this.prisma.taskListMember.findUnique({
      where: memberKey(listId, user.id),
    });
    if (!row || row.acceptedAt) {
      throw new NotFoundException(`No pending invite to list ${listId}`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.taskListMember.update({
        where: memberKey(listId, user.id),
        data: { acceptedAt: new Date() },
      });
      await this.notifications.markInviteRead(listId, user.id, tx);
    });
    await this.gateway.tasklistUpdated(listId);
    return this.tasklists.findOne(listId, user);
  }

  /** Kick, cancel an invite, decline or leave. Tasks stay in the list. */
  async remove(
    listId: number,
    target: number | 'me',
    user: AuthUser,
  ): Promise<void> {
    const targetId = target === 'me' ? user.id : target;
    const list = await this.prisma.taskList.findUnique({
      where: { id: listId },
    });
    if (!list) throw new NotFoundException(`Task list ${listId} not found`);
    const isOwner = list.userId === user.id;
    if (isOwner && targetId === user.id) {
      throw new BadRequestException('The owner cannot leave their own list');
    }
    if (!isOwner && targetId !== user.id) {
      const own = await this.prisma.taskListMember.findUnique({
        where: memberKey(listId, user.id),
      });
      const visible =
        !!own?.acceptedAt ||
        (await this.authorization.can(OwnerPolicy, 'viewAll', user));
      if (!visible)
        throw new NotFoundException(`Task list ${listId} not found`);
      throw new ForbiddenException(
        `Only the owner can remove others from list ${listId}`,
      );
    }
    const row = await this.prisma.taskListMember.findUnique({
      where: memberKey(listId, targetId),
    });
    if (!row) {
      throw new NotFoundException(`User ${targetId} is not in list ${listId}`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.taskListMember.delete({ where: memberKey(listId, targetId) });
      await this.notifications.deleteInvite(listId, targetId, tx);
    });
    if (row.acceptedAt) {
      this.gateway.tasklistDeleted(listId, [targetId]);
      await this.gateway.tasklistUpdated(listId);
    }
  }
}
