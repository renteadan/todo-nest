'use client';

import { useState, useTransition } from 'react';
import { createTask } from './actions';
import { DateTimePicker } from './date-picker';
import { LimitedInput } from './limited-input';
import { localToUtc } from './local-time';

export function CreateTaskForm() {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [deadline, setDeadline] = useState('');

  return (
    <form
      // Not a form `action`: React would clear the fields even when the task
      // is rejected. Reset by hand, only on success.
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        // Here, in the browser: the server action doesn't know the user's zone.
        formData.set('deadline', localToUtc(deadline));
        startTransition(async () => {
          const result = await createTask({}, formData);
          setError(result.error);
          if (!result.error) {
            form.reset();
            setDeadline('');
          }
        });
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <LimitedInput
          name="title"
          required
          placeholder="What needs doing?"
          aria-label="Task title"
          max={50}
          trim
          noun="Task names"
          className="capture flex-1"
        />
        <button disabled={pending} className="btn min-h-12">
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="size-3.5 shrink-0"
          >
            <path d="M8 3v10M3 8h10" />
          </svg>
          {pending ? 'Adding…' : 'Add task'}
        </button>
      </div>
      <div className="capture-meta flex flex-col gap-3 sm:flex-row sm:items-start">
        <LimitedInput
          name="description"
          placeholder="Details (optional)"
          aria-label="Task description"
          max={200}
          noun="Details"
          className="flex-1 text-sm"
        />
        <DateTimePicker
          value={deadline}
          onChange={setDeadline}
          label="Deadline (optional)"
          placeholder="Deadline (optional)"
          align="end"
          triggerClassName={`field text-sm ${deadline ? '' : 'text-muted'}`}
        />
      </div>
      <p aria-live="polite" className="text-sm text-danger">
        {error}
      </p>
    </form>
  );
}
