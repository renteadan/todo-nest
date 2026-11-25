# Shared task lists and notifications (backend)

## Intent

Task lists get collaborators. An owner invites other users to a list; invited
users accept or decline from an in-app notification feed (no email). The feed
also tells everyone on a shared list when a task in it is completed.

Scope: **backend only** (NestJS + Prisma in `backend/`). Frontend comes later,
so the API must be complete enough to build the UI on without backend changes.

## Goals

- Owners share a list with other users by email address.
- Per-user notification feed with read/unread state, delivered live.
- Notification types can be added later without a schema migration.
- Existing live updates (task/tasklist socket events) reach all members.

## Non-goals

- Sending email.
- Notifications other than INVITE and TASK_COMPLETED (but the design must let
  more be added cheaply).
- Transferring list ownership; multiple owners; member roles beyond
  owner/member.
- Frontend.

## Anti-goals

- A member able to rename, delete, or move out tasks, or rename/delete the
  list. That would break the owner's "full control".
- Revealing which list/task ids exist to users without access (keep the
  current 404-not-403 behaviour for records you can't see).

## Roles

**Owner** (`TaskList.userId`, unchanged; has no member row):
- rename and delete the list
- complete/uncomplete any task in it
- delete any task in it, whoever created it
- move tasks out of it only while it is `PRIVATE`; once `SHARED`, a task
  never leaves it: the owner deletes it instead
- invite and remove members

**Member** (accepted `TaskListMember` row):
- add tasks: create a task (lands in their Inbox) then move it into the list,
  or move an existing task of theirs from their Inbox
- complete/uncomplete any task in the list
- cannot edit title/description/deadline of any task in the list, including
  their own; cannot delete or move out any task
- can leave the list

Leaving or being removed: the person's tasks **stay in the list**. Their
`Task.userId` still points at them (the creator), but they lose access to those
tasks through the list. Access to a task in a list is decided by list
membership, not by `Task.userId`.

A task in no list (the Inbox) stays private to its creator, as today.

## Approaches considered

- **A. Member table + stored notifications table (chosen).** Pending invite =
  member row without `acceptedAt`. Notifications are stored rows with real
  read/unread state and a stable history, pushed over the existing per-user
  socket rooms. Cost: two tables, one notification row per recipient.
- B. Member table only, notifications computed by query. Less storage, but no
  proper read state, notices vanish when a task is uncompleted, and the feed
  query grows complex.
- C. Separate Invite, Member, Notification tables. An invite and a pending
  membership are the same thing here; a third table only adds copying on accept.

## Database

```prisma
model TaskListMember {
  taskListId Int
  userId     Int
  invitedAt  DateTime  @default(now()) @db.Timestamptz(3)
  /// null = pending invite; set on accept.
  acceptedAt DateTime? @db.Timestamptz(3)
  /// Deleting the list removes its members and invites.
  TaskList   TaskList  @relation(fields: [taskListId], references: [id], onDelete: Cascade)
  /// Deleting the user removes their memberships and invites.
  User       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([taskListId, userId])
  @@index([userId])
}

model Notification {
  id        Int       @id @default(autoincrement())
  /// Recipient.
  userId    Int
  /// 'INVITE' | 'TASK_COMPLETED' | ... ; a string, not an enum, so new types need no migration.
  type      String
  /// Shape depends on `type`; validated by notificationSchema on write and read.
  data      Json
  createdAt DateTime  @default(now()) @db.Timestamptz(3)
  readAt    DateTime? @db.Timestamptz(3)
  User      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}
```

Plus back-relations on `TaskList` (`TaskListMember[]`) and `User`
(`TaskListMember[]`, `Notification[]`). One migration via `prisma migrate dev`.

### Notification payloads

One zod discriminated union is the single place types are defined:

```ts
export const notificationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('INVITE'),
    data: z.object({ taskListId: z.int(), listTitle: z.string(),
                     actorId: z.int(), actorName: z.string() }) }),
  z.object({ type: z.literal('TASK_COMPLETED'),
    data: z.object({ taskListId: z.int(), listTitle: z.string(),
                     taskId: z.int(), taskTitle: z.string(),
                     actorId: z.int(), actorName: z.string() }) }),
]);
```

- Payloads snapshot the titles/names they display, so a notification renders
  without lookups and survives renames/deletes (stale titles are accepted: it
  is a history).
- `actorName` = the actor's `name`, falling back to their email when `name` is null.
- Adding a type = one union entry + the code that emits it. No migration.
- Invalid data on write throws; rows that fail parsing on read are logged and
  skipped, not returned.

### List visibility

`TaskList.visibility` is `PRIVATE` (default) or `SHARED`. The first invite sets
`SHARED` in the invite's transaction, and nothing sets it back: a list stays
shared after every member and invite is gone. It decides only whether tasks
can leave the list; access still comes from `TaskListMember` rows. The
migration backfills `SHARED` for lists that already have member rows.

### Deleting a list

In one transaction:
- tasks in the list created by the **owner** go back to the owner's Inbox
  (`taskListId = null`, as today);
- tasks created by **anyone else** (current or former members) are deleted;
- members, invites, and notifications for the list are removed (below).

Events: the owner gets `task.updated` for tasks returned to their Inbox; every
list user (owner + accepted members) gets `tasklist.deleted { id }`.

### Deleting a user

`TaskListMember` and `Notification` cascade with the user, so memberships and
notifications never block deleting an account. Tasks and lists still do, as
today.

### Cleanup (no FKs inside JSON)

- Deleting a list deletes notifications whose `data.taskListId` equals it
  (Prisma JSON path filter), in the same transaction as the list delete.
- Removing a member / declining / cancelling an invite deletes that user's
  INVITE notification for the list.
- Deleting a task does **not** delete TASK_COMPLETED notices about it (they
  are history and carry their own titles).

## API

All routes require a signed-in user (`@Can.Anyone()` + per-record checks in
services, as today). Records the caller can't see → 404. Visible but not
allowed (e.g. a member renaming a list) → 403.

### New: members

| Route | Who | Behaviour |
|---|---|---|
| `GET /tasklist/:id/member` | owner, accepted members | `[{ id, name, email, role: 'owner'\|'member', acceptedAt }]`: owner first, then members incl. pending invites |
| `POST /tasklist/:id/member` `{ email }` | owner | Creates pending member row + INVITE notification for the invitee. 404 no user with that email; 409 already member/invited; 400 inviting yourself. Returns the member entry |
| `POST /tasklist/:id/member/me/accept` | invited user | Sets `acceptedAt`, marks the INVITE notification read. 404 if no pending invite. Returns the list as `GET /tasklist/:id` does |
| `DELETE /tasklist/:id/member/:userId` | owner: anyone but themselves; member/invitee: only `me` | Removes the row (kick, cancel invite, decline, leave) and deletes the INVITE notification. Tasks stay in the list. 204 |

`:userId` accepts the literal `me` for the caller.

### New: notifications

| Route | Behaviour |
|---|---|
| `GET /notification[?unread=true]` | Caller's notifications, newest first, `{ id, type, data, createdAt, readAt }`. Limit 50 (`shortcut:` paginate when needed) |
| `PATCH /notification/:id/read` | Sets `readAt` if unset. 404 if not the caller's |
| `POST /notification/read-all` | Sets `readAt` on all the caller's unread |

### New: inbox

| Route | Behaviour |
|---|---|
| `GET /task/inbox` | The caller's tasks in no list, ordered by id |

### Changed

- `GET /task`: **admin only** (403 for others); returns every task, as the
  admin page uses it. This knowingly breaks the current frontend tasks page
  until the frontend PR switches it to `GET /task/inbox` + `GET /tasklist?include=tasks`.
- `GET /tasklist[?include=tasks]`: owned lists plus lists where the caller is
  an accepted member; each list gets `role: 'owner' | 'member' | null` (`null`
  for an admin viewing a list they neither own nor joined). With
  `include=tasks`, each list carries its tasks (ordered by id), as
  `GET /tasklist/:id` does. Admin "all" view unchanged otherwise.
- `GET /tasklist/:id`: owner or accepted member; includes `role` and tasks.
- `PATCH /tasklist/:id`, `DELETE /tasklist/:id`: owner only (403 for members).
- `POST /tasklist/:id/task/:taskId` (move in): owner or accepted member of
  the target list. The task must be either in the caller's Inbox (caller
  created it) or in another list the caller **owns** (a list-to-list move
  counts as a move-out of the source, which only its owner may do; both lists
  still get `tasklist.updated`, as today). Replaces the current "task owner
  must equal list owner" rule in `TasklistService.addTask`.
  `MAX_TASKS_PER_LIST` still applies.
