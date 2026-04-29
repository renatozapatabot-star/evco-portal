#!/usr/bin/env node
/**
 * Sanity test for the isoDate fix on src/aduanet.js.
 *
 * Run: node test/iso-date.test.js
 *
 * The original isoDate only handled dd/mm/yyyy (split on "/", length 3
 * required) and returned null for ISO inputs. Since the at001 XML
 * returns dates already in YYYY-MM-DD form, every fresh fecha_pago /
 * fecha_entrada wrote NULL to the DB despite the source having the
 * value. The fix accepts both formats and round-trips correctly.
 */
const assert = require('node:assert/strict');
const { isoDate } = require('../src/aduanet');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`✓ ${name}`); pass++; }
  catch (e) { console.error(`✗ ${name}\n   ${e.message}`); fail++; }
}

// ── ISO inputs (the load-bearing case — XML at001 returns these) ──────────
t('YYYY-MM-DD passes through', () => {
  assert.equal(isoDate('2026-04-23'), '2026-04-23');
});

t('YYYY-MM-DD with time portion truncates to date', () => {
  assert.equal(isoDate('2026-04-23T13:09:10'), '2026-04-23');
  assert.equal(isoDate('2026-04-23 13:09:10'), '2026-04-23');
});

t('YYYY-MM-DD UTC marker truncates to date', () => {
  assert.equal(isoDate('2026-04-23T13:09:10Z'), '2026-04-23');
});

t('YYYY-MM-DD with offset truncates to date', () => {
  assert.equal(isoDate('2025-11-13T05:00:00+00:00'), '2025-11-13');
});

// ── DD/MM/YYYY inputs (legacy HTML-report path) ───────────────────────────
t('dd/mm/yyyy transforms to ISO', () => {
  assert.equal(isoDate('23/04/2026'), '2026-04-23');
});

t('d/m/yyyy single-digit day+month pads correctly', () => {
  assert.equal(isoDate('5/3/2026'), '2026-03-05');
});

t('dd-mm-yyyy with hyphen separator also accepted', () => {
  assert.equal(isoDate('23-04-2026'), '2026-04-23');
});

// ── Round-trip: ISO → ISO → ISO is stable (idempotent) ────────────────────
t('round-trip ISO → isoDate → ISO is idempotent', () => {
  const a = '2025-11-13';
  const b = isoDate(a);
  const c = isoDate(b);
  assert.equal(a, b);
  assert.equal(b, c);
});

t('round-trip dd/mm/yyyy → isoDate → isoDate is stable', () => {
  const a = '13/11/2025';
  const b = isoDate(a);
  const c = isoDate(b);
  assert.equal(b, '2025-11-13');
  assert.equal(c, b); // calling isoDate on its own ISO output is a no-op
});

// ── Edge cases ────────────────────────────────────────────────────────────
t('null returns null', () => {
  assert.equal(isoDate(null), null);
});

t('undefined returns null', () => {
  assert.equal(isoDate(undefined), null);
});

t('empty string returns null', () => {
  assert.equal(isoDate(''), null);
});

t('whitespace-only returns null', () => {
  assert.equal(isoDate('   '), null);
});

t('garbage returns null', () => {
  assert.equal(isoDate('not-a-date'), null);
});

t('numeric input is coerced and parsed if format matches', () => {
  // String('2026-04-23') would be exotic, but the function uses String()
  // first. A bare number like 20260423 doesn't match either regex → null.
  assert.equal(isoDate(20260423), null);
});

t('YYYY-MM-DD with extra leading whitespace is trimmed', () => {
  assert.equal(isoDate('  2026-04-23  '), '2026-04-23');
});

t('REGRESSION GUARD — pre-fix would return null on ISO; now returns the date', () => {
  // The bug: split('/') on '2026-04-23' → ['2026-04-23'], length 1 ≠ 3,
  // returned null. This is what dropped every fresh fecha_pago to NULL.
  const result = isoDate('2026-04-23');
  assert.notEqual(result, null, 'isoDate must NOT return null for an ISO input');
  assert.equal(result, '2026-04-23');
});

console.log('');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
