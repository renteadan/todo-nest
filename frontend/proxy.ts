import { NextResponse, type NextRequest } from 'next/server';
import { postJson } from './app/lib/backend';
import { sessionCookies, type TokenPair } from './app/lib/session';

/**
 * Guards the logged-in pages. A live access token passes; an expired one is
 * swapped for a new pair via the refresh token; no session goes to /login.
 */
export async function proxy(request: NextRequest) {
  if (request.cookies.has('access_token')) return NextResponse.next();

  const refreshToken = request.cookies.get('refresh_token')?.value;
  const result = refreshToken
    ? await postJson<TokenPair>('/auth/refresh', { refreshToken })
    : null;

  if (!result || 'error' in result) {
    // A Server Action can't follow a 307 (it would re-POST the action to /login),
    // so let it through: its requireToken() then redirects the client router.
    const response = request.headers.has('next-action')
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('refresh_token');
    return response;
  }

  const cookies = sessionCookies(result.data);
  // Also set them on the forwarded request so this render already sees the new token.
  for (const c of cookies) request.cookies.set(c.name, c.value);
  const response = NextResponse.next({ request: { headers: request.headers } });
  for (const c of cookies) response.cookies.set(c);
  return response;
}

export const config = {
  matcher: ['/tasks/:path*'],
};
