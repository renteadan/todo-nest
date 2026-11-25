'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login } from './actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(login, {});

  return (
    <form action={action} className="flex flex-col gap-6">
      <h1 className="display mb-2 text-5xl">Log in</h1>
      <label className="field-label">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="field"
        />
      </label>
      <label className="field-label">
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="field"
        />
      </label>
      <p aria-live="polite" className="text-sm text-danger empty:hidden">
        {state.error}
      </p>
      <button disabled={pending} className="btn mt-2 min-h-12">
        {pending ? 'Logging in…' : 'Log in'}
      </button>
      <p className="text-sm text-muted">
        New here?{' '}
        <Link href="/signup" className="link">
          Create an account
        </Link>
      </p>
    </form>
  );
}
