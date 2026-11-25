import { LiveUpdates } from './(app)/tasks/live-updates';
import { BellButton, InviteActions } from './bell-buttons';
import { authFetch } from './lib/session';

type Notification = { id: number; createdAt: string; readAt: string | null } & (
  | {
      type: 'INVITE';
      data: { taskListId: number; listTitle: string; actorName: string };
    }
  | {
      type: 'TASK_COMPLETED';
      data: {
        taskListId: number;
        listTitle: string;
        taskTitle: string;
        actorName: string;
      };
    }
);

/**
 * The navbar's notification feed, server-rendered. Also keeps every logged-in
 * page live: a pushed event (a new notification too) re-renders the page.
 */
export async function NotificationBell() {
  const [feedRes, listsRes] = await Promise.all([
    authFetch('/notification'),
    authFetch('/tasklist'),
  ]);
  const feed: Notification[] = feedRes.ok ? await feedRes.json() : [];
  // An invite stays answerable until its list is joined, read or not.
  const joined = new Set(
    listsRes.ok
      ? ((await listsRes.json()) as { id: number }[]).map((l) => l.id)
      : [],
  );
  const unread = feed.filter((n) => !n.readAt).length;

  return (
    <>
      {process.env.BACKEND_PUBLIC_URL && (
        <LiveUpdates url={process.env.BACKEND_PUBLIC_URL} />
      )}
      <BellButton unread={unread} />
      <div id="notifications" popover="auto" className="menu feed">
        {feed.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted">No notifications yet.</p>
        ) : (
          <ul className="flex flex-col">
            {feed.map((n) => (
              <li key={n.id} className="feed-item">
                {n.type === 'INVITE' ? (
                  <>
                    <p>
                      <b>{n.data.actorName}</b> invited you to{' '}
                      <b>{n.data.listTitle}</b>
                    </p>
                    {joined.has(n.data.taskListId) ? (
                      <span className="text-sm text-muted">Joined</span>
                    ) : (
                      <InviteActions listId={n.data.taskListId} />
                    )}
                  </>
                ) : (
                  <p>
                    <b>{n.data.actorName}</b> completed{' '}
                    <b>{n.data.taskTitle}</b> in <b>{n.data.listTitle}</b>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
