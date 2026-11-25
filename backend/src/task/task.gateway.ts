import { Logger } from '@nestjs/common';
import {
  type OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { type JwtClaims, WsAuthenticator } from '@nestjs/authentication';
import { type Server, type Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service.js';
import { type AuthUser } from '../auth/auth-types.js';
import { type Task } from '../generated/prisma/client.js';
import { acceptedMembers, listUserIds } from './list-role.js';

const userRoom = (userId: number) => `user:${userId}`;

type TaskEvent = 'task.created' | 'task.updated' | 'task.deleted';

/**
 * Server-to-client events only. Clients connect to the API's own port
 * (socket.io, path /socket.io/) with
 * `io(url, { auth: { token: accessToken }, transports: ['websocket'] })`
 * and listen for:
 * - `task.created`, `task.updated` (completing or reopening included),
 *   `task.deleted`: the task.
 * - `tasklist.updated`: the list with its tasks, when it is created, renamed,
 *   or a task moves into or out of it.
 * - `tasklist.deleted`: `{ id }`; the list's tasks are now in no list.
 * - `notification.created`: the notification, to its user.
 */
// WebSocket only: HTTP long-polling would need sticky sessions across pods.
@WebSocketGateway({ transports: ['websocket'] })
export class TaskGateway implements OnGatewayConnection {
  private readonly logger = new Logger(TaskGateway.name);
  @WebSocketServer() private readonly server!: Server;

  constructor(
    private readonly wsAuth: WsAuthenticator,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    // Closes the socket itself when the token is missing or invalid.
    const auth = await this.wsAuth.authenticateConnection(client);
    if (!auth) return;

    // Events are pushed on the strength of the handshake's token, so the
    // socket lives only as long as that token; the client reconnects with a
    // fresh one.
    const exp = (auth.session as JwtClaims | undefined)?.exp;
    if (exp) {
      const timer = setTimeout(
        () => client.disconnect(true),
        exp * 1000 - Date.now(),
      );
      client.on('disconnect', () => clearTimeout(timer));
    }
    await client.join(userRoom((auth.user as AuthUser).id));
  }

  /**
   * Tells every user with access to the task's list (the task's owner when
   * it is in no list). Never throws: the change is already saved.
   */
  async taskChanged(event: TaskEvent, task: Task) {
    try {
      const userIds =
        task.taskListId === null
          ? [task.userId]
          : await this.listUserIds(task.taskListId);
      if (userIds.length > 0) {
        this.server.to(userIds.map(userRoom)).emit(event, task);
      }
    } catch (error) {
      this.logger.error(`${event} for task ${task.id} not sent`, error);
    }
  }

  /** Sends the list, with its tasks, to its users. Never throws. */
  async tasklistUpdated(taskListId: number) {
    try {
      const list = await this.prisma.taskList.findUnique({
        where: { id: taskListId },
        include: { ...acceptedMembers, Task: { orderBy: { id: 'asc' } } },
      });
      if (list) {
        this.server
          .to(listUserIds(list).map(userRoom))
          .emit('tasklist.updated', list);
      }
    } catch (error) {
      this.logger.error(
        `tasklist.updated for list ${taskListId} not sent`,
        error,
      );
    }
  }

  /** Tells the list's former users it is gone. Never throws. */
  tasklistDeleted(listId: number, userIds: number[]) {
    try {
      this.server
        .to(userIds.map(userRoom))
        .emit('tasklist.deleted', { id: listId });
    } catch (error) {
      this.logger.error(`tasklist.deleted for list ${listId} not sent`, error);
    }
  }

  /** Pushes each new notification to its user. Never throws. */
  notificationsCreated(rows: { userId: number }[]) {
    for (const row of rows) {
      try {
        this.server.to(userRoom(row.userId)).emit('notification.created', row);
      } catch (error) {
        this.logger.error(
          `notification.created for user ${row.userId} not sent`,
          error,
        );
      }
    }
  }

  private async listUserIds(taskListId: number): Promise<number[]> {
    const list = await this.prisma.taskList.findUnique({
      where: { id: taskListId },
      include: acceptedMembers,
    });
    return list ? listUserIds(list) : [];
  }
}
