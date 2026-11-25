'use client';

import { useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { getMembers, inviteMember, removeMember, type Member } from './actions';

/**
 * A list's people, in a modal <dialog> built like ConfirmDelete's. Loaded on
 * open; the owner can also invite by email and remove members or invites.
 */
export function MembersDialog({
  listId,
  title,
  owner,
  shared,
}: {
  listId: number;
  title: string;
  owner: boolean;
  shared: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const load = async () => {
    const result = await getMembers(listId);
    if ('error' in result) setError(result.error);
    else setMembers(result.members);
  };
  const run = (change: () => Promise<string | undefined>) =>
    startTransition(async () => {
      const failed = await change();
      setError(failed);
      if (!failed) await load();
    });

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(undefined);
          startTransition(load);
        }}
        className="btn-text"
      >
        Members
      </button>
      {open &&
        createPortal(
          <dialog
            ref={(el) => el?.showModal()}
            onClose={() => setOpen(false)}
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
            aria-labelledby="members-title"
            className="confirm stock"
          >
            <div className="flex flex-col gap-4 p-6">
              <h2 id="members-title" className="display text-2xl">
                Members of “{title}”
              </h2>
              {members ? (
                <ul className="flex flex-col gap-2">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">
                          {m.name ?? m.email}
                          {m.role === 'owner' && (
                            <span className="tag ml-2">owner</span>
                          )}
                          {!m.acceptedAt && m.role !== 'owner' && (
                            <span className="tag ml-2">pending</span>
                          )}
                        </span>
                        <span className="truncate text-sm text-muted">
                          {m.email}
                        </span>
                      </div>
                      {owner && m.role !== 'owner' && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => removeMember(listId, m.id))}
                          aria-label={`${m.acceptedAt ? 'Remove' : 'Cancel invite of'} ${m.email}`}
                          className="btn-text"
                        >
                          {m.acceptedAt ? 'Remove' : 'Cancel invite'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                !error && <p className="text-muted">Loading…</p>
              )}
              {owner && (
                <form
                  action={(form) =>
                    run(() =>
                      inviteMember(listId, String(form.get('email') ?? '')),
                    )
                  }
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-start gap-2">
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="Email address"
                      aria-label="Invite by email"
                      className="field flex-1"
                    />
                    <button disabled={pending} className="btn-quiet">
                      Invite
                    </button>
                  </div>
                  {!shared && (
                    <p className="text-sm text-muted">
                      Sharing is permanent: tasks can&apos;t be moved out of a
                      shared list.
                    </p>
                  )}
                </form>
              )}
              <p aria-live="polite" className="text-sm text-danger">
                {error}
              </p>
            </div>
            <div className="dialog-foot">
              <button
                autoFocus
                onClick={() => setOpen(false)}
                className="btn-quiet"
              >
                Close
              </button>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
