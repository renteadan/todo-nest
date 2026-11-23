import { z } from 'zod';

// No userId: the owner is the signed-in user, never the request body.
export const createTasklistSchema = z.strictObject({
  title: z.string().trim().min(1).max(50),
});

export type CreateTasklistDto = z.infer<typeof createTasklistSchema>;
