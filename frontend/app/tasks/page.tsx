import { cache, Suspense } from 'react';
import { logout } from '../login/actions';
import { authFetch, currentUserId } from '../lib/session';
import { ActionErrors } from './action-error';
import {
  deleteTask,
  deleteTasklist,
  renameTask,
  renameTasklist,
  setTaskDeadline,
  setTaskDetails,
} from './actions';
import { ConfirmDelete } from './confirm-delete';
import { CreateTaskForm } from './create-task-form';
import { EditableDateTime, EditableText } from './inline-edit';
import { ListShell } from './list-shell';
import { LiveUpdates } from './live-updates';
import {
  CompleteButton,
  CreateTasklistForm,
  DraggableTask,
  DropZone,
} from './tasklist-forms';

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

type Tasklist = { id: number; title: string; userId: number };

export default function TasksPage() {
  const loading = <p className="text-muted">Loading…</p>;
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-8 px-5 py-12 sm:py-16 lg:grid-cols-2 lg:gap-x-10">
      <header className="flex items-end justify-between gap-4 lg:col-span-2">
        <h1 className="display text-5xl sm:text-6xl">Tasks</h1>
        <form action={logout}>
          <button className="text-sm text-muted underline-offset-4 hover:underline">
            Log out
          </button>
        </form>
      </header>
      <div className="flex min-w-0 flex-col gap-6">
        <CreateTaskForm />
        {/* Reads the session cookie, so it streams in at request time. */}
        <Suspense fallback={loading}>
          <Inbox />
        </Suspense>
        <CreateTasklistForm />
      </div>
      <Suspense fallback={loading}>
        <Lists />
      </Suspense>
      <ActionErrors />
    </main>
  );
}

/**
 * Both columns need the same data: cache() makes it one fetch per request.
 * Only the user's own: admins get everyone's, but only owners change lists.
 */
const loadBoard = cache(async () => {
  const [res, listsRes, userId] = await Promise.all([
    authFetch('/task'),
    authFetch('/tasklist'),
    currentUserId(),
  ]);
  if (!res.ok) throw new Error(`Loading tasks failed (${res.status})`);
  if (!listsRes.ok)
    throw new Error(`Loading lists failed (${listsRes.status})`);
  const tasks: Task[] = await res.json();
  const lists: Tasklist[] = await listsRes.json();
  const mine = (r: { userId: number }) => r.userId === userId;
  return { tasks: tasks.filter(mine), lists: lists.filter(mine) };
});

async function Inbox() {
  const { tasks } = await loadBoard();
  return (
    <>
      {/* Here, not in the static shell, so the env var is read at request time. */}
      {process.env.BACKEND_PUBLIC_URL && (
        <LiveUpdates url={process.env.BACKEND_PUBLIC_URL} />
      )}
      <Section
        title="Inbox"
        listId={null}
        tasks={tasks.filter((t) => t.taskListId === null)}
      />
    </>
  );
}

async function Lists() {
  const { tasks, lists } = await loadBoard();
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {lists.length === 0 && (
        <p className="text-muted">
          No lists yet. Create one, then drag tasks into it.
        </p>
      )}
      {lists.map((list) => (
        <Section
          key={list.id}
          title={list.title}
          listId={list.id}
          tasks={tasks.filter((t) => t.taskListId === list.id)}
        />
      ))}
    </div>
  );
}

/** One list; `listId` null is the Inbox: always open, styled apart. */
function Section({
  title,
  listId,
  tasks,
}: {
  title: string;
  listId: number | null;
  tasks: Task[];
}) {
  const inbox = listId === null;
  return (
    <DropZone listId={listId} className={inbox ? 'section inbox' : 'section'}>
      <ListShell
        storageKey={inbox ? 'inbox' : String(listId)}
        title={title}
        rename={inbox ? undefined : renameTasklist.bind(null, listId)}
        titleClassName={inbox ? 'text-3xl' : 'text-2xl'}
        collapsible={!inbox}
        progress={<Progress tasks={tasks} />}
        doneCount={tasks.filter((t) => t.completedAt).length}
        footer={
          !inbox && (
            <ConfirmDelete
              action={deleteTasklist.bind(null, listId)}
              title={`Delete “${title}”?`}
              message="The list goes away. Its tasks are kept and move to the inbox."
              className="btn-danger"
            >
              <TrashIcon />
              Delete list
            </ConfirmDelete>
          )
        }
      >
        <TaskItems
          tasks={tasks}
          empty={
            inbox
              ? 'Nothing here. New tasks land in the inbox.'
              : 'Drag a task here to add it to this list.'
          }
        />
      </ListShell>
    </DropZone>
  );
}

function Progress({ tasks }: { tasks: Task[] }) {
  const done = tasks.filter((t) => t.completedAt).length;
  return (
    <span className="text-sm text-muted tabular-nums">
      {tasks.length === 0 ? 'empty' : `${done} of ${tasks.length} done`}
    </span>
  );
}

function TaskItems({ tasks, empty }: { tasks: Task[]; empty: string }) {
  return (
    <div className="px-2 pb-2">
      {tasks.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const done = Boolean(task.completedAt);
  return (
    <DraggableTask taskId={task.id} fromListId={task.taskListId} done={done}>
      <span aria-hidden className="grip">
        <svg viewBox="0 0 10 16" className="h-4 w-2.5" fill="currentColor">
          {[3, 8, 13].flatMap((y) => [
            <circle key={`a${y}`} cx="2.5" cy={y} r="1.3" />,
            <circle key={`b${y}`} cx="7.5" cy={y} r="1.3" />,
          ])}
        </svg>
      </span>
      <CompleteButton taskId={task.id} done={done} title={task.title}>
        <svg viewBox="0 0 16 16" aria-hidden className="size-3">
          <path
            d="M3 8.5l3 3 7-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          />
        </svg>
      </CompleteButton>
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <EditableText
          value={task.title}
          save={renameTask.bind(null, task.id)}
          label="Task name"
          max={50}
          trim
          required
          noun="Task names"
          className={done ? 'text-muted line-through' : ''}
        />
        <EditableText
          value={task.description ?? ''}
          save={setTaskDetails.bind(null, task.id)}
          label="Details"
          placeholder="Add details"
          max={200}
          noun="Details"
          className="text-sm text-muted"
        />
        <EditableDateTime
          value={task.deadline ?? ''}
          save={setTaskDeadline.bind(null, task.id)}
          label={`Deadline of ${task.title}`}
        />
      </div>
      <ConfirmDelete
        action={deleteTask.bind(null, task.id)}
        title={`Delete “${task.title}”?`}
        message="This task will be gone for good. This can't be undone."
        label={`Delete ${task.title}`}
        className="icon-danger"
      >
        <TrashIcon />
      </ConfirmDelete>
    </DraggableTask>
  );
}

/** The lid is its own group so it can lift on hover (globals.css). */
function TrashIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="trash size-4"
    >
      <g className="trash-lid">
        <path d="M2.5 4h11" />
        <path d="M6 4V2.75c0-.4.3-.75.75-.75h2.5c.4 0 .75.35.75.75V4" />
      </g>
      <path d="M3.75 4l.7 9.1c.05.5.45.9 1 .9h5.1c.5 0 .95-.4 1-.9l.7-9.1" />
      <path d="M6.75 7v4M9.25 7v4" />
    </svg>
  );
}
