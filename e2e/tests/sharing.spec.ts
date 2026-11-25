import { expect, test, type Page } from '@playwright/test';
import { api, call, newUser, signIn } from './helpers';

const Status = {
  ok: 200,
  created: 201,
  noContent: 204,
  forbidden: 403,
  notFound: 404,
} as const;

test('invite, accept, member completes a task, owner is notified, member leaves', async ({
  request,
}) => {
  const owner = await newUser(request, 'Owner');
  const member = await newUser(request, 'Member');
  const ownerApi = api(request, owner);

  const list = await ownerApi.createList('Shared groceries');
  const task = await ownerApi.createTask({ title: 'Buy milk' });
  await ownerApi.moveToList(task.id, list.id);

  const invite = await call(
    request,
    owner,
    'POST',
    `/tasklist/${list.id}/member`,
    {
      email: member.email,
    },
  );
  expect(invite.status(), await invite.text()).toBe(Status.created);

  const unread = await call(
    request,
    member,
    'GET',
    '/notification?unread=true',
  );
  const invites = (await unread.json()) as {
    type: string;
    data: { taskListId: number };
  }[];
  expect(invites).toEqual([
    expect.objectContaining({
      type: 'INVITE',
      data: expect.objectContaining({ taskListId: list.id }),
    }),
  ]);

  const accept = await call(
    request,
    member,
    'POST',
    `/tasklist/${list.id}/member/me/accept`,
  );
  expect(accept.status(), await accept.text()).toBe(Status.created);

  const lists = (await (
    await call(request, member, 'GET', '/tasklist?include=tasks')
  ).json()) as { id: number; role: string; Task: { id: number }[] }[];
  const shared = lists.find((l) => l.id === list.id);
  expect(shared?.role).toBe('member');
  expect(shared?.Task.map((t) => t.id)).toEqual([task.id]);

  const rename = await call(request, member, 'PATCH', `/task/${task.id}`, {
    title: 'x',
  });
  expect(rename.status()).toBe(Status.forbidden);
  const complete = await call(request, member, 'PATCH', `/task/${task.id}`, {
    completed: true,
  });
  expect(complete.status(), await complete.text()).toBe(Status.ok);

  const feed = (await (
    await call(request, owner, 'GET', '/notification')
  ).json()) as {
    type: string;
    data: { actorId: number; taskId: number };
  }[];
  expect(feed).toContainEqual(
    expect.objectContaining({
      type: 'TASK_COMPLETED',
      data: expect.objectContaining({ actorId: member.id, taskId: task.id }),
    }),
  );

  const leave = await call(
    request,
    member,
    'DELETE',
    `/tasklist/${list.id}/member/me`,
  );
  expect(leave.status(), await leave.text()).toBe(Status.noContent);
  expect(
    (await call(request, member, 'GET', `/tasklist/${list.id}`)).status(),
  ).toBe(Status.notFound);

  const ownerView = (await (
    await call(request, owner, 'GET', `/tasklist/${list.id}`)
  ).json()) as { Task: { id: number }[] };
  expect(ownerView.Task.map((t) => t.id)).toEqual([task.id]);

  // Shared for good: with every member gone, the task still can't leave.
  const moveOut = await call(
    request,
    owner,
    'DELETE',
    `/tasklist/${list.id}/task/${task.id}`,
  );
  expect(moveOut.status()).toBe(Status.forbidden);
});

/** A list's section on the tasks page, found by its title. */
const section = (page: Page, title: string) =>
  page.locator('.drop-zone', {
    has: page.getByRole('heading', { name: title }),
  });

test('share from the UI: invite, accept from the bell, member adds and completes, owner is notified', async ({
  browser,
  request,
}) => {
  const owner = await newUser(request, 'Owner');
  const member = await newUser(request, 'Member');
  await api(request, owner).createList('Team');
  await api(request, member).createTask({ title: 'Bring cake' });

  const ownerPage = await (await browser.newContext()).newPage();
  await signIn(ownerPage.context(), owner);
  await ownerPage.goto('/tasks');
  await section(ownerPage, 'Team')
    .getByRole('button', { name: 'Members' })
    .click();
  const dialog = ownerPage.getByRole('dialog');
  await expect(dialog.getByText('Sharing is permanent')).toBeVisible();
  await dialog.getByLabel('Invite by email').fill(member.email);
  await dialog.getByRole('button', { name: 'Invite' }).click();
  await expect(
    dialog.getByRole('listitem').filter({ hasText: member.email }),
  ).toContainText('pending');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(section(ownerPage, 'Team').getByText('Shared')).toBeVisible();

  const memberPage = await (await browser.newContext()).newPage();
  await signIn(memberPage.context(), member);
  await memberPage.goto('/tasks');
  await memberPage
    .getByRole('button', { name: 'Notifications, 1 unread' })
    .click();
  const feed = memberPage.locator('#notifications');
  await expect(feed).toContainText('Owner invited you to Team');
  await feed.getByRole('button', { name: 'Accept' }).click();
  await expect(feed.getByText('Joined')).toBeVisible();
  await memberPage.keyboard.press('Escape');

  const shared = section(memberPage, 'Team');
  await memberPage
    .locator('.drop-zone.inbox .task-row', { hasText: 'Bring cake' })
    .dragTo(shared);
  await expect(shared.getByText('Bring cake')).toBeVisible();
  await shared.getByRole('button', { name: 'Complete Bring cake' }).click();
  // Done rows hide while "Show done" is off.
  await expect(shared.getByText('1 of 1 done')).toBeVisible();

  // Live: the owner's bell updates without a reload.
  await ownerPage
    .getByRole('button', { name: /Notifications, \d+ unread/ })
    .click();
  await expect(ownerPage.locator('#notifications')).toContainText(
    'Member completed Bring cake in Team',
  );
});

test('a member sees a read-only shared list and can leave it', async ({
  page,
  request,
}) => {
  const owner = await newUser(request, 'Owner');
  const member = await newUser(request, 'Member');
  const ownerApi = api(request, owner);
  const list = await ownerApi.createList('Chores');
  const task = await ownerApi.createTask({
    title: 'Mop',
    description: 'Kitchen',
  });
  await ownerApi.moveToList(task.id, list.id);
  await call(request, owner, 'POST', `/tasklist/${list.id}/member`, {
    email: member.email,
  });
  await call(request, member, 'POST', `/tasklist/${list.id}/member/me/accept`);

  await signIn(page.context(), member);
  await page.goto('/tasks');
  const chores = section(page, 'Chores');
  const row = chores.locator('.task-row', { hasText: 'Mop' });
  await expect(row).toBeVisible();
  await expect(row.getByText('Kitchen')).toBeVisible();
  await expect(row.locator('.grip')).toHaveCount(0);
  await expect(row).not.toHaveAttribute('draggable', 'true');
  await expect(chores.getByRole('button', { name: /^Edit / })).toHaveCount(0);
  await expect(chores.getByRole('button', { name: /^Delete / })).toHaveCount(0);
  await expect(
    chores.getByRole('button', { name: 'Rename Chores' }),
  ).toHaveCount(0);
  await expect(chores.getByRole('button', { name: 'Delete list' })).toHaveCount(
    0,
  );

  await chores.getByRole('button', { name: 'Leave list' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Leave' }).click();
  await expect(chores).toHaveCount(0);
});
