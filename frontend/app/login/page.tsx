'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login } from './actions';

const input =
  'rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700';

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, {});

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <form action={action} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Log in</h1>
        <label className="flex flex-col gap-1">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1">
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={input}
          />
        </label>
        <p aria-live="polite" className="text-sm text-red-600">
          {state.error}
        </p>
        <button
          disabled={pending}
          className="rounded-full bg-foreground px-6 py-3 font-medium text-background disabled:opacity-50"
        >
          {pending ? 'Logging in…' : 'Log in'}
        </button>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No account?{' '}
          <Link href="/signup" className="underline">
            Sign up
          </Link>
        </p>
      </form>
    </main>
  );
}