- `DELETE /tasklist/:id/task/:taskId` (move out): owner only, and only while
  the list is `PRIVATE` (403 otherwise). A list-to-list move out of a shared
  list is refused the same way.
- `GET /task/:id`: the creator if the task is in no list; otherwise owner or
  accepted member of its list.
- `PATCH /task/:id`:
  - task in no list: creator, any field (as today)
  - task in a list, caller is list owner: any field
  - caller is a member: body must be exactly `{ completed }`, else 403
  - when `completed` flips false→true on a task in a list that has at least
    one accepted member: create TASK_COMPLETED for owner + accepted members,
    excluding the actor. Uncompleting sends nothing.
- `DELETE /task/:id`: creator if in no list; list owner if in a list.

Admins: unchanged from today. They can read every list and task (via
`OwnerPolicy.before` / `viewAll`) but list changes stay owner-only
(`TasklistService` already returns 403 to admins for rename, delete, move in/out),
and that extends to member management and accepting. Admins can still edit or
delete any task through `/task/:id`, as today.

## Live updates (socket.io, existing per-user rooms)

- `TaskGateway.listUserIds(listId)` returns owner + accepted members, so all
  existing `task.*` / `tasklist.*` events reach members.
- New event `notification.created` with the notification, to the recipient.
- On remove/leave, the removed user gets `tasklist.deleted { id }` so the list
  leaves their screen. On accept, the new member gets `tasklist.updated`.

## Constraints

- `main` is protected: work on a branch, merge via PR with passing checks.
- Follow existing patterns: zod DTOs in `dto/`, `OwnerPolicy` + service-level
  404s, Prisma client from `generated/prisma`, unit specs beside each file,
  Playwright e2e in `e2e/`.
- Test against the docker compose stack (:3000/:3001).

## Calls made during review (not discussed in detail)i want

- List-to-list moves: only between lists the caller owns (see move in).
- Admins stay read-only on lists; `role: null` for lists they only see as admin.
- Memberships and notifications cascade on user delete.
- TASK_COMPLETED notices survive task deletion (history, own titles).
- `actorName` falls back to email; feed capped at 50.
- Visible-but-forbidden → 403; invisible → 404. The invite 404 reveals whether
  an email is registered; accepted, since only signed-in users can invite.

## Left to the builder

- Module layout (e.g. members in `tasklist/`, a new `notification/` module).
- How `OwnerPolicy` grows (e.g. a `member` check) vs. checks in services.
- Transaction boundaries beyond those stated above.
- Unit tests for every new rule and an e2e test for invite → accept → member
  completes → owner sees the notification.
