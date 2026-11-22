import { createTasklistSchema } from '../../tasklist/dto/create-tasklist.dto.js';
import { createTaskSchema } from './create-task.dto.js';
import { updateTaskSchema } from './update-task.dto.js';

describe('task and tasklist DTOs', () => {
  it('rejects blank titles and fields the client must not set', () => {
    expect(createTaskSchema.safeParse({ title: 'a' }).success).toBe(true);
    expect(createTaskSchema.safeParse({ title: ' ' }).success).toBe(false);
    // Moving between lists goes through the tasklist endpoints only.
    expect(
      createTaskSchema.safeParse({ title: 'a', taskListId: 1 }).success,
    ).toBe(false);
    expect(updateTaskSchema.safeParse({ taskListId: 1 }).success).toBe(false);
    expect(updateTaskSchema.safeParse({ id: 1 }).success).toBe(false);
    // Completion goes through /task/:id/complete only.
    expect(
      updateTaskSchema.safeParse({ completedAt: '2026-11-22T10:00:00Z' })
        .success,
    ).toBe(false);
    expect(
      createTasklistSchema.safeParse({ title: 'x', userId: 2 }).success,
    ).toBe(false);
  });
});
