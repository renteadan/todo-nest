// For <input type="datetime-local">, whose value is local time with no zone.
// Browser only: on the server "local" would be the server's time zone.

/** `2026-12-01T18:30` (local) → `2026-12-01T16:30:00.000Z`; empty stays empty. */
export function localToUtc(local: string) {
  return local && new Date(local).toISOString();
}

/** The reverse: a UTC ISO time → `YYYY-MM-DDTHH:mm` in local time. */
export function utcToLocal(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
