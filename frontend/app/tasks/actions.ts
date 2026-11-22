'use server';

import { refresh } from 'next/cache';
import { postJson } from '../lib/backend';
import { authFetch } from '../lib/session';

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
    },
    authFetch,
  );
  if ('error' in result) return result;
  refresh();
  return {};
}

/** Completes the task, or undoes the completion when `done` is false. */
export async function setCompleted(id: number, done: boolean) {
  const res = await authFetch(`/task/${id}/complete`, {
    method: done ? 'POST' : 'DELETE',
  });
  if (!res.ok) throw new Error(`Updating the task failed (${res.status})`);
  refresh();
}
