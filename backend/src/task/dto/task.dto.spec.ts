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
    // Completion is `completed`; the server picks the time.
    expect(updateTaskSchema.safeParse({ completed: true }).success).toBe(true);
    expect(updateTaskSchema.safeParse({ completed: 'yes' }).success).toBe(
      false,
    );
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

  it('takes an optional deadline as an instant, with its zone', () => {
    const deadline = (d: unknown) =>
      createTaskSchema.safeParse({ title: 'a', deadline: d });
    expect(deadline('2026-12-01T17:30:00Z').data?.deadline).toEqual(
      new Date('2026-12-01T17:30:00Z'),
    );
    // An offset is turned into the same UTC instant.
    expect(deadline('2026-12-01T19:30:00+02:00').data?.deadline).toEqual(
      new Date('2026-12-01T17:30:00Z'),
    );
    expect(createTaskSchema.safeParse({ title: 'a' }).success).toBe(true);
    expect(updateTaskSchema.parse({ deadline: null }).deadline).toBeNull();
    // No zone means no instant: whose 10:00?
    expect(deadline('2026-12-01T10:00').success).toBe(false);
    expect(deadline('2026-12-01').success).toBe(false);
    expect(deadline('2026-02-30T10:00:00Z').success).toBe(false);
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
