import { type WsAuthenticator } from '@nestjs/authentication';
import { type PrismaService } from '../prisma/prisma.service.js';
import { type Task } from '../generated/prisma/client.js';
import { TaskGateway } from './task.gateway.js';

const task = (taskListId: number | null) =>
  ({ id: 5, userId: 1, taskListId, completedAt: null }) as Task;

describe('TaskGateway.taskStatusChanged', () => {
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

  it('notifies the users of the task’s list', async () => {
    findUnique.mockResolvedValue({ userId: 7 });
    await gateway.taskStatusChanged(task(3));
    expect(server.to).toHaveBeenCalledWith(['user:7']);
    expect(emit).toHaveBeenCalledWith('task.status', task(3));
  });

  it('notifies the task’s owner when it is in no list', async () => {
    await gateway.taskStatusChanged(task(null));
    expect(server.to).toHaveBeenCalledWith(['user:1']);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('never throws: the change is already saved', async () => {
    findUnique.mockRejectedValue(new Error('db down'));
    await expect(gateway.taskStatusChanged(task(3))).resolves.toBeUndefined();
    expect(emit).not.toHaveBeenCalled();
  });
});
