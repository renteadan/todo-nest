'use client';

import { useEffect, useState } from 'react';

const EVENT = 'action-error';

/** Shows an action's failure message in <ActionErrors>; nothing when it worked. */
export function reportError(error: string | undefined) {
  if (error) window.dispatchEvent(new CustomEvent(EVENT, { detail: error }));
}

/** The last failed change, announced to screen readers until dismissed. */
export function ActionErrors() {
  const [error, setError] = useState<string>();
  useEffect(() => {
    const show = (e: Event) => setError((e as CustomEvent<string>).detail);
    window.addEventListener(EVENT, show);
    return () => window.removeEventListener(EVENT, show);
  }, []);

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-10 mx-auto flex w-fit max-w-md items-center gap-3 rounded-lg bg-danger px-4 py-2 text-sm text-white shadow-lg empty:hidden"
    >
      {error && (
        <>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(undefined)}
            className="font-medium underline-offset-4 hover:underline"
          >
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}
