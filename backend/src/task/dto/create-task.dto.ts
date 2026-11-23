import { z } from 'zod';

// No taskListId: tasks move in and out of lists only through
// POST/DELETE /tasklist/:id/task/:taskId. No userId: the owner is the signed-in user.
export const createTaskSchema = z.strictObject({
  title: z.string().trim().min(1).max(50),
  description: z.string().max(200).nullish(),
  /** An ISO date-time with `Z` or an offset, e.g. `2026-12-01T17:00:00Z`; null clears it. */
  deadline: z.iso
    .datetime({ offset: true })
    .transform((d) => new Date(d))
    .nullish(),
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;
