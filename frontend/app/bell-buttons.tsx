'use client';

import { useTransition } from 'react';
import { reportError } from './(app)/tasks/action-error';
import { acceptInvite, markAllRead, removeMember } from './(app)/tasks/actions';

/** Opens the feed; opening it marks everything read. */
export function BellButton({ unread }: { unread: number }) {
  return (
    <button
      type="button"
      popoverTarget="notifications"
      onClick={() => {
        if (unread > 0) void markAllRead();
      }}
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      className="profile-btn bell-btn"
    >
      <svg viewBox="0 0 20 20" aria-hidden className="size-5" fill="none">
        <path
          d="M5 8a5 5 0 0 1 10 0v3.5l1.5 2.5h-13L5 11.5z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M8 16.5a2 2 0 0 0 4 0"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      {unread > 0 && (
        <span aria-hidden className="bell-count">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}

/** Accept or decline an invite to a list the user hasn't joined. */
export function InviteActions({ listId }: { listId: number }) {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<string | undefined>) =>
    startTransition(async () => reportError(await action()));
  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => acceptInvite(listId))}
        className="btn min-h-8 px-3"
      >
        Accept
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => removeMember(listId, 'me'))}
        className="btn-quiet min-h-8 px-3"
      >
        Decline
      </button>
    </div>
  );
}
