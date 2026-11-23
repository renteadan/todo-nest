'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { reportError } from './action-error';
import { createTasklist, moveTask, setCompleted } from './actions';
import { LimitedInput } from './limited-input';

const TASK_MIME = 'application/x-task';
/** Set on drop, consumed when the moved row mounts in its new list. */
let landedTaskId: number | null = null;

export function CreateTasklistForm() {
  const [state, action, pending] = useActionState(createTasklist, {});

  return (
    <form action={action} className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <LimitedInput
          name="title"
          required
          placeholder="New list"
          aria-label="List name"
          max={50}
          trim
          noun="List names"
          className="flex-1"
        />
        <button disabled={pending} className="btn-quiet">
          {pending ? 'Creating…' : 'Create list'}
        </button>
      </div>
      <p aria-live="polite" className="text-sm text-danger">
        {state.error}
      </p>
    </form>
  );
}

/** A task row that can be dragged onto another list's section. */
export function DraggableTask({
  taskId,
  fromListId,
  done,
  children,
}: {
  taskId: number;
  fromListId: number | null;
  done: boolean;
  children: React.ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  // Read once on mount: the row a drop just moved here gets a landing animation.
  const [landed] = useState(() => landedTaskId === taskId);
  useEffect(() => {
    if (landed) landedTaskId = null;
  }, [landed]);
  return (
    <li
      draggable
      // Decided per press: in an edit field the mouse selects text instead of
      // picking up the row. Set on the DOM, as React never re-renders it.
      onPointerDown={(e) => {
        e.currentTarget.draggable = !(
          e.target instanceof HTMLInputElement ||
          (e.target as Element).closest('.picker')
        );
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          TASK_MIME,
          JSON.stringify({ taskId, fromListId }),
        );
        e.dataTransfer.effectAllowed = 'move';
        // The browser snapshots the drag image right after this handler, so
        // the lifted-card look is set on the DOM now and swapped next frame
        // for the empty slot left behind.
        const row = e.currentTarget;
        row.dataset.lifting = '';
        requestAnimationFrame(() => {
          delete row.dataset.lifting;
          setDragging(true);
        });
      }}
      onDragEnd={() => setDragging(false)}
      data-done={done || undefined}
      data-dragging={dragging || undefined}
      data-landed={landed || undefined}
      className="task-row"
    >
      {children}
    </li>
  );
}

/** A list's section (null = Inbox) that accepts dropped tasks. */
export function DropZone({
  listId,
  className,
  children,
}: {
  listId: number | null;
  className?: string;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const accepts = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(TASK_MIME);

  return (
    <div
      onDragOver={(e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(e) => {
        setOver(false);
        if (!accepts(e)) return;
        e.preventDefault();
        const { taskId, fromListId } = JSON.parse(
          e.dataTransfer.getData(TASK_MIME),
        ) as { taskId: number; fromListId: number | null };
        if (fromListId !== listId) landedTaskId = taskId;
        startTransition(async () =>
          reportError(await moveTask(taskId, fromListId, listId)),
        );
      }}
      data-over={over || undefined}
      aria-busy={pending}
      className={`drop-zone ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

/** Completes the task, or reopens it when it is done. */
export function CompleteButton({
  taskId,
  done,
  title,
  children,
}: {
  taskId: number;
  done: boolean;
  title: string;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () =>
          reportError(await setCompleted(taskId, !done)),
        )
      }
      aria-pressed={done}
      aria-label={`${done ? 'Reopen' : 'Complete'} ${title}`}
      className="check"
    >
      {children}
    </button>
  );
}
