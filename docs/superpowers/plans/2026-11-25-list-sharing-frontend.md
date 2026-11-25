# Shared task lists and notifications (frontend)

Builds the UI on the backend from PR #15. Contract:
`docs/superpowers/specs/2026-11-25-list-sharing-design.md`. No backend changes:
`GET /tasklist?include=tasks` already returns joined lists with `role` and
`visibility`.

Work on a branch; `main` is protected. Test against the docker compose stack
(:3000/:3001).

## Rules the UI must respect

- A list becomes `SHARED` on its first invite and never goes back. Tasks never
  leave a shared list (no drag-out, no list-to-list); the owner can only delete them.
- Members can only drop their own Inbox tasks in and (un)complete tasks. They
  can't rename/delete tasks or the list.
- Moving tasks stays drag-only: no "move to" dropdown.

## 1. Show shared lists — `frontend/app/(app)/tasks/page.tsx`

- `loadBoard`: filter `role !== null` instead of `role === 'owner'` (drops lists
  an admin only sees as admin).
- `Tasklist` type: add `visibility: 'PRIVATE' | 'SHARED'`.
- Pass `role` and `shared` down to `Section` and `TaskRow`.
- Shared lists stay mixed in with owned lists, in backend order, and get a
  small "Shared" chip next to the title.
- No "Shared by <owner>" label: the owner shows in the Members dialog.

## 2. Per-role behaviour

| | Owner, private | Owner, shared | Member |
|---|---|---|---|
| Rename / delete list | yes | yes | no; **Leave list** in place of delete |
| Drop Inbox tasks in | yes | yes | yes |
| Drag tasks out | yes | no | no |
| Edit title / details / deadline | yes | yes | no, plain text |
| Delete task | yes | yes | no |
| Complete task | yes | yes | yes |

- Rows in a shared list are not draggable and render no grip
  (`DraggableTask` in `tasklist-forms.tsx` gets a `draggable={false}` path).
- Member rows: render title/details/deadline as plain text (read-only mode on
  `EditableText` / `EditableDateTime`, or plain spans in `TaskRow`).
- Leave list: `ConfirmDelete` with `removeMember(listId, 'me')`; copy says the
  tasks you added stay in the list.

## 3. Members dialog

- **Members** button in the list footer, for owner and members. Opens a modal
  `<dialog>` built like `confirm-delete.tsx` (portaled).
- Loads `GET /tasklist/:id/member` when opened (server action `getMembers`).
  Shows name, email, and a "pending" tag for unaccepted invites; owner first.
- Owner: email invite form (`POST /tasklist/:id/member`) showing the backend's
  404 / 409 / 400 message, plus Remove / Cancel invite per row
  (`DELETE /tasklist/:id/member/:userId`).
- On a `PRIVATE` list, the invite form warns: "Sharing is permanent: tasks
  can't be moved out of a shared list."
- Member: read-only list.

## 4. Notification bell — `frontend/app/navbar.tsx`

- Bell with unread count beside `ThemeSwitch`; popover feed like the profile
  menu, server-rendered from `GET /notification`.
- INVITE: "<actorName> invited you to <listTitle>". Accept
  (`POST /tasklist/:id/member/me/accept`) / Decline
  (`DELETE /tasklist/:id/member/me`) show on every INVITE whose list the user
  hasn't joined, whatever `readAt` says (needs the user's list ids: fetch
  `GET /tasklist` in the bell). Joined → "Joined" label.
- TASK_COMPLETED: "<actorName> completed <taskTitle> in <listTitle>".
- Opening the bell calls `POST /notification/read-all`.
- Move `<LiveUpdates>` from the tasks page into `AppLayout` so the bell stays
  live on every logged-in page; its `onAny → router.refresh()` already covers
  `notification.created`.

## 5. Server actions — `frontend/app/(app)/tasks/actions.ts`

All through the existing `send` (error string back, refresh either way):
`inviteMember(listId, email)`, `removeMember(listId, userId | 'me')`,
`acceptInvite(listId)`, `markAllRead()`, and `getMembers(listId)` returning JSON.

## 6. Tests

Extend `e2e/tests/sharing.spec.ts` with a UI-driven flow:
owner invites from the Members dialog → invitee accepts from the bell → member
drags an Inbox task in and completes it → owner's bell shows the notice.
Plus: a member sees no rename/delete/edit controls; rows in a shared list have
no grip; Leave list removes the list from the member's page.

## Out of scope

Notification pagination (backend caps at 50), per-row mark-read, email,
ownership transfer.
