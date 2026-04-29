#!/usr/bin/env node
/**
 * Sanity test for the consecutivo-padding fix on src/aduanet.js
 * (buildPedimentoId).
 *
 * Run: node test/consecutivo-padding.test.js
 *
 * Pre-fix behavior: `const seq = String(consecutivo || '').trim();`
 * produced 5-digit consec on DODA rows because aduanet returns 5-digit
 * DODA reference numbers natively. Result: 260 historical pedimentos
 * rows had pedimento_id like "26 24 3596 53784" — failing the SAT
 * Anexo 22 Apéndice 1 format `^\d{2}\s\d{2}\s\d{4}\s\d{7}$`.
 *
 * Post-fix: `.padStart(7, '0')` ensures every consecutivo lands as 7
 * digits regardless of source length. Real 7-digit pedimento
 * consecutivos pass through unchanged; shorter DODA references get
 * leading zeros.
 */
const assert = require('node:assert/strict');
const { buildPedimentoId } = require('../src/aduanet');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`✓ ${name}`); pass++; }
  catch (e) { console.error(`✗ ${name}\n   ${e.message}`); fail++; }
}

// ── Real pedimentos: 7-digit consecutivo passes through unchanged ──────────
t('7-digit pedimento consecutivo passes through unchanged', () => {
  const id = buildPedimentoId({
    meta: { fecha_pago: '2026-04-23' },
    aduana: '240',
    patente: '3596',
    consecutivo: '6500299',
  });
  assert.equal(id, '26 24 3596 6500299');
});

t('another 7-digit pedimento consecutivo passes through', () => {
  const id = buildPedimentoId({
    meta: { fecha_pago: '2025-11-13' },
    aduana: '240',
    patente: '3596',
    consecutivo: '5500003',
  });
  assert.equal(id, '25 24 3596 5500003');
});

// ── DODAs (the load-bearing case): 5-digit consec gets 7-digit padded ─────
t('5-digit DODA consecutivo gets zero-padded to 7 digits', () => {
  const id = buildPedimentoId({
    meta: {},  // DODAs have no at001 detail; meta is empty
    aduana: '240',
    patente: '3596',
    consecutivo: '53784',
  });
  assert.equal(id, `${String(new Date().getUTCFullYear()).slice(-2)} 24 3596 0053784`);
});

t('5-digit DODA consecutivo (different value) — leading zeros at front', () => {
  const id = buildPedimentoId({
    meta: {},
    aduana: '240',
    patente: '3596',
    consecutivo: '53462',
  });
  // 53462 → 0053462 (two leading zeros)
  assert.equal(id.slice(-7), '0053462');
});

// ── Edge cases ────────────────────────────────────────────────────────────
t('6-digit consecutivo gets one leading zero', () => {
  const id = buildPedimentoId({
    meta: { fecha_pago: '2026-01-01' },
    aduana: '240',
    patente: '3596',
    consecutivo: '999999',
  });
  assert.equal(id, '26 24 3596 0999999');
});

t('1-digit consecutivo (extreme edge) gets six leading zeros', () => {
  const id = buildPedimentoId({
    meta: { fecha_pago: '2026-01-01' },
    aduana: '240',
    patente: '3596',
    consecutivo: '7',
  });
  assert.equal(id, '26 24 3596 0000007');
});

t('numeric consecutivo input is coerced and padded', () => {
  const id = buildPedimentoId({
    meta: { fecha_pago: '2026-01-01' },
    aduana: '240',
    patente: '3596',
    consecutivo: 53784,  // number, not string
  });
  assert.equal(id, '26 24 3596 0053784');
});

t('consecutivo with surrounding whitespace gets trimmed before padding', () => {
  const id = buildPedimentoId({
    meta: { fecha_pago: '2026-01-01' },
    aduana: '240',
    patente: '3596',
    consecutivo: '  53784  ',
  });
  assert.equal(id, '26 24 3596 0053784');
});

t('null consecutivo produces 7 zeros (defensive)', () => {
  const id = buildPedimentoId({
    meta: { fecha_pago: '2026-01-01' },
    aduana: '240',
    patente: '3596',
    consecutivo: null,
  });
  assert.equal(id, '26 24 3596 0000000');
});

t('empty-string consecutivo produces 7 zeros (defensive)', () => {
  const id = buildPedimentoId({
    meta: { fecha_pago: '2026-01-01' },
    aduana: '240',
    patente: '3596',
    consecutivo: '',
  });
  assert.equal(id, '26 24 3596 0000000');
});

// ── Format compliance — every output must match the SAT regex ─────────────
const SAT_REGEX = /^\d{2}\s\d{2}\s\d{4}\s\d{7}$/;

t('every output passes the SAT Anexo 22 Apéndice 1 regex', () => {
  // The exact regex used in the customs domain audit and in
  // gsd-verify ratchets — an output that fails this is a regression.
  const cases = [
    { meta: { fecha_pago: '2026-04-23' }, aduana: '240', patente: '3596', consecutivo: '6500299' },
    { meta: { fecha_pago: '2025-11-13' }, aduana: '240', patente: '3596', consecutivo: '5500003' },
    { meta: {},                            aduana: '240', patente: '3596', consecutivo: '53784' },
    { meta: { fecha_pago: '2026-01-01' }, aduana: '240', patente: '3596', consecutivo: '7' },
    { meta: { fecha_pago: '2026-01-01' }, aduana: '470', patente: '3712', consecutivo: '999999' },
  ];
  for (const c of cases) {
    const id = buildPedimentoId(c);
    assert.match(id, SAT_REGEX, `Output "${id}" failed SAT regex`);
  }
});

// ── Regression guard: pre-fix behavior would have failed this ─────────────
t('REGRESSION GUARD — pre-fix would write "26 24 3596 53784" (5 digits); now writes "26 24 3596 0053784" (7)', () => {
  const id = buildPedimentoId({
    meta: { fecha_pago: '2026-04-29' },
    aduana: '240',
    patente: '3596',
    consecutivo: '53784',
  });
  // Pre-fix output would have been "26 24 3596 53784" — passes the
  // /^(\d{2})\s(\d{2})\s(\d{4})\s(\d+)$/ loose regex but fails the
  // strict SAT regex. Post-fix: zero-padded to 7.
  assert.match(id, SAT_REGEX, 'Post-fix output must satisfy strict SAT regex');
  assert.equal(id, '26 24 3596 0053784');
  // Sanity: the consecutivo segment is exactly 7 digits.
  assert.equal(id.split(' ')[3].length, 7);
});

console.log('');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
