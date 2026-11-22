'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signup } from './actions';

const input =
  'rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700';

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, {});

  if (state.success) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <h1 className="text-2xl font-semibold">Account created</h1>
        <Link href="/login" className="underline">
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <form action={action} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Create an account</h1>
        <label className="flex flex-col gap-1">
          Name
          <input name="name" required autoComplete="name" className={input} />
        </label>
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
            minLength={8}
            autoComplete="new-password"
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
          {pending ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
    </main>
  );
}
