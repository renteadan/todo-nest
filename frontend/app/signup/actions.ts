'use server';

import { postJson } from '../lib/backend';

export type SignupState = { error?: string; success?: boolean };

export async function signup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  // The backend validates with zod (registerUserSchema); its message is shown as-is.
  const result = await postJson('/auth/register', {
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  return 'error' in result ? result : { success: true };
}
