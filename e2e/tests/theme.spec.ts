import { expect, test } from '@playwright/test';
import { luminance, newUser, signIn } from './helpers';

// Palette-agnostic: "dark" means a background luminance under 0.05.
const DARK = 0.05;

test.beforeEach(async ({ context, request }) => {
  await signIn(context, await newUser(request));
});

test('follows the system theme until the switch pins one', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/tasks');
  const toggle = page.getByRole('switch', { name: 'Dark mode' });
  await expect(toggle).toBeChecked();
  expect(await luminance(page, 'body')).toBeLessThan(DARK);

  // Still following the system: it updates when the system flips.
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(toggle).not.toBeChecked();
  expect(await luminance(page, 'body')).toBeGreaterThan(0.5);

  // Pinned dark survives a reload, against a light system.
  await toggle.click();
  await expect(toggle).toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
  await page.reload();
  await expect(toggle).toBeChecked();
  expect(await luminance(page, 'body')).toBeLessThan(DARK);

  // Back to what the system shows: the pin is dropped.
  await toggle.click();
  expect(await page.evaluate(() => localStorage.getItem('theme'))).toBeNull();
  expect(
    await page.evaluate(() => document.documentElement.dataset.theme ?? null),
  ).toBeNull();
});

test('the switch changes every colour at once, with no fade', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/tasks');
  await page.locator('.section').first().waitFor();
  const [soon, settled] = await page.evaluate(async () => {
    const card = document.querySelector('.section')!;
    (document.querySelector('nav .switch') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 30));
    const soon = getComputedStyle(card).backgroundColor;
    await new Promise((r) => setTimeout(r, 500));
    return [soon, getComputedStyle(card).backgroundColor];
  });
  expect(soon).toBe(settled);
});

test('login page has the switch and keeps the brand panel light', async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/login');
  await expect(page.getByRole('switch', { name: 'Dark mode' })).toBeChecked();
  expect(await luminance(page, 'body')).toBeLessThan(DARK);
  expect(await luminance(page, '.auth-panel')).toBeGreaterThan(0.3);
  expect(await luminance(page, '.auth-panel', 'color')).toBeLessThan(0.1);
});
