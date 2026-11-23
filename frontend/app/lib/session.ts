import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { backendFetch } from './backend';

export type TokenPair = {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
};

const base = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
} as const;

/** The two session cookies for a fresh token pair, ready for `cookies.set()`. */
export function sessionCookies(tokens: TokenPair) {
  return [
    // Expire the cookie 30s before the JWT so the proxy refreshes before the backend rejects it.
    {
      ...base,
      name: 'access_token',
      value: tokens.accessToken,
      maxAge: tokens.expiresIn - 30,
    },
    // Matches the backend's refreshToken ttl (30d, app.module.ts); TokenPair doesn't carry it.
    {
      ...base,
      name: 'refresh_token',
      value: tokens.refreshToken,
      maxAge: 30 * 24 * 60 * 60,
    },
  ];
}

/** The access token, or a redirect to /login. proxy.ts refreshes it before pages run. */
export async function requireToken() {
  const token = (await cookies()).get('access_token')?.value;
  if (!token) redirect('/login');
  return token;
}

/**
 * The logged-in user's id, from the access token's `sub`. Not verified here:
 * only for picking what to show, as the backend checks every request.
 */
export async function currentUserId() {
  const payload = (await requireToken()).split('.')[1];
  return Number(JSON.parse(Buffer.from(payload, 'base64url').toString()).sub);
}

/** backendFetch as the logged-in user; any 401 sends the user to /login. */
export async function authFetch(path: string, init: RequestInit = {}) {
  const res = await backendFetch(path, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${await requireToken()}`,
    },
  });
  if (res.status === 401) redirect('/login');
  return res;
}
