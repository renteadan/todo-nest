import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { type Notification, Prisma } from '../generated/prisma/client.js';
import {
  type NotificationPayload,
  notificationSchema,
} from './notification.types.js';

const FEED_LIMIT = 50;

// The feed's public shape: no userId.
const feedFields = {
  id: true,
  type: true,
  data: true,
  createdAt: true,
  readAt: true,
} as const;
type FeedItem = Omit<Notification, 'userId'>;

const forList = (taskListId: number) => ({
  data: { path: ['taskListId'], equals: taskListId },
});

/** DB only: callers emit `notification.created` themselves. */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    userIds: number[],
    payload: NotificationPayload,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Notification[]> {
    const { type, data } = notificationSchema.parse(payload);
    return tx.notification.createManyAndReturn({
      data: userIds.map((userId) => ({ userId, type, data })),
    });
  }

  async findAll(userId: number, unread: boolean): Promise<FeedItem[]> {
    const rows = await this.prisma.notification.findMany({
      select: feedFields,
      where: unread ? { userId, readAt: null } : { userId },
      orderBy: { createdAt: 'desc' },
      // shortcut: first 50 only, paginate when feeds grow
      take: FEED_LIMIT,
    });
    return rows.filter((row) => {
      const ok = notificationSchema.safeParse(row).success;
      if (!ok) this.logger.warn(`Dropping invalid notification ${row.id}`);
      return ok;
    });
  }

  async markRead(id: number, userId: number): Promise<Notification> {
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (row?.userId !== userId) throw new NotFoundException();
    if (row.readAt) return row;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  markAllRead(userId: number): Promise<{ count: number }> {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async deleteForList(
    taskListId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.notification.deleteMany({ where: forList(taskListId) });
  }

  async deleteInvite(
    taskListId: number,
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.notification.deleteMany({
      where: { userId, type: 'INVITE', ...forList(taskListId) },
    });
  }

  async markInviteRead(
    taskListId: number,
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.notification.updateMany({
      where: { userId, type: 'INVITE', ...forList(taskListId), readAt: null },
      data: { readAt: new Date() },
    });
  }
}
