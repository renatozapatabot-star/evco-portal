#!/usr/bin/env node
/**
 * Sanity test for the normalizeMoneda helper in scripts/globalpc-sync.js.
 *
 * Run from the parent dir:
 *   cd ~/evco-portal && node scripts/test/normalize-moneda.test.js
 *
 * Pre-fix behavior: globalpc-sync.js wrote `r.moneda` raw, propagating
 * GlobalPC's stale MXP literals to 6 Supabase tables (39,895 rows
 * across globalpc_facturas + 5 econta_* tables).
 *
 * Post-fix: every moneda value passes through normalizeMoneda which:
 *   - maps MXP (deprecated peso ISO code, retired 1993) → MXN
 *   - uppercases + trims (defensive for stray whitespace / case drift)
 *   - empty / whitespace-only inputs return null (we don't invent labels)
 *   - null / undefined pass through as null
 *   - every other code (USD, EUR, CAD, JPY, …) passes through uppercased
 */
require('dotenv').config({ path: __dirname + '/../../.env.local' });
const assert = require('node:assert/strict');
const { normalizeMoneda } = require('../globalpc-sync');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log(`✓ ${name}`); pass++; }
  catch (e) { console.error(`✗ ${name}\n   ${e.message}`); fail++; }
}

// ── MXP → MXN (the load-bearing case) ──────────────────────────────────────
t('MXP → MXN (the load-bearing case)', () => {
  assert.equal(normalizeMoneda('MXP'), 'MXN');
});

t('mxp lowercase → MXN', () => {
  assert.equal(normalizeMoneda('mxp'), 'MXN');
});

t('"MXP " trailing whitespace → MXN', () => {
  assert.equal(normalizeMoneda('MXP '), 'MXN');
});

t('" MXP" leading whitespace → MXN', () => {
  assert.equal(normalizeMoneda(' MXP'), 'MXN');
});

t('mixed-case Mxp → MXN', () => {
  assert.equal(normalizeMoneda('Mxp'), 'MXN');
});

// ── Pass-through for every other live currency ─────────────────────────────
t('USD passes through unchanged', () => {
  assert.equal(normalizeMoneda('USD'), 'USD');
});

t('MXN passes through unchanged (idempotency)', () => {
  assert.equal(normalizeMoneda('MXN'), 'MXN');
});

t('EUR passes through unchanged', () => {
  assert.equal(normalizeMoneda('EUR'), 'EUR');
});

t('CAD passes through unchanged', () => {
  assert.equal(normalizeMoneda('CAD'), 'CAD');
});

t('JPY passes through unchanged', () => {
  assert.equal(normalizeMoneda('JPY'), 'JPY');
});

t('lowercase usd → USD (uppercase normalization)', () => {
  assert.equal(normalizeMoneda('usd'), 'USD');
});

t('"usd " with whitespace → USD (trim + uppercase)', () => {
  assert.equal(normalizeMoneda(' usd '), 'USD');
});

// ── Null / empty / whitespace handling ─────────────────────────────────────
t('null input → null', () => {
  assert.equal(normalizeMoneda(null), null);
});

t('undefined input → undefined', () => {
  // The function returns the input as-is for null-ish (null/undefined),
  // so undefined stays undefined. Both null and undefined are
  // semantically "no value" downstream.
  assert.equal(normalizeMoneda(undefined), undefined);
});

t('empty string → null (no label invented)', () => {
  assert.equal(normalizeMoneda(''), null);
});

t('whitespace-only → null', () => {
  assert.equal(normalizeMoneda('   '), null);
});

// ── Idempotency — calling twice never changes the answer ───────────────────
t('idempotent on USD', () => {
  assert.equal(normalizeMoneda(normalizeMoneda('USD')), 'USD');
});

t('idempotent on MXP→MXN', () => {
  assert.equal(normalizeMoneda(normalizeMoneda('MXP')), 'MXN');
});

t('idempotent on lowercase eur', () => {
  assert.equal(normalizeMoneda(normalizeMoneda('eur')), 'EUR');
});

// ── REGRESSION GUARD — pre-fix would have written MXP straight through ────
t('REGRESSION GUARD — pre-fix passed MXP through unchanged; post-fix returns MXN', () => {
  // Pre-fix code: `moneda: r.moneda` (raw). On a row where r.moneda='MXP',
  // the DB landed 'MXP' verbatim. Post-fix path uses normalizeMoneda
  // and lands 'MXN'. The 39,895 historical rows were written by the
  // pre-fix path; this guard prevents a future regression.
  const result = normalizeMoneda('MXP');
  assert.notEqual(result, 'MXP', 'post-fix MUST NOT return MXP');
  assert.equal(result, 'MXN', 'post-fix MUST return MXN');
});

console.log('');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
