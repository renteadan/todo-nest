import { z } from 'zod';

// No taskListId: tasks move in and out of lists only through
// POST/DELETE /tasklist/:id/task/:taskId. No userId: the owner is the signed-in user.
export const createTaskSchema = z.strictObject({
  title: z.string().trim().min(1),
  description: z.string().nullish(),
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;
