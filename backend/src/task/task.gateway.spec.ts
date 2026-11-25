import { type WsAuthenticator } from '@nestjs/authentication';
import { type PrismaService } from '../prisma/prisma.service.js';
import { type Task } from '../generated/prisma/client.js';
import { TaskGateway } from './task.gateway.js';
import { acceptedMembers } from './list-role.js';

const task = (taskListId: number | null) =>
  ({ id: 5, userId: 1, taskListId, completedAt: null }) as Task;

describe('TaskGateway', () => {
  const emit = vi.fn();
  const server = { to: vi.fn(() => ({ emit })) };
  const findUnique = vi.fn();
  let gateway: TaskGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = new TaskGateway(
      {} as WsAuthenticator,
      { taskList: { findUnique } } as unknown as PrismaService,
    );
    Object.assign(gateway, { server });
  });

  it('notifies the owner and accepted members of the task’s list', async () => {
    findUnique.mockResolvedValue({
      userId: 1,
      TaskListMember: [{ userId: 5 }],
    });
    await gateway.taskChanged('task.updated', task(10));
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 10 },
      include: acceptedMembers,
    });
    expect(server.to).toHaveBeenCalledWith(['user:1', 'user:5']);
    expect(emit).toHaveBeenCalledWith('task.updated', task(10));
  });

  it('notifies the task’s owner when it is in no list', async () => {
    await gateway.taskChanged('task.updated', task(null));
    expect(server.to).toHaveBeenCalledWith(['user:1']);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('never throws: the change is already saved', async () => {
    findUnique.mockRejectedValue(new Error('db down'));
    await expect(
      gateway.taskChanged('task.updated', task(3)),
    ).resolves.toBeUndefined();
    expect(emit).not.toHaveBeenCalled();
  });

  it('sends the list with its tasks to its owner and members', async () => {
    const list = {
      id: 10,
      userId: 1,
      TaskListMember: [{ userId: 5 }],
      Task: [task(10)],
    };
    findUnique.mockResolvedValue(list);
    await gateway.tasklistUpdated(10);
    expect(server.to).toHaveBeenCalledWith(['user:1', 'user:5']);
    expect(emit).toHaveBeenCalledWith('tasklist.updated', {
      id: 10,
      userId: 1,
      Task: [task(10)],
    });
    expect(emit.mock.lastCall?.[1]).not.toHaveProperty('TaskListMember');
  });

  it('sends nothing, and never throws, when the list is gone or the db fails', async () => {
    findUnique.mockResolvedValueOnce(null);
    await gateway.tasklistUpdated(3);
    findUnique.mockRejectedValueOnce(new Error('db down'));
    await expect(gateway.tasklistUpdated(3)).resolves.toBeUndefined();
    expect(emit).not.toHaveBeenCalled();
  });

  it('tells the given users a list was deleted', () => {
    gateway.tasklistDeleted(10, [1, 5]);
    expect(server.to).toHaveBeenCalledWith(['user:1', 'user:5']);
    expect(emit).toHaveBeenCalledWith('tasklist.deleted', { id: 10 });
  });

  it('sends nothing when there is nobody to tell', () => {
    // to([]) would reach every socket.
    gateway.tasklistDeleted(10, []);
    expect(server.to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('pushes each new notification to its user', () => {
    const row = { id: 2, userId: 5, type: 'invited' };
    gateway.notificationsCreated([row]);
    expect(server.to).toHaveBeenCalledWith('user:5');
    expect(emit).toHaveBeenCalledWith('notification.created', row);
  });

  it('never throws when an emit fails', () => {
    server.to.mockImplementationOnce(() => {
      throw new Error('adapter down');
    });
    expect(() => gateway.tasklistDeleted(10, [1])).not.toThrow();
    server.to.mockImplementationOnce(() => {
      throw new Error('adapter down');
    });
    expect(() => gateway.notificationsCreated([{ userId: 5 }])).not.toThrow();
  });
});
