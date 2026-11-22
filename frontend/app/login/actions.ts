'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { postJson } from '../lib/backend';
import { sessionCookies, type TokenPair } from '../lib/session';

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const result = await postJson<TokenPair>('/auth/login', {
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if ('error' in result) return result;

  const jar = await cookies();
  for (const c of sessionCookies(result.data)) jar.set(c);
  redirect('/tasks');
}

/** Revokes the refresh token on the backend, then clears both session cookies. */
export async function logout() {
  const jar = await cookies();
  const refreshToken = jar.get('refresh_token')?.value;
  // Cookies are cleared even if the backend is unreachable; the token then just expires.
  if (refreshToken) await postJson('/auth/logout', { refreshToken });
  jar.delete('access_token');
  jar.delete('refresh_token');
  redirect('/login');
}
