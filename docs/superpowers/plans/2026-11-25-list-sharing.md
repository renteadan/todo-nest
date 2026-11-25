# Shared Task Lists and Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owners share task lists with other users through invites; everyone gets a per-user notification feed (invites, task completions), all in the NestJS backend.

**Architecture:** A `TaskListMember` table (pending invite = no `acceptedAt`) decides list access next to `TaskList.userId`; a pure `listRole()` helper turns a list + caller into `'owner' | 'member' | null` and every service check goes through it. A `Notification` table stores a `type` string plus zod-validated JSON `data`; `NotificationService` is DB-only and callers push `notification.created` over the existing per-user socket rooms in `TaskGateway`.

**Tech Stack:** NestJS 11, Prisma 7 (PostgreSQL, client in `src/generated/prisma`), zod 4, socket.io, vitest, Playwright (e2e against docker compose).

**Spec:** `docs/superpowers/specs/2026-11-25-list-sharing-design.md`

## Global Constraints

- Work on branch `list-sharing`; `main` is protected (PR + passing checks).
- All commands run in `backend/` unless stated. Prisma commands take `--config prisma7.config.ts`.
- Before each commit: `npm run format`, `npm run lint`, `npm test` all clean (CI runs `format:check`, `lint`, `test`, `build`).
- Records the caller can't see → `NotFoundException`; visible but not allowed → `ForbiddenException`.
- Admins: read everything (`OwnerPolicy` `viewAll`/`before`), but list writes, member management and accepting stay owner/invitee-only. Admins may still edit/delete any task via `/task/:id`.
- Notification `type` is a string, never a Postgres enum. Payloads are validated by `notificationSchema` on write and on read.
- Gateway emits never throw (the change is already saved); follow the existing try/catch + `logger.error` pattern.
- Test against the compose stack (:3000 frontend, :3001 backend, watch on); never start a separate dev server.

## Review Focus

1. **Duplicate invite race:** two concurrent `POST /tasklist/:id/member` for the same email → second gets 409, not a 500 from Prisma `P2002`. (Task 7)
2. **Re-completing a completed task:** `PATCH { completed: true }` on an already completed task sends no second TASK_COMPLETED. (Task 4)
3. **Pending invitee reads the list:** a user with a pending (unaccepted) invite gets 404 on `GET /tasklist/:id` and `GET /task/:id` for its tasks. (Tasks 4, 5)
4. **Admin on write routes:** admin calling invite / accept / remove-member on someone else's list → 403, even though `OwnerPolicy.before` returns true. (Task 7)
5. **Self-removal by the owner:** owner calling `DELETE /tasklist/:id/member/me` (or their own id) → 400; a member deleting another member → 403. (Task 7)

---

## File Structure

| File | Responsibility |
|---|---|
| `src/prisma/schema.prisma` + new migration | `TaskListMember`, `Notification`, back-relations |
| `src/task/list-role.ts` (new) | `listRole()` and the Prisma `include` fragment for accepted members |
| `src/notification/notification.types.ts` (new) | `notificationSchema`, `NotificationPayload` |
| `src/notification/notification.service.ts` (new) | create / list / mark read / cleanup, DB only |
| `src/notification/notification.controller.ts` (new) | `/notification` routes |
| `src/notification/notification.module.ts` (new) | exports `NotificationService` |
| `src/task/task.gateway.ts` | members in `listUserIds`, `tasklistDeleted` to given users, `notificationsCreated` |
| `src/task/task.service.ts` / `task.controller.ts` | inbox, admin-only list, membership-aware access, member edit rules, completion notices |
| `src/tasklist/tasklist.service.ts` / `tasklist.controller.ts` | membership-aware reads, `include=tasks`, `role`, delete rules, move rules |
| `src/tasklist/member.service.ts` / `member.controller.ts` (new) | `/tasklist/:id/member` routes |
| `src/app.module.ts` | register `NotificationModule` |
| `e2e/tests/sharing.spec.ts` (new, repo root) | invite → accept → member completes → owner notified |

Module graph (no cycles): `NotificationModule` imports `PrismaModule`. `TaskModule` imports `PrismaModule`, `NotificationModule`. `TasklistModule` imports `PrismaModule`, `TaskModule`, `NotificationModule`.

---

### Task 1: Schema and migration

**Files:**
- Modify: `src/prisma/schema.prisma`
- Create: `src/prisma/migrations/<timestamp>_list_sharing/migration.sql` (generated)

