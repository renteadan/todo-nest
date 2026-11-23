import { expect, test } from '@playwright/test';

test('a visitor can sign up, log in and log out', async ({ page }) => {
  const email = `e2e-ui-${Date.now()}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Name').fill('E2E Signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password1234');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'You’re in' })).toBeVisible();

  await page.getByRole('link', { name: 'Log in' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password1234');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible();

  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});

test('logged-out visitors are sent to the login page', async ({ page }) => {
  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/login$/);
});
