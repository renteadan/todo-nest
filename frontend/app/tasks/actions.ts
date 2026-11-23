'use server';

import { refresh } from 'next/cache';
import { postJson } from '../lib/backend';
import { authFetch, requireToken } from '../lib/session';

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
  await patch(`/task/${id}`, { completed: done });
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

async function patch(path: string, body: unknown) {
  const res = await authFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Saving failed (${res.status})`);
  refresh();
}

// The backend validates every field again; these only pick which one to send.
export async function renameTask(id: number, title: string) {
  await patch(`/task/${id}`, { title });
}

/** Empty details are stored as none. */
export async function setTaskDetails(id: number, details: string) {
  await patch(`/task/${id}`, { description: details.trim() ? details : null });
}

/** `deadline` is a UTC ISO time, converted in the browser; empty clears it. */
export async function setTaskDeadline(id: number, deadline: string) {
  await patch(`/task/${id}`, { deadline: deadline || null });
}

export async function renameTasklist(id: number, title: string) {
  await patch(`/tasklist/${id}`, { title });
}

/** Deletes the task, completed or not. */
export async function deleteTask(id: number) {
  const res = await authFetch(`/task/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Deleting the task failed (${res.status})`);
  refresh();
}

/** Deletes the list; its tasks stay, outside any list. */
export async function deleteTasklist(id: number) {
  const res = await authFetch(`/tasklist/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Deleting the list failed (${res.status})`);
  refresh();
}

/** Moves the task into `toListId`, or out of `fromListId` when it is null. */
export async function moveTask(
  taskId: number,
  fromListId: number | null,
  toListId: number | null,
) {
  if (toListId === fromListId) return;
  const res = toListId
    ? await authFetch(`/tasklist/${toListId}/task/${taskId}`, {
        method: 'POST',
      })
    : await authFetch(`/tasklist/${fromListId}/task/${taskId}`, {
        method: 'DELETE',
      });
  if (!res.ok) throw new Error(`Moving the task failed (${res.status})`);
  refresh();
}

/**
 * For the browser's socket.io handshake. Runs through proxy.ts, so an expired
 * token is refreshed first. Exposing the short-lived token to JS is accepted.
 */
export async function getAccessToken() {
  return requireToken();
}
