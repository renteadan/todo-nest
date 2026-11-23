import { AuthShell } from '../auth-shell';
import { LoginForm } from './login-form';

/** Where a dead session lands. Unlike / (see proxy.ts), it never redirects, so a rejected token can't loop. */
export default function LoginPage() {
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
