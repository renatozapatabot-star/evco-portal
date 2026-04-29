#!/usr/bin/env node
/**
 * Sanity test for the year-padding fix on src/aduanet.js
 * (deriveYearFromPedimento + buildPedimentoId).
 *
 * Run: node test/year-padding.test.js
 *
 * Plain Node + assert — no test framework dependency. The script
 * uses the same env-loading shim as the parent (loads .env.local
 * from ../../.env.local), but the helpers under test are pure
 * functions of the meta object so no Supabase / network access
 * is needed at test time.
 */
const assert = require('node:assert/strict');
const { deriveYearFromPedimento, buildPedimentoId } = require('../src/aduanet');

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    pass++;
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(`   ${e.message}`);
    fail++;
  }
}

// ── deriveYearFromPedimento ────────────────────────────────────────────────
t('fecha_pago in 2025 → "25" (the load-bearing case)', () => {
  assert.equal(deriveYearFromPedimento({ fecha_pago: '2025-04-23' }), '25');
});

t('fecha_pago in 2024 → "24"', () => {
  assert.equal(deriveYearFromPedimento({ fecha_pago: '2024-12-31' }), '24');
});

t('fecha_pago in 2026 → "26"', () => {
  assert.equal(deriveYearFromPedimento({ fecha_pago: '2026-01-15' }), '26');
});

t('fecha_pago missing, fecha_entrada falls through → year of fecha_entrada', () => {
  assert.equal(deriveYearFromPedimento({ fecha_entrada: '2023-07-04' }), '23');
});

t('fecha_pago wins over fecha_entrada when both present', () => {
  assert.equal(
    deriveYearFromPedimento({ fecha_pago: '2025-06-01', fecha_entrada: '2026-06-01' }),
    '25',
  );
});

t('empty meta falls back to current scrape year', () => {
  const expected = String(new Date().getUTCFullYear()).slice(-2);
  assert.equal(deriveYearFromPedimento({}), expected);
});

t('null meta falls back to current scrape year', () => {
  const expected = String(new Date().getUTCFullYear()).slice(-2);
  assert.equal(deriveYearFromPedimento(null), expected);
});

t('undefined meta falls back to current scrape year', () => {
  const expected = String(new Date().getUTCFullYear()).slice(-2);
  assert.equal(deriveYearFromPedimento(undefined), expected);
});

t('garbage fecha_pago string falls back to current year, no throw', () => {
  const expected = String(new Date().getUTCFullYear()).slice(-2);
  assert.equal(deriveYearFromPedimento({ fecha_pago: 'not-a-date' }), expected);
});

t('UTC year is used (does NOT shift by local timezone)', () => {
  // 2025-12-31T23:00Z is still 2025 in UTC even though some local zones see Jan 1.
  // Pedimento numbers are SAT records, not local-clock events.
  assert.equal(deriveYearFromPedimento({ fecha_pago: '2025-12-31T23:00:00Z' }), '25');
});

// ── buildPedimentoId — full SAT-format assembly ────────────────────────────
t('2025 pedimento builds "25 24 3596 5500003"', () => {
  const id = buildPedimentoId({
    meta: { fecha_pago: '2025-11-13' },
    aduana: '240',
    patente: '3596',
    consecutivo: '5500003',
  });
  assert.equal(id, '25 24 3596 5500003');
});

t('2026 pedimento builds "26 24 3596 6500299" (matches the probe sample)', () => {
  const id = buildPedimentoId({
    meta: { fecha_pago: '2026-04-23' },
    aduana: '240',
    patente: '3596',
    consecutivo: '6500299',
  });
  assert.equal(id, '26 24 3596 6500299');
});

t('aduana segment is the FIRST two digits of the 3-digit code (240 → 24)', () => {
  const id = buildPedimentoId({
    meta: { fecha_pago: '2026-01-01' },
    aduana: '470',
    patente: '3596',
    consecutivo: '5500001',
  });
  // 470 → "47" segment, not "70"
  assert.equal(id, '26 47 3596 5500001');
});

t('aduana shorter than 2 digits gets zero-padded', () => {
  const id = buildPedimentoId({
    meta: { fecha_pago: '2026-01-01' },
    aduana: '4',
    patente: '3596',
    consecutivo: '5500001',
  });
  assert.equal(id, '26 04 3596 5500001');
});

t('DODA-like row with empty meta uses current year fallback', () => {
  const expectedYr = String(new Date().getUTCFullYear()).slice(-2);
  const id = buildPedimentoId({
    meta: {},
    aduana: '240',
    patente: '3596',
    consecutivo: '53784',
  });
  assert.equal(id, `${expectedYr} 24 3596 53784`);
});

// ── Regression guard: the pre-fix bug behavior would have failed this ─────
t('REGRESSION GUARD — pre-fix behavior would write "26" on a 2025 pedimento; now writes "25"', () => {
  // The bug: `const yr = new Date().getFullYear().toString().slice(-2)` —
  // always today's year regardless of pedimento date. If the smoke run
  // happens in 2026 and the pedimento is dated 2025-11-13, the pre-fix
  // path stamped "26 24 3596 5500003". Post-fix should stamp "25 ...".
  const id = buildPedimentoId({
    meta: { fecha_pago: '2025-11-13' },
    aduana: '240',
    patente: '3596',
    consecutivo: '5500003',
  });
  assert.notEqual(id.slice(0, 2), '26', 'year segment should NOT be the scrape year (26) for a 2025 pedimento');
  assert.equal(id.slice(0, 2), '25', 'year segment should be the pedimento\'s actual fecha_pago year (25)');
});

console.log('');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
