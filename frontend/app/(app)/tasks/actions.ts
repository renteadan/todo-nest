'use server';

import { refresh } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { postJson } from '../../lib/backend';
import { authFetch, requireToken } from '../../lib/session';

export type CreateTaskState = { error?: string };

export async function createTask(
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const result = await postJson(
    '/task',
    {
      title: formData.get('title'),
      description: formData.get('description') || null,
      deadline: formData.get('deadline') || null,
    },
    authFetch,
  );
  if ('error' in result) return result;
  refresh();
  return {};
}

/** Completes the task, or undoes the completion when `done` is false. */
export async function setCompleted(id: number, done: boolean) {
  return patch(`/task/${id}`, { completed: done });
}

export async function createTasklist(
  _prev: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const result = await postJson(
    '/tasklist',
    { title: formData.get('title') },
    authFetch,
  );
  if ('error' in result) return result;
  refresh();
  return {};
}

/**
 * Sends a change; returns the backend's message when it fails, so the browser
 * can show it (a thrown error would replace the page, its message redacted).
 * Refreshes either way: a failure often means this page was out of date.
 */
async function send(path: string, init: RequestInit) {
  const res = await authFetch(path, init).catch((e) => {
    unstable_rethrow(e); // authFetch's redirect('/login')
    return null;
  });
  refresh();
  if (!res) return 'Could not reach the server. Try again later.';
  if (res.ok) return undefined;
  const json = await res.json().catch(() => ({}));
  // Nest errors carry `message` as a string or, for validation, a string[].
  return (
    [json.message].flat().join(', ') || `Something went wrong (${res.status}).`
  );
}

function patch(path: string, body: unknown) {
  return send(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// The backend validates every field again; these only pick which one to send.
export async function renameTask(id: number, title: string) {
  return patch(`/task/${id}`, { title });
}

/** Empty details are stored as none. */
export async function setTaskDetails(id: number, details: string) {
  return patch(`/task/${id}`, {
    description: details.trim() ? details : null,
  });
}

/** `deadline` is a UTC ISO time, converted in the browser; empty clears it. */
export async function setTaskDeadline(id: number, deadline: string) {
  return patch(`/task/${id}`, { deadline: deadline || null });
}

export async function renameTasklist(id: number, title: string) {
  return patch(`/tasklist/${id}`, { title });
}

/** Deletes the task, completed or not. */
export async function deleteTask(id: number) {
  return send(`/task/${id}`, { method: 'DELETE' });
}

/** Deletes the list; its tasks stay, outside any list. */
export async function deleteTasklist(id: number) {
  return send(`/tasklist/${id}`, { method: 'DELETE' });
}

/**
 * Moves the task into `toListId`, or out of `fromListId` when it is null.
 * `fromListId` can be stale (moved in another tab): the backend then says the
 * task isn't in that list, and the refresh shows where it is.
 */
export async function moveTask(
  taskId: number,
  fromListId: number | null,
  toListId: number | null,
) {
  if (toListId === fromListId) return;
  return toListId
    ? send(`/tasklist/${toListId}/task/${taskId}`, { method: 'POST' })
    : send(`/tasklist/${fromListId}/task/${taskId}`, { method: 'DELETE' });
}

/**
 * For the browser's socket.io handshake. Runs through proxy.ts, so an expired
 * token is refreshed first. Exposing the short-lived token to JS is accepted.
 */
export async function getAccessToken() {
  return requireToken();
}

export type Member = {
  id: number;
  name: string | null;
  email: string;
  role: 'owner' | 'member';
  /** null = invite not accepted yet. */
  acceptedAt: string | null;
};

/** The list's owner first, then members and pending invites. */
export async function getMembers(
  listId: number,
): Promise<{ members: Member[] } | { error: string }> {
  const res = await authFetch(`/tasklist/${listId}/member`).catch((e) => {
    unstable_rethrow(e);
    return null;
  });
  if (!res?.ok) return { error: 'Could not load the members.' };
  return { members: await res.json() };
}

/** The first invite makes the list shared for good. */
export async function inviteMember(listId: number, email: string) {
  return send(`/tasklist/${listId}/member`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

/** Kicks a member or cancels an invite; `'me'` leaves the list or declines. */
export async function removeMember(listId: number, userId: number | 'me') {
  return send(`/tasklist/${listId}/member/${userId}`, { method: 'DELETE' });
}

export async function acceptInvite(listId: number) {
  return send(`/tasklist/${listId}/member/me/accept`, { method: 'POST' });
}

export async function markAllRead() {
  return send('/notification/read-all', { method: 'POST' });
}
