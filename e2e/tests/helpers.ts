import { execFileSync } from 'node:child_process';
import {
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from '@playwright/test';

/** The compose backend, as the browser reaches it. */
export const API = process.env.API_URL ?? 'http://localhost:3001';
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

export type User = {
  id: number;
  name: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
};

/**
 * A fresh account through the API, so tests don't share data. Emails start
 * with `e2e-` so these users are easy to spot in a dev database.
 */
export async function newUser(
  request: APIRequestContext,
  name = 'E2E User',
): Promise<User> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'password1234';
  const reg = await request.post(`${API}/auth/register`, {
    data: { name, email, password },
  });
  expect(reg.ok(), await reg.text()).toBe(true);
  const { id } = (await reg.json()) as { id: number };
  const login = await request.post(`${API}/auth/login`, {
    data: { email, password },
  });
  expect(login.ok(), await login.text()).toBe(true);
  const tokens = (await login.json()) as {
    accessToken: string;
    refreshToken: string;
  };
  return { id, name, email, password, ...tokens };
}

/** Signs the browser in by setting the session cookies the login form would. */
export async function signIn(context: BrowserContext, user: User) {
  await context.addCookies([
    {
      name: 'access_token',
      value: user.accessToken,
      url: BASE,
      httpOnly: true,
    },
    {
      name: 'refresh_token',
      value: user.refreshToken,
      url: BASE,
      httpOnly: true,
    },
  ]);
}

/** Raw call as `user`, so a test can assert non-2xx statuses too. */
export function call(
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

/** Calls the backend as `user`. */
export function api(request: APIRequestContext, user: User) {
  const headers = { Authorization: `Bearer ${user.accessToken}` };
  const send = async (method: string, path: string, data?: object) => {
    const res = await request.fetch(`${API}${path}`, { method, headers, data });
    expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
    return res.json().catch(() => null);
  };
  return {
    createTask: (data: {
      title: string;
      description?: string;
      deadline?: string;
    }) => send('POST', '/task', data) as Promise<{ id: number }>,
    createList: (title: string) =>
      send('POST', '/tasklist', { title }) as Promise<{ id: number }>,
    moveToList: (taskId: number, listId: number) =>
      send('POST', `/tasklist/${listId}/task/${taskId}`),
    complete: (taskId: number) =>
      send('PATCH', `/task/${taskId}`, { completed: true }),
  };
}

/**
 * Makes `user` an admin. There is no API for it, so this edits the compose
 * database directly; the email is one newUser() generated, never user input.
 */
export function makeAdmin(user: User) {
  execFileSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'todo',
      '-d',
      'todo',
      '-c',
      `UPDATE "User" SET role = 'ADMIN' WHERE email = '${user.email}'`,
    ],
    { cwd: new URL('../..', import.meta.url), stdio: 'pipe' },
  );
}

/** Relative luminance (0 black – 1 white) of an element's computed colour. */
export async function luminance(
  page: Page,
  selector: string,
  property: 'backgroundColor' | 'color' = 'backgroundColor',
  pseudo?: string,
) {
  const element = page.locator(selector).first();
  // Streamed content first lands in a hidden div; measure the placed copy.
  await expect(element).toBeVisible();
  return element.evaluate(
    (el, [prop, pseudo]) => {
      const [r, g, b] = getComputedStyle(el, pseudo ?? null)
        [prop as 'color'].match(/[\d.]+/g)!
        .map(Number)
        .map((c) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    },
    [property, pseudo] as const,
  );
}

/**
 * Opens the navbar's profile menu and returns the names of its items. The
 * admin links stream in, sometimes after `load`: until a Suspense boundary
 * resolves, React leaves a `<template id="B:…">` placeholder in its place.
 */
export async function openProfileMenu(page: Page) {
  const menu = page.locator('#profile-menu');
  await expect(menu.locator('template[id^="B:"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Account' }).click();
  await expect(menu).toBeVisible();
  return menu.locator('a, button').allInnerTexts();
}
