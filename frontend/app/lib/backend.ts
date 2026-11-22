import { unstable_rethrow } from 'next/navigation';

// Server-only: BACKEND_URL is not exposed to the browser.
export function backendFetch(path: string, init: RequestInit = {}) {
  return fetch(`${process.env.BACKEND_URL}${path}`, init);
}

/** POSTs JSON; returns the parsed body, or a user-facing error message. */
export async function postJson<T>(
  path: string,
  body: unknown,
  fetcher: typeof backendFetch = backendFetch,
): Promise<{ data: T } | { error: string }> {
  const res = await fetcher(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((e) => {
    unstable_rethrow(e); // let authFetch's redirect('/login') through
    return null;
  });
  if (!res) return { error: 'Could not reach the server. Try again later.' };

  const json = await res.json().catch(() => ({}));
  if (res.ok) return { data: json };
  // Nest errors carry `message` as a string or, for validation, a string[].
  return { error: [json.message].flat().join(', ') || 'Something went wrong.' };
}
