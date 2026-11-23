'use client';

import { useEffect, useId, useRef, useState } from 'react';

// Dates here are local `YYYY-MM-DD`; the full value is `YYYY-MM-DDTHH:mm`,
// the same shape <input type="datetime-local"> used (see local-time.ts).
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (day: string, n: number) => {
  const d = toDate(day);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
const addMonths = (day: string, n: number) => {
  const d = toDate(day);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  // Clamp: Jan 31 + 1 month is the last day of February, not March 3.
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0);
  target.setDate(Math.min(d.getDate(), last.getDate()));
  return ymd(target);
};

/** `2026-12-01T18:30` → "Tue, 1 Dec, 18:30" in the browser's locale. */
export function formatLocal(local: string) {
  const d = new Date(local);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DEFAULT_TIME = '09:00';

/**
 * A button that opens a calendar with a time field. Nothing changes until the
 * ✓ button (or Enter in the time field); Esc, ✕ or clicking outside cancel.
 */
export function DateTimePicker({
  value,
  onChange,
  label,
  placeholder,
  triggerClassName,
  align = 'start',
}: {
  /** Local `YYYY-MM-DDTHH:mm`, or empty. */
  value: string;
  onChange: (local: string) => void;
  label: string;
  placeholder: string;
  triggerClassName?: string;
  /** Which edge of the trigger the panel lines up with. */
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState(DEFAULT_TIME);
  // The keyboard-focused day; the calendar shows its month.
  const [cursor, setCursor] = useState('');
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);
  const panelId = useId();

  // Set on open: rendering `new Date()` would break prerendering.
  const [today, setToday] = useState('');

  const show = () => {
    const [d, t] = value ? value.split('T') : ['', DEFAULT_TIME];
    setDate(d);
    setTime(t);
    const now = ymd(new Date());
    setToday(now);
    setCursor(d || now);
    moveFocus.current = true;
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  const confirm = () => {
    if (!date) return;
    onChange(`${date}T${time || DEFAULT_TIME}`);
    close();
  };

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false;
    grid.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${cursor}"]`)
      ?.focus();
  }, [open, cursor]);

  const go = (day: string) => {
    moveFocus.current = true;
    setCursor(day);
  };

  const pick = (day: string) => {
    setDate(day);
    go(day);
  };

  // The calendar only renders while open, when `cursor` is set.
  const view = toDate(cursor || '1970-01-01');
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  // Weeks start on Monday.
  const start = addDays(ymd(first), -((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weekdays = days
    .slice(0, 7)
    .map((d) => toDate(d).toLocaleDateString(undefined, { weekday: 'narrow' }));

  return (
    <span ref={root} className="relative inline-flex">
      <button
        ref={trigger}
        type="button"
        onClick={() => (open ? close() : show())}
        aria-label={`${label}: ${value ? formatLocal(value) : 'none'}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap ${triggerClassName ?? ''}`}
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 shrink-0">
          <rect
            x="2"
            y="3"
            width="12"
            height="11"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M2 6.5h12M5 1.5v3M11 1.5v3"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        {value ? formatLocal(value) : placeholder}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
          className={`picker ${align === 'end' ? 'right-0' : 'left-0'}`}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => go(addMonths(cursor, -1))}
              aria-label="Previous month"
              className="picker-nav"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="size-4">
                <path
                  d="M10 3L5 8l5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>
            <span aria-live="polite" className="display text-lg">
              {view.toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <button
              type="button"
              onClick={() => go(addMonths(cursor, 1))}
              aria-label="Next month"
              className="picker-nav"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="size-4">
                <path
                  d="M6 3l5 5-5 5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>
          </div>

          <div
            ref={grid}
            className="grid grid-cols-7 gap-0.5 text-center"
            onKeyDown={(e) => {
              const step = {
                ArrowLeft: -1,
                ArrowRight: 1,
                ArrowUp: -7,
                ArrowDown: 7,
              }[e.key];
              if (step) {
                e.preventDefault();
                go(addDays(cursor, step));
              } else if (e.key === 'PageUp' || e.key === 'PageDown') {
                e.preventDefault();
                go(addMonths(cursor, e.key === 'PageUp' ? -1 : 1));
              }
            }}
          >
            {weekdays.map((w, i) => (
              <span
                key={i}
                aria-hidden
                className="py-1 text-xs font-medium text-muted"
              >
                {w}
              </span>
            ))}
            {days.map((d) => (
              <button
                key={d}
                type="button"
                data-day={d}
                tabIndex={d === cursor ? 0 : -1}
                onClick={() => pick(d)}
                aria-pressed={d === date}
                aria-label={toDate(d).toLocaleDateString(undefined, {
                  dateStyle: 'full',
                })}
                aria-current={d === today ? 'date' : undefined}
                data-outside={
                  toDate(d).getMonth() !== view.getMonth() || undefined
                }
                className="picker-day"
              >
                {toDate(d).getDate()}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['Today', 0],
                ['Tomorrow', 1],
                ['In a week', 7],
              ] as const
            ).map(([name, n]) => (
              <button
                key={name}
                type="button"
                onClick={() => pick(addDays(today, n))}
                className="picker-chip"
              >
                {name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 border-t border-line pt-3">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirm();
                }
              }}
              aria-label="Time"
              className="field picker-time"
            />
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  close();
                }}
                className="text-sm font-medium text-muted hover:text-danger"
              >
                Clear
              </button>
            )}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => close()}
              aria-label="Cancel"
              title="Cancel"
              className="picker-nav"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="size-4">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={!date}
              aria-label="Set date"
              title={date ? 'Set date' : 'Pick a day first'}
              className="picker-ok"
            >
              <svg viewBox="0 0 16 16" aria-hidden className="size-4">
                <path
                  d="M3 8.5l3.5 3.5L13 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