**Interfaces:**
- Produces: Prisma models `TaskListMember { taskListId, userId, invitedAt, acceptedAt }` (relation fields `TaskList`, `User`), `Notification { id, userId, type, data, createdAt, readAt }` (relation `User`); back-relations `TaskList.TaskListMember`, `User.TaskListMember`, `User.Notification`.

- [ ] **Step 1: Add the two models exactly as in the spec's "Database" section**, with `onDelete: Cascade` on `TaskListMember.TaskList`, `TaskListMember.User`, `Notification.User`; add the back-relation fields.
- [ ] **Step 2: Generate the migration** against the compose database

Run: `npx prisma migrate dev --name list_sharing --config prisma7.config.ts`
Expected: new migration folder; "Your database is now in sync"; client regenerated.

- [ ] **Step 3: Verify nothing else broke**

Run: `npm run build && npm test`
Expected: build succeeds, all existing tests pass.

- [ ] **Step 4: Commit** `feat(db): TaskListMember and Notification tables`

---

### Task 2: `listRole` helper and gateway fan-out

**Files:**
- Create: `src/task/list-role.ts`, `src/task/list-role.spec.ts`
- Modify: `src/task/task.gateway.ts`, `src/task/task.gateway.spec.ts`

**Interfaces:**
- Produces:
  - `export const acceptedMembers = { TaskListMember: { where: { acceptedAt: { not: null } }, select: { userId: true } } } as const` (spread into Prisma `include`)
  - `export type ListWithMembers = { userId: number; TaskListMember: { userId: number }[] }`
  - `export function listRole(list: ListWithMembers, userId: number): 'owner' | 'member' | null`
  - `export function listUserIds(list: ListWithMembers): number[]` (owner first)
  - `TaskGateway.tasklistDeleted(listId: number, userIds: number[]): void` (signature change: callers pass recipients)
  - `TaskGateway.notificationsCreated(rows: { userId: number }[]): void` emits `notification.created` with each row to `user:<userId>`
  - private `TaskGateway.listUserIds(taskListId)` now returns owner + accepted members (remove both `shortcut:` comments)

- [ ] **Step 1: Write failing tests**
  - `listRole`: owner → `'owner'`; id in `TaskListMember` → `'member'`; anyone else → `null`.
  - gateway: `taskChanged` for a task in list 10 with accepted member 5 emits to rooms `user:1` and `user:5`; `tasklistUpdated` emits to owner and members; `tasklistDeleted(10, [1, 5])` emits `{ id: 10 }` to both rooms; `notificationsCreated([{userId: 5, ...}])` emits `notification.created` to `user:5`.
- [ ] **Step 2: Run** `npx vitest run src/task` — Expected: new tests FAIL.
- [ ] **Step 3: Implement** the helpers and gateway changes; queries use `include: acceptedMembers` / `{ ...acceptedMembers, Task: ... }`. Update the one existing `tasklistDeleted` caller in `TasklistService.remove` to pass `[list.userId]` for now (Task 6 replaces it).
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: list roles and member fan-out in TaskGateway`

---

### Task 3: Notification module

**Files:**
- Create: `src/notification/notification.types.ts`, `notification.service.ts`, `notification.service.spec.ts`, `notification.controller.ts`, `notification.controller.spec.ts`, `notification.module.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: `Notification` model (Task 1).
- Produces:
  - `notificationSchema` (zod discriminated union on `type`, payloads exactly as in the spec) and `type NotificationPayload = z.infer<typeof notificationSchema>`
  - `NotificationService.create(userIds: number[], payload: NotificationPayload, tx?: Prisma.TransactionClient): Promise<Notification[]>`: parses `payload` (throws on invalid), one row per recipient, returns created rows (use `createManyAndReturn`)
  - `NotificationService.findAll(userId: number, unread: boolean): Promise<Notification[]>`: newest first, `take: 50` with `// shortcut: first 50 only, paginate when feeds grow`; rows failing `notificationSchema` are logged and dropped
  - `NotificationService.markRead(id: number, userId: number): Promise<Notification>`: 404 if not the user's; keeps an existing `readAt`
  - `NotificationService.markAllRead(userId: number): Promise<{ count: number }>`
  - `NotificationService.deleteForList(taskListId: number, tx?: Prisma.TransactionClient): Promise<void>`: `where: { data: { path: ['taskListId'], equals: taskListId } }`
  - `NotificationService.deleteInvite(taskListId: number, userId: number, tx?): Promise<void>`: same filter plus `userId`, `type: 'INVITE'`
  - `NotificationService.markInviteRead(taskListId: number, userId: number, tx?): Promise<void>`
  - Routes (`@Can.Anyone()`, `@Controller('notification')`): `GET /notification?unread=true`, `PATCH /notification/:id/read`, `POST /notification/read-all` (`@HttpCode(200)`)
  - `actorName(user: { name: string | null; email: string }): string` exported from `notification.types.ts` (name, else email)

