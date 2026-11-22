import { Suspense } from 'react';
import { logout } from '../login/actions';
import { authFetch } from '../lib/session';
import { setCompleted } from './actions';
import { CreateTaskForm } from './create-task-form';

type Task = {
  id: number;
  title: string;
  description: string | null;
  completedAt: string | null;
};

export default function TasksPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your tasks</h1>
        <form action={logout}>
          <button className="text-sm underline">Log out</button>
        </form>
      </div>
      <CreateTaskForm />
      {/* Reads the session cookie, so it streams in at request time. */}
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <TaskList />
      </Suspense>
    </main>
  );
}

async function TaskList() {
  const res = await authFetch('/task');
  if (!res.ok) throw new Error(`Loading tasks failed (${res.status})`);
  const tasks: Task[] = await res.json();

  if (tasks.length === 0) {
    return <p className="text-zinc-500">No tasks yet.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-start gap-3 py-3">
          <div className="flex flex-1 flex-col gap-1">
            <span
              className={task.completedAt ? 'text-zinc-500 line-through' : ''}
            >
              {task.completedAt ? '✓ ' : ''}
              {task.title}
            </span>
            {task.description && (
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {task.description}
              </span>
            )}
          </div>
          <form action={setCompleted.bind(null, task.id, !task.completedAt)}>
            <button className="rounded-full border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
              {task.completedAt ? 'Undo' : 'Complete'}
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
