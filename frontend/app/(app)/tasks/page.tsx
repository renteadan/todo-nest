import { cache, Suspense } from 'react';
import { authFetch } from '../../lib/session';
import {
  deleteTask,
  deleteTasklist,
  removeMember,
  renameTask,
  renameTasklist,
  setTaskDeadline,
  setTaskDetails,
} from './actions';
import { ConfirmDelete } from './confirm-delete';
import { CreateTaskForm } from './create-task-form';
import { EditableDateTime, EditableText } from './inline-edit';
import { ListShell } from './list-shell';
import { MembersDialog } from './members-dialog';
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

type Tasklist = {
  id: number;
  title: string;
  userId: number;
  role: 'owner' | 'member' | null;
  visibility: 'PRIVATE' | 'SHARED';
  Task: Task[];
};

type Role = 'owner' | 'member';

export default function TasksPage() {
  const loading = <p className="text-muted">Loading…</p>;
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-8 px-5 py-10 sm:py-12 lg:grid-cols-2 lg:gap-x-10">
      <h1 className="display text-5xl sm:text-6xl lg:col-span-2">Tasks</h1>
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
    </main>
  );
}

/**
 * Both columns need the same data: cache() makes it one fetch per request.
 * Lists the user owns or joined (not those an admin only sees as admin);
 * `tasks` is the Inbox plus the tasks in those lists.
 */
const loadBoard = cache(async () => {
  const [res, listsRes] = await Promise.all([
    authFetch('/task/inbox'),
    authFetch('/tasklist?include=tasks'),
  ]);
  if (!res.ok) throw new Error(`Loading tasks failed (${res.status})`);
  if (!listsRes.ok)
    throw new Error(`Loading lists failed (${listsRes.status})`);
  const inbox: Task[] = await res.json();
  const lists = ((await listsRes.json()) as Tasklist[]).filter(
    (l): l is Tasklist & { role: Role } => l.role !== null,
  );
  return { tasks: [...inbox, ...lists.flatMap((l) => l.Task)], lists };
});

async function Inbox() {
  const { tasks } = await loadBoard();
  return (
    <Section
      title="Inbox"
      listId={null}
      role="owner"
      shared={false}
      tasks={tasks.filter((t) => t.taskListId === null)}
    />
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
          role={list.role}
          shared={list.visibility === 'SHARED'}
          tasks={tasks.filter((t) => t.taskListId === list.id)}
        />
      ))}
    </div>
  );
}

/**
 * One list; `listId` null is the Inbox: always open, styled apart. Members of
 * a list only add and (un)complete tasks; tasks never leave a shared list.
 */
function Section({
  title,
  listId,
  role,
  shared,
  tasks,
}: {
  title: string;
  listId: number | null;
  role: Role;
  shared: boolean;
  tasks: Task[];
}) {
  const inbox = listId === null;
  const owner = role === 'owner';
  return (
    <DropZone listId={listId} className={inbox ? 'section inbox' : 'section'}>
      <ListShell
        storageKey={inbox ? 'inbox' : String(listId)}
        title={title}
        rename={inbox || !owner ? undefined : renameTasklist.bind(null, listId)}
        badge={shared && <span className="tag">Shared</span>}
        titleClassName={inbox ? 'text-3xl' : 'text-2xl'}
        collapsible={!inbox}
        progress={<Progress tasks={tasks} />}
        doneCount={tasks.filter((t) => t.completedAt).length}
        footer={
          !inbox && (
            <>
              <MembersDialog
                listId={listId}
                title={title}
                owner={owner}
                shared={shared}
              />
              {owner ? (
                <ConfirmDelete
                  action={deleteTasklist.bind(null, listId)}
                  title={`Delete “${title}”?`}
                  message="Tasks you created move to your Inbox; tasks created by other users are permanently deleted."
                  className="btn-danger"
                >
                  <TrashIcon />
                  Delete list
                </ConfirmDelete>
              ) : (
                <ConfirmDelete
                  action={removeMember.bind(null, listId, 'me')}
                  title={`Leave “${title}”?`}
                  message="The tasks you added stay in the list. You'll need a new invite to come back."
                  confirmLabel="Leave"
                  className="btn-danger"
                >
                  Leave list
                </ConfirmDelete>
              )}
            </>
          )
        }
      >
        <TaskItems
          tasks={tasks}
          owner={owner}
          shared={shared}
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

function TaskItems({
  tasks,
  owner,
  shared,
  empty,
}: {
  tasks: Task[];
  owner: boolean;
  shared: boolean;
  empty: string;
}) {
  return (
    <div className="px-2 pb-2">
      {tasks.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} owner={owner} shared={shared} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** `owner` false: a member's row, where only the tick works. */
function TaskRow({
  task,
  owner,
  shared,
}: {
  task: Task;
  owner: boolean;
  shared: boolean;
}) {
  const done = Boolean(task.completedAt);
  return (
    <DraggableTask
      taskId={task.id}
      fromListId={task.taskListId}
      done={done}
      draggable={!shared}
    >
      {!shared && (
        <span aria-hidden className="grip">
          <svg viewBox="0 0 10 16" className="h-4 w-2.5" fill="currentColor">
            {[3, 8, 13].flatMap((y) => [
              <circle key={`a${y}`} cx="2.5" cy={y} r="1.3" />,
              <circle key={`b${y}`} cx="7.5" cy={y} r="1.3" />,
            ])}
          </svg>
        </span>
      )}
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
          save={owner ? renameTask.bind(null, task.id) : undefined}
          label="Task name"
          max={50}
          trim
          required
          noun="Task names"
          className={done ? 'text-muted line-through' : ''}
        />
        <EditableText
          value={task.description ?? ''}
          save={owner ? setTaskDetails.bind(null, task.id) : undefined}
          label="Details"
          placeholder="Add details"
          max={200}
          noun="Details"
          className="text-sm text-muted"
        />
        <EditableDateTime
          value={task.deadline ?? ''}
          save={owner ? setTaskDeadline.bind(null, task.id) : undefined}
          label={`Deadline of ${task.title}`}
        />
      </div>
      {owner && (
        <ConfirmDelete
          action={deleteTask.bind(null, task.id)}
          title={`Delete “${task.title}”?`}
          message="This task will be gone for good. This can't be undone."
          label={`Delete ${task.title}`}
          className="icon-danger"
        >
          <TrashIcon />
        </ConfirmDelete>
      )}
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
