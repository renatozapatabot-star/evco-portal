/**
 * Sandbox: Cruzó Verde predictor — exercise the pure predictor
 * against a fabricated streak + proveedor + fracción fixture.
 *
 * No database. No network. Pure function exercise.
 *
 * Run: `npx tsx scripts/agent-sandbox/run-predict-verde.ts`
 */

import { predictVerdeProbability } from '@/lib/intelligence/crossing-insights'
import {
  explainVerdePrediction,
  explainVerdePredictionOneLine,
  explainVerdePredictionPlainText,
} from '@/lib/intelligence/explain'

// ── Fixture ────────────────────────────────────────────────────────
// A SKU with a healthy 3-verde current streak, good proveedor,
// sample confidence threshold met.
const baselinePct = 82

const prediction = predictVerdeProbability({
  streak: {
    cve_producto: 'SANDBOX-SKU-A',
    current_verde_streak: 3,
    longest_verde_streak: 3,
    just_broke_streak: false,
    last_semaforo: 0,
    last_fecha_cruce: '2026-04-18T00:00:00Z',
    total_crossings: 6,
  },
  proveedor: {
    cve_proveedor: 'SANDBOX-PRV',
    total_crossings: 15,
    verde_count: 14,
    amarillo_count: 1,
    rojo_count: 0,
    pct_verde: 93,
    last_fecha_cruce: '2026-04-18T00:00:00Z',
  },
  fraccionHealth: {
    chapter: '39',
    total_crossings: 42,
    verde_count: 40,
    amarillo_count: 2,
    rojo_count: 0,
    pct_verde: 95,
    last_fecha_cruce: '2026-04-18T00:00:00Z',
  },
  baselinePct,
})

// ── Output ─────────────────────────────────────────────────────────
const explained = explainVerdePrediction(prediction)

console.log('\n=== Structured output ===')
console.log(JSON.stringify(explained, null, 2))

console.log('\n=== One-line (Telegram / list row) ===')
console.log(explainVerdePredictionOneLine(prediction))

console.log('\n=== Plain-text block (email / PDF) ===')
console.log(explainVerdePredictionPlainText(prediction))

console.log('\n=== Raw prediction factors ===')
for (const f of prediction.factors) {
  console.log(`  ${f.delta_pp >= 0 ? '+' : ''}${f.delta_pp}pp  ${f.factor}  ·  ${f.detail}`)
}
console.log(`\nBaseline: ${prediction.baseline_pct}%  →  Final: ${Math.round(prediction.probability * 100)}% (${prediction.band})`)
