'use client';

import { useActionState, useState } from 'react';
import { createTask } from './actions';
import { DateTimePicker } from './date-picker';
import { LimitedInput } from './limited-input';
import { localToUtc } from './local-time';

export function CreateTaskForm() {
  const [state, action, pending] = useActionState(createTask, {});
  const [deadline, setDeadline] = useState('');

  return (
    <form
      // React resets the form after the action; follow along.
      onReset={() => setDeadline('')}
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
        <input type="hidden" name="deadlineLocal" value={deadline} />
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
        {state.error}
      </p>
    </form>
  );
}
