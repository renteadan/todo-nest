import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Get things done.
      </h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        A simple todo app: make lists, add tasks, tick them off.
      </p>
      <Link
        href="/signup"
        className="rounded-full bg-foreground px-6 py-3 font-medium text-background transition-opacity hover:opacity-85"
      >
        Sign up
      </Link>
      <Link href="/login" className="underline">
        Log in
      </Link>
    </main>
  );
}