- [ ] **Step 1: Write failing tests**
  - schema: valid INVITE and TASK_COMPLETED parse; TASK_COMPLETED without `taskId` and unknown `type: 'FOO'` fail.
  - service: `create([2, 3], payload)` calls `createManyAndReturn` with two rows of `{ userId, type, data }`; `create` with invalid payload rejects; `findAll` filters `readAt: null` only when `unread`, drops a row whose `data` is `{}`; `markRead` on another user's id → `NotFoundException`; `deleteForList(10)` uses the JSON path filter above.
  - controller: `unread` query `'true'` → `findAll(user.id, true)`; absent → `false`.
- [ ] **Step 2: Run** `npx vitest run src/notification` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the files; register `NotificationModule` in `AppModule` imports.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: notification feed (types, service, routes)`

---

### Task 4: Task access, inbox, member edit rules, completion notices

**Files:**
- Modify: `src/task/task.service.ts`, `task.service.spec.ts`, `task.controller.ts`, `task.controller.spec.ts`, `task.module.ts` (import `NotificationModule`)

**Interfaces:**
- Consumes: `listRole`, `acceptedMembers`, `listUserIds` (Task 2); `NotificationService.create`, `actorName` (Task 3); `TaskGateway.notificationsCreated`.
- Produces:
  - `TaskService.findAll(user)`: `ForbiddenException` unless `OwnerPolicy` `viewAll`; returns all tasks
  - `TaskService.findInbox(user): Promise<Task[]>`: `where: { userId: user.id, taskListId: null }`, ordered by id; route `GET /task/inbox` declared **before** `GET /task/:id`
  - `TaskService.findAccessible(id, user): Promise<{ task: Task & { TaskList: (TaskList & ListWithMembers) | null }; role: 'owner' | 'member' | 'creator' | 'admin' }>`: in no list → creator only; in a list → `listRole` (`'owner'`/`'member'`); else admin via `viewAll` → `'admin'`; else `NotFoundException`. `findOne` returns its `task` without the relation.
  - Update rules: `'member'` with any key other than `completed` → `ForbiddenException`; others any field.
  - Delete rules: `'member'` → `ForbiddenException`; task in a list and caller `'creator'` impossible by construction; owner/creator/admin allowed.

- [ ] **Step 1: Write failing tests** (extend the existing mocks with `taskList.findUnique` including `TaskListMember`)
  - `findAll` as USER → `ForbiddenException`; as ADMIN → all.
  - `findInbox` queries `{ userId, taskListId: null }`.
  - member 5 of list 10: `findOne(21)` OK; non-member → 404; **pending invitee (no accepted row) → 404**.
  - member `update(21, { completed: true })` OK; `update(21, { title: 'x' })` → 403; `remove(21)` → 403.
  - owner `remove` of a task created by member → OK.
  - completing task 21 (was `completedAt: null`) by member 5 in a list with owner 1 and members 5, 6 → `NotificationService.create([1, 6], { type: 'TASK_COMPLETED', data: { taskListId: 10, listTitle, taskId: 21, taskTitle, actorId: 5, actorName } })` then `gateway.notificationsCreated(rows)`.
  - **completing an already completed task → no `create` call.** Uncompleting → no call. Completing a task in no list → no call; in a list with no other users → no call.
- [ ] **Step 2: Run** `npx vitest run src/task` — Expected: FAIL.
- [ ] **Step 3: Implement.** Notification failures must not fail the update: wrap create+emit in try/catch with `logger.error`.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: membership-aware task access and completion notices`

---

### Task 5: Task list reads (`role`, `include=tasks`, member lists)

**Files:**
- Modify: `src/tasklist/tasklist.service.ts`, `tasklist.service.spec.ts`, `tasklist.controller.ts`, `tasklist.controller.spec.ts`

