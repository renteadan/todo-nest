import Link from 'next/link';
import { ThemeSwitch } from './theme-switch';

/** The login and signup frame: a marigold brand panel beside the form. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section className="auth-panel flex flex-col gap-6 px-6 py-7 sm:px-10 lg:justify-between lg:gap-12 lg:px-14 lg:py-14">
        <Link href="/" className="display w-fit text-3xl lg:text-4xl">
          Todo
        </Link>
        <div className="flex flex-col gap-5 lg:gap-8">
          <p className="display max-w-[11ch] text-4xl text-balance sm:text-6xl xl:text-7xl">
            Get things done.
          </p>
          <p className="hidden max-w-[38ch] text-lg text-pretty lg:block">
            Make lists, add tasks, tick them off.
          </p>
          <TickDemo />
        </div>
      </section>
      <div className="relative flex items-start justify-center px-6 py-10 sm:py-16 lg:items-center">
        <div className="absolute top-4 right-6 lg:top-6">
          <ThemeSwitch className="switch-label" />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}

const rows = ['Oat milk', 'Basil', 'Coffee beans'];

/** Decorative: a small list where "Oat milk", then "Basil", get ticked off, on a loop. */
function TickDemo() {
  return (
    <div aria-hidden className="demo-tab hidden max-w-60 lg:block">
      <p className="display mb-3 text-2xl">Groceries</p>
      <ul className="flex flex-col gap-0.5 text-sm">
        {rows.map((row, r) => (
          <li
            key={row}
            data-sync={r < 2 ? '' : undefined}
            style={{ '--delay': `${r * 0.9}s` } as React.CSSProperties}
            className="demo-row -mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1"
          >
            <span className="demo-check">
              <svg viewBox="0 0 12 12" className="size-2.5">
                <path
                  d="M2.5 6.2 5 8.5l4.5-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="demo-text line-through decoration-transparent">
              {row}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
