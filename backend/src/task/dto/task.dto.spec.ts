import { createTasklistSchema } from '../../tasklist/dto/create-tasklist.dto.js';
import { updateTasklistSchema } from '../../tasklist/dto/update-tasklist.dto.js';
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

  it('limits the title to 50 characters and the description to 200', () => {
    const ok = { title: 'a'.repeat(50), description: 'd'.repeat(200) };
    expect(createTaskSchema.safeParse(ok).success).toBe(true);
    // Surrounding spaces are trimmed before the title is measured.
    expect(createTaskSchema.safeParse({ title: ` ${ok.title} ` }).success).toBe(
      true,
    );
    expect(createTaskSchema.safeParse({ title: 'a'.repeat(51) }).success).toBe(
      false,
    );
    expect(
      createTaskSchema.safeParse({ title: 'a', description: 'd'.repeat(201) })
        .success,
    ).toBe(false);
    // Updates get the same limits.
    expect(updateTaskSchema.safeParse({ title: 'a'.repeat(51) }).success).toBe(
      false,
    );
    expect(
      updateTaskSchema.safeParse({ description: 'd'.repeat(201) }).success,
    ).toBe(false);
  });

  it('limits a task list title to 50 characters, on create and update', () => {
    expect(
      createTasklistSchema.safeParse({ title: 'a'.repeat(50) }).success,
    ).toBe(true);
    expect(
      createTasklistSchema.safeParse({ title: 'a'.repeat(51) }).success,
    ).toBe(false);
    expect(
      updateTasklistSchema.safeParse({ title: 'a'.repeat(51) }).success,
    ).toBe(false);
  });
});