**Interfaces:**
- Consumes: `listRole`, `acceptedMembers` (Task 2).
- Produces:
  - `TasklistService.findAll(user, includeTasks: boolean)`: non-admin `where: { OR: [{ userId }, { TaskListMember: { some: { userId, acceptedAt: { not: null } } } }] }`; admin `{}`. Each result `{ ...list, role }` without the `TaskListMember` array; `Task` (ordered by id) only when `includeTasks`.
  - Controller: `@Query('include') include?: string`; `includeTasks = include === 'tasks'`.
  - `TasklistService.findOne(id, user)`: owner/member/admin as before plus `role`; pending invitee → 404. Returns `{ ...list, Task, role }`.
  - private `findOwned` unchanged in meaning (owner only, 403 otherwise).

- [ ] **Step 1: Write failing tests:** member sees shared list with `role: 'member'`; owner `'owner'`; admin on a foreign list `role: null`; `include=tasks` adds `Task`, absent omits it; **pending invitee `findOne` → 404**; member `update`/`remove` → 403.
- [ ] **Step 2: Run** `npx vitest run src/tasklist` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: shared lists in tasklist reads, role and include=tasks`

---

### Task 6: Task list writes (delete, move in, move out)

**Files:**
- Modify: `src/tasklist/tasklist.service.ts`, `tasklist.service.spec.ts`, `tasklist.module.ts` (import `NotificationModule`)

**Interfaces:**
- Consumes: `TaskService.findAccessible` (Task 4), `NotificationService.deleteForList` (Task 3), `TaskGateway.tasklistDeleted(listId, userIds)` (Task 2).
- Produces:
  - `remove(id, user)`: owner only. One `$transaction`: delete tasks `{ taskListId: id, NOT: { userId: list.userId } }`; `deleteForList(id, tx)`; delete the list (owner's tasks go to Inbox via `SetNull`, members cascade). After commit: `tasklistDeleted(id, listUserIds(listBeforeDelete))`; `taskChanged('task.updated', t)` for each owner task that was in the list (read them before deleting).
  - `addTask(id, taskId, user)`: caller's `listRole` on target is `'owner'` or `'member'` (else 404 / admin 403 as today). Task must be either `taskListId === null && task.userId === user.id`, or `taskListId !== null` and caller owns the source list; otherwise `ForbiddenException`. Removes the old "different owners" check. Count lock and both `tasklistUpdated` emits stay.
  - `removeTask(id, taskId, user)`: owner only (unchanged via `findOwned`), but reads the task through `findAccessible` so a member-created task can be found.

- [ ] **Step 1: Write failing tests:** member moves own Inbox task 40 into list 10 → OK; member moves someone else's Inbox task → 404 (not accessible); member moves a task from list 10 to their own list 13 → 403 (not owner of source); owner moves between two owned lists → OK, both lists emit; owner `removeTask` of member-created task → OK; member `removeTask` → 403; `remove(10)` deletes `{ taskListId: 10, NOT: { userId: 1 } }`, calls `deleteForList(10, tx)`, emits `tasklist.deleted` to owner + members; max-tasks 409 still holds.
- [ ] **Step 2: Run** `npx vitest run src/tasklist` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: shared-list delete and move rules`

---

### Task 7: Members (invite, accept, list, remove)

**Files:**
- Create: `src/tasklist/member.service.ts`, `member.service.spec.ts`, `member.controller.ts`, `member.controller.spec.ts`, `src/tasklist/dto/invite-member.dto.ts`
- Modify: `src/tasklist/tasklist.module.ts`

**Interfaces:**
- Consumes: `listRole`, `acceptedMembers`, `listUserIds` (Task 2); `NotificationService.create/deleteInvite/markInviteRead`, `actorName` (Task 3); `TaskGateway.notificationsCreated/tasklistUpdated/tasklistDeleted`; `TasklistService.findOne` (Task 5).
- Produces:
  - `inviteMemberSchema = z.strictObject({ email: z.email() })`, `InviteMemberDto`
  - `type MemberEntry = { id: number; name: string | null; email: string; role: 'owner' | 'member'; acceptedAt: Date | null }`
  - `MemberService.list(listId, user): Promise<MemberEntry[]>`: owner/accepted member/admin; owner first (`acceptedAt` = list `createdAt`), then members by `invitedAt`, pending included
  - `MemberService.invite(listId, email, user): Promise<MemberEntry>`: caller must be owner (403 for member/admin, 404 if list invisible); no user with that email → 404; inviting own email → 400; existing row → 409 (also map Prisma `P2002` to 409). Creates row + INVITE notification in one transaction, then `notificationsCreated`.
  - `MemberService.accept(listId, user)`: pending row for caller else 404; sets `acceptedAt`, `markInviteRead`; emits `tasklistUpdated(listId)`; returns `TasklistService.findOne(listId, user)`.
  - `MemberService.remove(listId, target: number | 'me', user): Promise<void>`: resolve `'me'` to `user.id`. Owner removing self → 400. Non-owner removing anyone but self → 403. Admin → 403. Missing row → 404. Deletes row + `deleteInvite` in one transaction; if the row was accepted, `tasklistDeleted(listId, [targetId])` and `tasklistUpdated(listId)`.
  - Routes on `@Controller('tasklist/:id/member')`, `@Can.Anyone()`: `GET`, `POST` (`@Body({ schema: inviteMemberSchema })`), `POST me/accept`, `DELETE :userId` (`@HttpCode(204)`; parse `'me'` or int, else 400).

