import { z } from 'zod';

export const inviteMemberSchema = z.strictObject({ email: z.email() });

export type InviteMemberDto = z.infer<typeof inviteMemberSchema>;
