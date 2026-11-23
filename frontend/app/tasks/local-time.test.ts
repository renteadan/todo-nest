// Run: npm test (node --test; Node strips the types itself).
// A zone with daylight saving, so CI (UTC) tests the same thing as a laptop.
process.env.TZ = 'Europe/Bucharest';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, addMonths, localToUtc, utcToLocal } from './local-time.ts';

test('addMonths clamps to the last day of the month', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
});

test('addDays crosses months, years and daylight saving changes', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  // Bucharest switches clocks on 2026-03-29 and 2026-10-25.
  assert.equal(addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(addDays('2026-10-24', 7), '2026-10-31');
  assert.equal(addMonths('2026-03-29', 1), '2026-04-29');
});

test('local and UTC times round-trip', () => {
  assert.equal(utcToLocal(localToUtc('2026-12-01T18:30')), '2026-12-01T18:30');
  assert.equal(localToUtc(''), '');
});
