import { expect, test, type APIRequestContext } from '@playwright/test';
import { API, api, newUser, type User } from './helpers';

const Status = {
  ok: 200,
  created: 201,
  noContent: 204,
  forbidden: 403,
  notFound: 404,
} as const;

/** Raw call as `user`, so a test can assert non-2xx statuses too. */
function call(
  request: APIRequestContext,
  user: User,
  method: string,
  path: string,
  data?: object,
) {
  return request.fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${user.accessToken}` },
    data,
  });
}

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
});
