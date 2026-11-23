import { expect, test } from '@playwright/test';
import { api, makeAdmin, newUser, openProfileMenu, signIn } from './helpers';

// Deadlines show in the viewer's zone: 16:30 UTC is 18:30 in Bucharest.
test.use({ locale: 'en-GB', timezoneId: 'Europe/Bucharest' });

test('regular users get neither the link nor the page', async ({
  page,
  context,
  request,
}) => {
  await signIn(context, await newUser(request));
  await page.goto('/tasks');
  expect(await openProfileMenu(page)).toEqual(['Log out']);

  await page.goto('/admin');
  await expect(page.getByText('This page could not be found')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Admin' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Users' })).toHaveCount(0);
});

test('admins pick a user and see their tasks with their lists', async ({
  page,
  context,
  request,
}) => {
  const admin = await newUser(request, 'E2E Admin');
  makeAdmin(admin);
  const owner = await newUser(request, 'E2E Owner');
  const o = api(request, owner);
  const list = await o.createList('Groceries');
  const milk = await o.createTask({ title: 'Buy milk' });
  await o.moveToList(milk.id, list.id);
  await o.complete(milk.id);
  const plumber = await o.createTask({
    title: 'Call the plumber',
    deadline: '2026-12-01T16:30:00Z',
  });
  await o.moveToList(plumber.id, list.id);
  await o.createTask({ title: 'Water plants', description: 'Balcony too' });

  await signIn(context, admin);
  await page.goto('/tasks');
  expect(await openProfileMenu(page)).toEqual(['Admin', 'Log out']);
  await page
    .locator('#profile-menu')
    .getByRole('link', { name: 'Admin' })
    .click();
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.getByText('Pick a user to see their tasks.')).toBeVisible();
  // After a link click, Next keeps the previous page hidden in the DOM: the
  // navbar lives in the shared layout, so there is still one profile menu.
  await expect(page.locator('#profile-menu')).toHaveCount(1);

  const ownerLink = page.getByRole('link', { name: owner.email });
  await ownerLink.click();
  await expect(page).toHaveURL(new RegExp(`user=${owner.id}$`));
  await expect(ownerLink).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('1 of 3 done')).toBeVisible();

  // Inbox first, then the list's tasks together.
  const rows = page.locator('.admin-table tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).locator('td')).toHaveText([
    /Water plants.*Balcony too/,
    'Inbox',
    'Open',
    'None',
  ]);
  await expect(rows.nth(1).locator('td')).toHaveText([
    /Buy milk/,
    'Groceries',
    'Done',
    'None',
  ]);
  await expect(rows.nth(2).locator('td')).toHaveText([
    /Call the plumber/,
    'Groceries',
    'Open',
    /18:30/,
  ]);

  // The menu offers the way back, not a link to the page you're on.
  expect(await openProfileMenu(page)).toEqual(['Tasks', 'Log out']);
  await page
    .locator('#profile-menu')
    .getByRole('link', { name: 'Tasks' })
    .click();
  await expect(page).toHaveURL(/\/tasks$/);
});

test('an unknown user id says so', async ({ page, context, request }) => {
  const admin = await newUser(request, 'E2E Admin');
  makeAdmin(admin);
  await signIn(context, admin);
  await page.goto('/admin?user=999999999');
  await expect(page.getByText('No user with that id.')).toBeVisible();
});