- [ ] **Step 1: Write failing tests:**
  - invite: owner invites `b@x.io` → row + `NotificationService.create([bId], { type: 'INVITE', data: { taskListId, listTitle, actorId, actorName } })`; unknown email → 404; own email → 400; existing → 409; **`P2002` from create → 409**; **member invites → 403; admin invites on a foreign list → 403**.
  - accept: pending → sets `acceptedAt`, `markInviteRead`; no pending row → 404; **admin without invite → 404**.
  - remove: owner kicks member → row deleted, `deleteInvite`, `tasklistDeleted(listId, [memberId])`; member leaves via `'me'` → OK; invitee declines via `'me'` → OK, no `tasklistDeleted`; **owner removes `'me'` → 400; member removes another member → 403**; `'abc'` → 400.
  - list: pending invitee → 404; member → owner first then members.
- [ ] **Step 2: Run** `npx vitest run src/tasklist` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run build` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: invite, accept, list and remove list members`

---

### Task 8: End-to-end sharing flow

**Files:**
- Create: `e2e/tests/sharing.spec.ts` (repo root `e2e/`)

**Interfaces:**
- Consumes: `newUser`, `API` from `e2e/tests/helpers.ts`; the HTTP routes above.

- [ ] **Step 1: Write the test** (API only, `request` fixture, bearer tokens):
  owner creates list + task (moved in); owner invites member by email (201); member `GET /notification?unread=true` has one `INVITE` with that `taskListId`; member accepts; member `GET /tasklist?include=tasks` shows the list with `role: 'member'` and the task; member `PATCH /task/:id { title }` → 403; member `PATCH { completed: true }` → 200; owner `GET /notification` has `TASK_COMPLETED` with `actorId` = member; member leaves; member `GET /tasklist/:id` → 404; owner still sees the task in the list.
- [ ] **Step 2: Run** from `e2e/`: `npx playwright test sharing.spec.ts` against the compose stack (watch picks up the backend; run `docker compose exec backend npx prisma migrate deploy --config prisma7.config.ts` first if the container hasn't migrated).
  Expected: PASS.
- [ ] **Step 3: Commit** `test(e2e): shared list invite/accept/complete flow`

---

### Task 9: Keep the tasks page working (minimal frontend fix)

`GET /task` is admin-only now, and CI runs the e2e suite, which must pass for the PR to merge. Smallest fix, no new UI: shared lists stay hidden from members until the frontend PR.

**Files:**
- Modify: `frontend/app/(app)/tasks/page.tsx` (`loadBoard`, lines ~59-75, and the `Tasklist` type at line 35)

**Interfaces:**
- Consumes: `GET /task/inbox` (Task 4), `GET /tasklist?include=tasks` with `role` and `Task` (Task 5).
- Produces: `loadBoard()` still returns `{ tasks: Task[]; lists: Tasklist[] }` with the same meaning (the user's own lists and the tasks in them plus their Inbox), so `Inbox`/`Lists` components are untouched.

- [ ] **Step 1: Change `loadBoard`:** fetch `/task/inbox` and `/tasklist?include=tasks`; `lists` = those with `role === 'owner'`; `tasks` = inbox tasks plus `lists.flatMap((l) => l.Task)`. Drop the `currentUserId()` call and the `mine` filter if nothing else uses them. Add `role` and `Task: Task[]` to the `Tasklist` type. Update the comment above `loadBoard`.
- [ ] **Step 2: Verify** from `frontend/`: `npm run lint && npm run build`. Expected: clean.
- [ ] **Step 3: Run** the full e2e suite from `e2e/` against the compose stack. Expected: all PASS, including `tasks.spec.ts`, `admin.spec.ts` and `sharing.spec.ts`.
- [ ] **Step 4: Commit** `fix(frontend): load the board from /task/inbox and /tasklist?include=tasks`
