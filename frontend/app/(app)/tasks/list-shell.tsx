'use client';

import {
  useOptimistic,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';
import { reportError } from './action-error';
import { InlineInput } from './inline-edit';

type Prefs = { open: boolean; showDone: boolean };
const DEFAULTS: Prefs = { open: true, showDone: false };
const EVENT = 'list-prefs';

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange); // other tabs
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** A list's collapsed / show-completed state, kept in localStorage per list. */
function useListPrefs(key: string): [Prefs, (p: Partial<Prefs>) => void] {
  // The raw string is the snapshot: stable between renders, unlike parsed JSON.
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key),
    () => null,
  );
  let prefs = DEFAULTS;
  try {
    if (raw) prefs = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {} // a corrupt entry falls back to the defaults
  const set = (patch: Partial<Prefs>) => {
    localStorage.setItem(key, JSON.stringify({ ...prefs, ...patch }));
    window.dispatchEvent(new Event(EVENT));
  };
  return [prefs, set];
}

/**
 * A list section's header (collapse button, progress, "Show done" switch) and
 * body. Rendered by the server page around server-rendered rows.
 */
export function ListShell({
  storageKey,
  title,
  rename,
  titleClassName,
  badge,
  collapsible,
  progress,
  doneCount,
  footer,
  children,
}: {
  storageKey: string;
  title: string;
  /** Saves a new name; lists that can't be renamed (the Inbox) leave it out. */
  rename?: (title: string) => Promise<string | undefined>;
  titleClassName: string;
  /** Shown after the title, e.g. the "Shared" chip. */
  badge?: React.ReactNode;
  collapsible: boolean;
  progress: React.ReactNode;
  doneCount: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [prefs, setPrefs] = useListPrefs(`tasks:list:${storageKey}`);
  const open = !collapsible || prefs.open;
  const [editing, setEditing] = useState(false);
  const [shownTitle, setShownTitle] = useOptimistic(title);
  const [, startTransition] = useTransition();

  return (
    <div data-hide-done={!prefs.showDone || undefined}>
      <div className="section-head">
        {editing && rename ? (
          <h2 className={`display min-w-0 flex-1 ${titleClassName}`}>
            <InlineInput
              initial={shownTitle}
              label="List name"
              max={50}
              trim
              required
              noun="List names"
              onCommit={(v) =>
                startTransition(async () => {
                  setShownTitle(v);
                  reportError(await rename(v));
                })
              }
              onDone={() => setEditing(false)}
            />
          </h2>
        ) : (
          <h2
            className={`display flex min-w-0 flex-1 items-center gap-2 ${titleClassName}`}
          >
            {collapsible ? (
              <button
                aria-expanded={open}
                onClick={() => setPrefs({ open: !open })}
                className="flex min-w-0 items-center gap-2.5 text-left"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className={`size-3.5 shrink-0 text-muted transition-transform motion-reduce:transition-none ${open ? 'rotate-90' : ''}`}
                >
                  <path
                    d="M6 3l5 5-5 5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
                <span className="truncate">{shownTitle}</span>
              </button>
            ) : (
              shownTitle
            )}
            {badge}
            {rename && (
              <button
                type="button"
                aria-label={`Rename ${shownTitle}`}
                onClick={() => setEditing(true)}
                className="icon-quiet"
              >
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4"
                >
                  <path d="M10.5 2.5l3 3L6 13H3v-3z" />
                  <path d="M9 4l3 3" />
                </svg>
              </button>
            )}
          </h2>
        )}
        {progress}
        {doneCount > 0 && (
          <label className="switch-label">
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={prefs.showDone}
              onChange={(e) => setPrefs({ showDone: e.target.checked })}
            />
            Show done
          </label>
        )}
      </div>
      <div hidden={!open}>
        {children}
        {footer && (
          <div className="flex justify-end gap-3 px-1 pt-2">{footer}</div>
        )}
      </div>
    </div>
  );
}
