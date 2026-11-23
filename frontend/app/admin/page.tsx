import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { authFetch } from '../lib/session';
import { Navbar } from '../navbar';
import { LocalTime } from './local-time';

type User = { id: number; name: string | null; email: string; role: string };

type Task = {
  id: number;
  title: string;
  description: string | null;
  completedAt: string | null;
  /** UTC ISO time. */
  deadline: string | null;
  taskListId: number | null;
  userId: number;
};

type Tasklist = { id: number; title: string };

export default function AdminPage({ searchParams }: PageProps<'/admin'>) {
  return (
    <>
      <Navbar />
      <main className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-8 px-5 py-10 sm:py-12 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-x-10">
        {/* All of it, title included, waits for the admin check, so a
            non-admin sees none of the page. */}
        <Suspense fallback={<p className="text-muted">Loading…</p>}>
          <Board searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Board({
  searchParams,
}: {
  searchParams: PageProps<'/admin'>['searchParams'];
}) {
  const [usersRes, tasksRes, listsRes, { user }] = await Promise.all([
    authFetch('/user'),
    // Admins get every user's tasks and lists from these.
    // shortcut: loads everyone's tasks and filters here; add a per-user
    // backend filter when the task table gets large.
    authFetch('/task'),
    authFetch('/tasklist'),
    searchParams,
  ]);
  // GET /user is admin-only on the backend: that is the access check.
  if (usersRes.status === 403) notFound();
  if (!usersRes.ok)
    throw new Error(`Loading users failed (${usersRes.status})`);
  if (!tasksRes.ok)
    throw new Error(`Loading tasks failed (${tasksRes.status})`);
  if (!listsRes.ok)
    throw new Error(`Loading lists failed (${listsRes.status})`);

  const users: User[] = await usersRes.json();
  const tasks: Task[] = await tasksRes.json();
  const lists: Tasklist[] = await listsRes.json();
  const selected = users.find((u) => String(u.id) === user);

  return (
    <>
      <h1 className="display text-5xl sm:text-6xl lg:col-span-2">Admin</h1>
      <nav aria-label="Users" className="section self-start p-2">
        <p className="px-3 py-1 text-sm text-muted">
          {users.length} {users.length === 1 ? 'user' : 'users'}
        </p>
        <ul className="flex flex-col">
          {users.map((u) => (
            <li key={u.id}>
              <Link
                href={`/admin?user=${u.id}`}
                aria-current={u.id === selected?.id ? 'page' : undefined}
                className="user-link"
              >
                <span className="truncate font-medium">
                  {u.name ?? u.email}
                </span>
                {u.name && (
                  <span className="truncate text-sm text-muted">{u.email}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <section className="section min-w-0 self-start">
        {selected ? (
          <UserTasks
            user={selected}
            tasks={tasks.filter((t) => t.userId === selected.id)}
            lists={lists}
          />
        ) : (
          <p className="px-4 py-6 text-muted">
            {user ? 'No user with that id.' : 'Pick a user to see their tasks.'}
          </p>
        )}
      </section>
    </>
  );
}

function UserTasks({
  user,
  tasks,
  lists,
}: {
  user: User;
  tasks: Task[];
  lists: Tasklist[];
}) {
  const listTitle = new Map(lists.map((l) => [l.id, l.title]));
  // Inbox first, then by list, so a list's tasks sit together.
  const sorted = tasks.toSorted(
    (a, b) => (a.taskListId ?? 0) - (b.taskListId ?? 0) || a.id - b.id,
  );
  const done = tasks.filter((t) => t.completedAt).length;

  return (
    <>
      <div className="section-head">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="display truncate text-2xl">
            {user.name ?? user.email}
          </h2>
          {user.name && (
            <p className="truncate text-sm text-muted">{user.email}</p>
          )}
        </div>
        <span className="text-sm text-muted tabular-nums">
          {tasks.length === 0 ? 'no tasks' : `${done} of ${tasks.length} done`}
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted">No tasks yet.</p>
      ) : (
        <div className="overflow-x-auto px-2 pb-2">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>List</th>
                <th>Status</th>
                <th>Deadline</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span
                      className={t.completedAt ? 'text-muted line-through' : ''}
                    >
                      {t.title}
                    </span>
                    {t.description && (
                      <span className="block text-muted">{t.description}</span>
                    )}
                  </td>
                  <td>
                    {t.taskListId === null ? (
                      <span className="text-muted">Inbox</span>
                    ) : (
                      listTitle.get(t.taskListId)
                    )}
                  </td>
                  <td>{t.completedAt ? 'Done' : 'Open'}</td>
                  <td className="whitespace-nowrap">
                    {t.deadline ? (
                      <LocalTime iso={t.deadline} />
                    ) : (
                      <span className="text-muted">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
