'use client';

import { useActionState } from 'react';
import { createTask } from './actions';

const input =
  'rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700';

export function CreateTaskForm() {
  const [state, action, pending] = useActionState(createTask, {});

  return (
    <form action={action} className="flex flex-col gap-2">
      <input
        name="title"
        required
        placeholder="What needs doing?"
        aria-label="Task title"
        className={input}
      />
      <input
        name="description"
        placeholder="Details (optional)"
        aria-label="Task description"
        className={input}
      />
      <p aria-live="polite" className="text-sm text-red-600">
        {state.error}
      </p>
      <button
        disabled={pending}
        className="self-start rounded-full bg-foreground px-5 py-2 font-medium text-background disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Create task'}
      </button>
    </form>
  );
}
