import { z } from 'zod';

export const registerUserSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export type RegisterUserDto = z.infer<typeof registerUserSchema>;

export const registerUserResponseSchema = z.object({
  id: z.number().int(),
  name: z.string().nullable(),
  email: z.email(),
});

export type RegisterUserResponse = z.infer<typeof registerUserResponseSchema>;
