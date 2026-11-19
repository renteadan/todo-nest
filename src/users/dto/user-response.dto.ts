import { z } from 'zod';

export const userResponseSchema = z.object({
  id: z.number().int(),
  name: z.string().nullable(),
  email: z.email(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
