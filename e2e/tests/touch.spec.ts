// Runs in the "phone" project only (playwright.config.ts): a touch screen.
import { expect, test } from '@playwright/test';
import { api, newUser, signIn } from './helpers';

test.beforeEach(async ({ page, context, request }) => {
  const user = await newUser(request);
  const o = api(request, user);
  await o.createList('Groceries');
  await o.createTask({ title: 'Buy milk' });
  await signIn(context, user);
  await page.goto('/tasks');
});

test('small controls get a 44px tap area', async ({ page }) => {
  for (const selector of [
    'nav .switch',
    '.check',
    '.icon-danger',
    '.icon-quiet',
    '.profile-btn',
  ]) {
    const control = page.locator(selector).first();
    // Streamed content first lands in a hidden div, where sizes read as auto.
    await expect(control).toBeVisible();
    const [w, h] = await control.evaluate((el) => {
      const tap = getComputedStyle(el, '::after');
      return [parseFloat(tap.width), parseFloat(tap.height)];
    });
    expect(w, selector).toBeGreaterThanOrEqual(44);
    expect(h, selector).toBeGreaterThanOrEqual(44);
  }
});

test('row buttons are shown without hover, and the switch works by tap', async ({
  page,
}) => {
  await expect(page.locator('.icon-danger').first()).toHaveCSS('opacity', '1');
  const toggle = page.getByRole('switch', { name: 'Dark mode' });
  const before = await toggle.isChecked();
  await toggle.tap();
  await expect(toggle).toBeChecked({ checked: !before });
});
