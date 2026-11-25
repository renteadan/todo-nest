import { expect, test } from '@playwright/test';
import { api, luminance, newUser, signIn, type User } from './helpers';

let user: User;

test.beforeEach(async ({ context, request }) => {
  user = await newUser(request);
  await signIn(context, user);
});

test('create a task and a list, then drag the task into the list', async ({
  page,
}) => {
  await page.goto('/tasks');
  await page.getByLabel('Task title').fill('Buy milk');
  await page.getByLabel('Task title').press('Enter');
  const inbox = page.locator('.drop-zone.inbox');
  await expect(inbox.getByText('Buy milk')).toBeVisible();

  await page.getByLabel('List name').fill('Groceries');
  await page.getByRole('button', { name: 'Create list' }).click();
  const list = page.locator('.drop-zone', {
    has: page.getByRole('heading', { name: 'Groceries' }),
  });
  await expect(list).toBeVisible();

  await inbox.locator('.task-row', { hasText: 'Buy milk' }).dragTo(list);
  const moved = list.locator('.task-row', { hasText: 'Buy milk' });
  await expect(moved).toBeVisible();
  // The landing animation runs on the row that just arrived.
  await expect(moved).toHaveAttribute('data-landed');
  await expect(inbox.getByText('Buy milk')).toHaveCount(0);

  await page.reload();
  await expect(list.getByText('Buy milk')).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`a ticked task's tick stands out from its disc (${scheme})`, async ({
    page,
    request,
  }) => {
    await api(request, user).createTask({ title: 'Water plants' });
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/tasks');
    const check = page.getByRole('button', { name: 'Complete Water plants' });
    await check.click();
    // Done tasks are hidden until the list's "Show done" switch is on.
    await page.getByRole('switch', { name: 'Show done' }).check();
    await expect(
      page.getByRole('button', { name: 'Reopen Water plants' }),
    ).toHaveAttribute('aria-pressed', 'true');
    const tick = await luminance(page, '.check[aria-pressed="true"]', 'color');
    const disc = await luminance(page, '.check[aria-pressed="true"]');
    // WCAG contrast ratio for a graphic: 3:1 or better.
    const ratio = (Math.max(tick, disc) + 0.05) / (Math.min(tick, disc) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });
}

test('the create-task and create-list rows line up', async ({ page }) => {
  await page.goto('/tasks');
  const height = (name: string, role: 'textbox' | 'button') =>
    page
      .getByRole(role, { name })
      .evaluate((el) => el.getBoundingClientRect().height);
  const taskInput = await height('Task title', 'textbox');
  expect(await height('Add task', 'button')).toBe(taskInput);
  expect(await height('List name', 'textbox')).toBe(taskInput);
  expect(await height('Create list', 'button')).toBe(taskInput);
});
