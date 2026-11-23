'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { AuthShell } from '../auth-shell';
import { signup } from './actions';

const link = 'font-medium text-foreground underline underline-offset-4';

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, {});

  return (
    <AuthShell>
      {state.success ? (
        <div className="flex flex-col gap-5">
          <h1 className="display text-5xl">You’re in</h1>
          <p className="text-muted">
            Your account is ready. Log in to make your first list.
          </p>
          <Link href="/" className="btn py-3 text-center">
            Log in
          </Link>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-5">
          <h1 className="display text-5xl">Create an account</h1>
          <label className="field-label">
            Name
            <input name="name" required autoComplete="name" className="field" />
          </label>
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
              minLength={8}
              autoComplete="new-password"
              aria-describedby="password-hint"
              className="field"
            />
            <span id="password-hint" className="font-normal text-muted">
              At least 8 characters.
            </span>
          </label>
          <p aria-live="polite" className="text-sm text-danger empty:hidden">
            {state.error}
          </p>
          <button disabled={pending} className="btn py-3">
            {pending ? 'Creating account…' : 'Create account'}
          </button>
          <p className="text-sm text-muted">
            Already have an account?{' '}
            <Link href="/" className={link}>
              Log in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
