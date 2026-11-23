'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** A profile-menu link to another page; hidden on the page it points to. */
export function MenuLink({
  href,
  children,
}: {
  href: '/tasks' | '/admin';
  children: React.ReactNode;
}) {
  if (usePathname() === href) return null;
  return (
    <Link href={href} className="menu-item">
      {children}
    </Link>
  );
}
