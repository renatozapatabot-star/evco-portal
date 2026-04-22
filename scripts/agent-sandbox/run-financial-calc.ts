/**
 * Sandbox: customs financial calculation — DTA · IGI · IVA with the
 * cascading base. No DB; uses fixed rates for demonstration.
 *
 * Run: `npx tsx scripts/agent-sandbox/run-financial-calc.ts`
 *
 * For the real thing, replace RATES with `await getDTARates()` +
 * `await getIVARate()` + `await getExchangeRate()` from
 * src/lib/rates.ts (requires .env.local + network).
 */

import { calculatePedimento } from '@/lib/financial/calculations'
import type { DTARates } from '@/lib/rates'

// ── Rates fixture (demo values; real values live in system_config) ─
const RATES: DTARates = {
  A1: { type: 'fixed', amount: 0.008 },   // 8 per-mille
  A3: { type: 'fixed', amount: 0.008 },
  IN: { type: 'fixed', amount: 408 },     // IMMEX cuota fija MXN
  IT: { type: 'fixed', amount: 0 },
  F4: { type: 'fixed', amount: 0.008 },
  F5: { type: 'fixed', amount: 0 },
  F6: { type: 'fixed', amount: 0.008 },
}

const IVA_RATE = 0.16
const TIPO_CAMBIO = 17.0

// ── Scenarios ──────────────────────────────────────────────────────
const scenarios = [
  {
    label: 'A1 general · non-T-MEC · $10K USD',
    input: {
      valor_usd: 10_000,
      tipo_cambio: TIPO_CAMBIO,
      regimen: 'A1' as const,
      igi_rate: 0.05,
      tmec_eligible: false,
      rates: RATES,
      iva_rate: IVA_RATE,
    },
  },
  {
    label: 'A1 T-MEC · $10K USD (5% IGI waived)',
    input: {
      valor_usd: 10_000,
      tipo_cambio: TIPO_CAMBIO,
      regimen: 'A1' as const,
      igi_rate: 0.05,
      tmec_eligible: true,
      rates: RATES,
      iva_rate: IVA_RATE,
    },
  },
  {
    label: 'IN IMMEX · $10K USD (fixed $408 DTA)',
    input: {
      valor_usd: 10_000,
      tipo_cambio: TIPO_CAMBIO,
      regimen: 'IN' as const,
      igi_rate: 0.05,
      tmec_eligible: false,
      rates: RATES,
      iva_rate: IVA_RATE,
    },
  },
  {
    label: 'IT temporary · $10K USD (DTA exempt)',
    input: {
      valor_usd: 10_000,
      tipo_cambio: TIPO_CAMBIO,
      regimen: 'IT' as const,
      igi_rate: 0.05,
      tmec_eligible: false,
      rates: RATES,
      iva_rate: IVA_RATE,
    },
  },
]

// ── Output ─────────────────────────────────────────────────────────
const fmt = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

for (const s of scenarios) {
  console.log(`\n=== ${s.label} ===`)
  const r = calculatePedimento(s.input)
  console.log(`  Valor aduana:  ${fmt(r.valor_aduana_mxn)} MXN`)
  console.log(`  DTA:           ${fmt(r.dta.dta_mxn)} MXN   (${r.dta.explanation})`)
  console.log(`  IGI:           ${fmt(r.igi.igi_mxn)} MXN   (${r.igi.explanation})`)
  console.log(`  IVA base:      ${fmt(r.iva.iva_base_mxn)} MXN   (cascading = aduana + DTA + IGI)`)
  console.log(`  IVA:           ${fmt(r.iva.iva_mxn)} MXN`)
  console.log(`  Total taxes:   ${fmt(r.total_taxes_mxn)} MXN`)
  console.log(`  Landed cost:   ${fmt(r.total_landed_mxn)} MXN  /  ${fmt(r.total_landed_usd)} USD`)
  if (r.tmec_savings_mxn !== null) {
    console.log(`  T-MEC savings: ${fmt(r.tmec_savings_mxn)} MXN  (IGI + cascade uplift)`)
  }
}

console.log('\n=== Regression fence: flat vs cascading IVA ===')
const flat = 170_000 * 0.16
const casc = calculatePedimento(scenarios[0].input).iva.iva_mxn
console.log(`  Flat (WRONG):      ${fmt(flat)} MXN`)
console.log(`  Cascading (RIGHT): ${fmt(casc)} MXN`)
console.log(`  Difference:        ${fmt(casc - flat)} MXN  (${((casc / flat - 1) * 100).toFixed(1)}% under-declared by flat)`)
