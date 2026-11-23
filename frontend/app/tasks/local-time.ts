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

// Calendar days as local `YYYY-MM-DD` strings (tasks/date-picker.tsx).
const pad = (n: number) => String(n).padStart(2, '0');

export const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Local midnight of `day`. */
export function toDate(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: string, n: number) {
  const d = toDate(day);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Clamps: Jan 31 + 1 month is the last day of February, not March 3. */
export function addMonths(day: string, n: number) {
  const d = toDate(day);
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0);
  target.setDate(Math.min(d.getDate(), last.getDate()));
  return ymd(target);
}
