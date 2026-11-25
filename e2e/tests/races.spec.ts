import { expect, test, type APIRequestContext } from '@playwright/test';
import { api, call, newUser, type User } from './helpers';

// Each round fires two conflicting requests at once; enough rounds that
// the old, unlocked code failed most of them.
const ROUNDS = 20;

async function shareWith(
  request: APIRequestContext,
  owner: User,
  member: User,
) {
  const list = await api(request, owner).createList('Shared');
  for (const [user, method, path, data] of [
    [owner, 'POST', `/tasklist/${list.id}/member`, { email: member.email }],
    [member, 'POST', `/tasklist/${list.id}/member/me/accept`, undefined],
  ] as const) {
    const res = await call(request, user, method, path, data);
    expect(res.ok(), await res.text()).toBe(true);
  }
  return list;
}

test('a task added while its shared list is deleted is deleted with it', async ({
  request,
}) => {
  const owner = await newUser(request, 'Owner');
  const member = await newUser(request, 'Member');
  for (let i = 0; i < ROUNDS; i++) {
    const list = await shareWith(request, owner, member);
    const task = await api(request, member).createTask({ title: `t${i}` });
    const [del, add] = await Promise.all([
      call(request, owner, 'DELETE', `/tasklist/${list.id}`),
      call(request, member, 'POST', `/tasklist/${list.id}/task/${task.id}`),
    ]);
    expect(del.status()).toBe(200);
    expect(add.status()).toBeLessThan(500);
    const after = await call(request, member, 'GET', `/task/${task.id}`);
    // Added before the delete: deleted with the list. Else: still in the Inbox.
    if (add.ok()) expect(after.status()).toBe(404);
    else expect((await after.json()).taskListId).toBeNull();
  }
});

test('one Inbox task added to two lists at once lands in exactly one', async ({
  request,
}) => {
  const owner = await newUser(request, 'Owner');
  const member = await newUser(request, 'Member');
  const memberApi = api(request, member);
  for (let i = 0; i < ROUNDS; i++) {
    const shared = await shareWith(request, owner, member);
    const own = await memberApi.createList('Mine');
    const task = await memberApi.createTask({ title: `t${i}` });
    const [toShared, toOwn] = await Promise.all([
      call(request, member, 'POST', `/tasklist/${shared.id}/task/${task.id}`),
      call(request, member, 'POST', `/tasklist/${own.id}/task/${task.id}`),
    ]);
    // The loser gets 409 if it raced under the locks, 403 if it ran after.
    expect([toShared.ok(), toOwn.ok()].filter(Boolean)).toHaveLength(1);
    for (const res of [toShared, toOwn])
      if (!res.ok()) expect([403, 409]).toContain(res.status());
    const after = await call(request, member, 'GET', `/task/${task.id}`);
    expect((await after.json()).taskListId).toBe(
      toShared.ok() ? shared.id : own.id,
    );
  }
});
