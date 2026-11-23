'use client';

import { useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { reportError } from './action-error';

/**
 * A delete button that asks first, in a modal <dialog>. The dialog is portaled
 * to <body> so it is not inside a draggable task row, and it only exists while
 * open, so the portal never runs on the server.
 */
export function ConfirmDelete({
  action,
  title,
  message,
  label,
  className,
  children,
}: {
  action: () => Promise<string | undefined>;
  title: string;
  message: string;
  /** Accessible name of the trigger, for icon-only buttons. */
  label?: string;
  className: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <dialog
            ref={(el) => el?.showModal()}
            onClose={() => setOpen(false)}
            // A click on the backdrop lands on the dialog itself.
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
            aria-labelledby="confirm-title"
            className="confirm"
          >
            <div className="flex flex-col gap-2 p-6">
              <h2 id="confirm-title" className="display text-2xl">
                {title}
              </h2>
              <p className="text-muted">{message}</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-line bg-background px-6 py-4">
              <button
                autoFocus
                onClick={() => setOpen(false)}
                className="btn-quiet"
              >
                Cancel
              </button>
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    reportError(await action());
                    setOpen(false);
                  })
                }
                className="btn-delete"
              >
                {pending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
