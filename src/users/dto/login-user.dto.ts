import { z } from 'zod';

export const loginUserSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginUserDto = z.infer<typeof loginUserSchema>;
