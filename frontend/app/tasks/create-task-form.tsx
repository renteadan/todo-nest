'use client';

import { useActionState } from 'react';
import { createTask } from './actions';
import { LimitedInput } from './limited-input';
import { localToUtc } from './local-time';

export function CreateTaskForm() {
  const [state, action, pending] = useActionState(createTask, {});

  return (
    <form
      action={(formData) => {
        // Here, in the browser: the server action doesn't know the user's zone.
        formData.set(
          'deadline',
          localToUtc(String(formData.get('deadlineLocal') ?? '')),
        );
        action(formData);
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <LimitedInput
          name="title"
          required
          placeholder="What needs doing?"
          aria-label="Task title"
          max={50}
          trim
          noun="Task names"
          className="flex-1 text-lg"
        />
        <button disabled={pending} className="btn">
          {pending ? 'Adding…' : 'Add task'}
        </button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <LimitedInput
          name="description"
          placeholder="Details (optional)"
          aria-label="Task description"
          max={200}
          noun="Details"
          className="flex-1 text-sm"
        />
        <input
          type="datetime-local"
          name="deadlineLocal"
          aria-label="Deadline (optional)"
          title="Deadline (optional)"
          className="field text-sm"
        />
      </div>
      <p aria-live="polite" className="text-sm text-danger">
        {state.error}
      </p>
    </form>
  );
}
