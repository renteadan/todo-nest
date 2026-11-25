import Link from 'next/link';
import { Suspense } from 'react';
import { authFetch, currentUserId } from './lib/session';
import { logout } from './login/actions';
import { MenuLink } from './menu-link';
import { NotificationBell } from './notification-bell';
import { ThemeSwitch } from './theme-switch';

/** Top bar of the logged-in pages: app name, theme switch, notifications, profile menu. */
export function Navbar() {
  return (
    <nav className="navbar">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-2.5">
        <Link href="/tasks" className="display text-2xl">
          Todo
        </Link>
        <div className="flex items-center gap-5">
          <ThemeSwitch />
          {/* Reads the session, so it streams in at request time. */}
          <Suspense fallback={null}>
            <NotificationBell />
          </Suspense>
          <button
            type="button"
            popoverTarget="profile-menu"
            aria-label="Account"
            className="profile-btn"
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden
              className="size-5"
              fill="currentColor"
            >
              <circle cx="10" cy="7" r="3.5" />
              <path d="M3.5 17a6.5 6.5 0 0 1 13 0z" />
            </svg>
          </button>
          <div id="profile-menu" popover="auto" className="menu">
            {/* Reads the session, so it streams in at request time. */}
            <Suspense fallback={null}>
              <AdminLink />
            </Suspense>
            <form action={logout}>
              <button className="menu-item">Log out</button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}

/**
 * Admins switch between the tasks and admin pages here; each link is hidden
 * on its own page. The backend still guards /admin itself.
 */
async function AdminLink() {
  const res = await authFetch(`/user/${await currentUserId()}`);
  if (!res.ok) return null;
  const { role } = (await res.json()) as { role: string };
  return role === 'ADMIN' ? (
    <>
      <MenuLink href="/tasks">Tasks</MenuLink>
      <MenuLink href="/admin">Admin</MenuLink>
    </>
  ) : null;
}
