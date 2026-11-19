import { z } from 'zod';

export const createUserSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;

export const createUserResponseSchema = z.object({
  id: z.number().int(),
  name: z.string().nullable(),
  email: z.email(),
});

export type CreateUserResponse = z.infer<typeof createUserResponseSchema>;
