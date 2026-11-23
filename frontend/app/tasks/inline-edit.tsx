'use client';

import {
  useId,
  useOptimistic,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';
import { reportError } from './action-error';
import { localToUtc, utcToLocal } from './local-time';

type Limits = {
  /** The backend's zod limits: `trim` when it trims before counting. */
  max: number;
  trim?: boolean;
  required?: boolean;
  /** "Task names", "Details"…, for the warning. */
  noun: string;
};

/** Why `value` would be rejected by the backend, or null when it is fine. */
function problem(value: string, { max, trim, required, noun }: Limits) {
  const v = trim ? value.trim() : value;
  if (required && !v.trim()) return `${noun} can't be empty.`;
  if (v.length > max)
    return `${noun} can be at most ${max} characters (${v.length - max} too many).`;
  return null;
}

/**
 * The input of an inline edit: Enter or leaving the field saves, Esc cancels.
 * Saving is skipped when nothing changed; an invalid value keeps the field open
 * on Enter and is dropped when the field is left.
 */
export function InlineInput({
  initial,
  label,
  placeholder,
  className,
  onCommit,
  onDone,
  ...limits
}: Limits & {
  initial: string;
  label: string;
  placeholder?: string;
  className?: string;
  onCommit: (value: string) => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(initial);
  const warningId = useId();
  const error = problem(value, limits);
  // Esc unmounts the focused input, which fires blur: don't save then.
  const cancelled = useRef(false);

  const commit = () => {
    if (cancelled.current) return;
    if (!error && value !== initial) onCommit(value);
    onDone();
  };

  return (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <input
        autoFocus
        value={value}
        aria-label={label}
        placeholder={placeholder}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? warningId : undefined}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !error) e.currentTarget.blur();
          if (e.key === 'Escape') {
            e.preventDefault();
            cancelled.current = true;
            onDone();
          }
        }}
        className={`inline-field ${className ?? ''}`}
      />
      <span
        id={warningId}
        aria-live="polite"
        className="text-sm font-normal text-danger empty:hidden"
      >
        {error}
      </span>
    </span>
  );
}

const noSubscribe = () => () => {};

/**
 * A task's deadline: `value` and what `save` gets are UTC ISO times (or empty),
 * shown in the browser's local time. Saves when the field is left or on Enter,
 * not on every change: typing a year passes through years like 0002.
 */
export function EditableDateTime({
  value,
  save,
  label,
}: {
  value: string;
  save: (utc: string) => Promise<string | undefined>;
  label: string;
}) {
  const [shown, setShown] = useOptimistic(value);
  const [, startTransition] = useTransition();
  // Empty in the server render, which can't know the user's time zone.
  const local = useSyncExternalStore(
    noSubscribe,
    () => utcToLocal(shown),
    () => '',
  );

  return (
    <input
      // Remounts when the value changes: after hydration, or from another tab.
      key={local}
      type="datetime-local"
      defaultValue={local}
      aria-label={label}
      onBlur={(e) => {
        const v = e.currentTarget.value;
        if (v === local || !e.currentTarget.validity.valid) return;
        startTransition(async () => {
          setShown(localToUtc(v));
          reportError(await save(localToUtc(v)));
        });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      className={`editable text-sm text-muted ${shown ? '' : 'editable-empty'}`}
    />
  );
}

/**
 * Text that turns into an input when clicked, for a task's title or details.
 * Shows the new text right away while the save runs.
 */
export function EditableText({
  value,
  save,
  label,
  placeholder,
  className,
  ...limits
}: Limits & {
  value: string;
  save: (value: string) => Promise<string | undefined>;
  /** e.g. "Task name": the trigger is "Edit task name: …". */
  label: string;
  /** Shown (faintly, on row hover) when the value is empty. */
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useOptimistic(value);
  const [, startTransition] = useTransition();

  if (editing) {
    return (
      <InlineInput
        {...limits}
        initial={shown}
        label={label}
        placeholder={placeholder}
        className={className}
        onCommit={(v) =>
          startTransition(async () => {
            setShown(v);
            reportError(await save(v));
          })
        }
        onDone={() => setEditing(false)}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={`Edit ${label.toLowerCase()}: ${shown || 'empty'}`}
      className={`editable ${shown ? '' : 'editable-empty'} ${className ?? ''}`}
    >
      {shown || placeholder}
    </button>
  );
}
