/**
 * Sandbox: prediction explanation renderer — three output formats
 * for the same prediction object.
 *
 * Run: `npx tsx scripts/agent-sandbox/run-explain-prediction.ts`
 *
 * Use this to see what text your consumer (Mensajería, CRUZ AI,
 * Telegram, email, PDF) will receive for a given prediction shape.
 */

import {
  explainVerdePrediction,
  explainVerdePredictionOneLine,
  explainVerdePredictionPlainText,
} from '@/lib/intelligence/explain'
import type { VerdePrediction } from '@/lib/intelligence/crossing-insights'

// ── Fixtures — three prediction shapes ─────────────────────────────

const HIGH_CONFIDENCE: VerdePrediction = {
  cve_producto: 'SANDBOX-SKU-HI',
  probability: 0.97,
  band: 'high',
  summary: 'Probabilidad 97% de cruzar verde · confianza alta',
  factors: [
    { factor: 'streak', delta_pp: 15, detail: '5 verdes consecutivos (+15 pp)' },
    { factor: 'proveedor', delta_pp: 10, detail: 'Proveedor PRV_1 @ 98% verde (+10 pp)' },
    { factor: 'sample_confidence', delta_pp: 3, detail: '12 cruces en ventana (+3 pp)' },
  ],
  baseline_pct: 85,
  cve_proveedor: 'PRV_1',
  last_fecha_cruce: '2026-04-18T00:00:00Z',
  total_crossings: 12,
}

const LOW_CONFIDENCE: VerdePrediction = {
  cve_producto: 'SANDBOX-SKU-LO',
  probability: 0.52,
  band: 'low',
  summary: 'Probabilidad 52% de cruzar verde · confianza baja',
  factors: [
    { factor: 'streak_break', delta_pp: -15, detail: 'Racha reciente rota (-15 pp)' },
    { factor: 'fraccion_risk', delta_pp: -10, detail: 'Capítulo 39 @ 68% (-10 pp)' },
    { factor: 'proveedor', delta_pp: -10, detail: 'Proveedor PRV_9 @ 61% verde (-10 pp)' },
    { factor: 'sample_confidence', delta_pp: 3, detail: '8 cruces en ventana (+3 pp)' },
  ],
  baseline_pct: 85,
  cve_proveedor: 'PRV_9',
  last_fecha_cruce: '2026-04-15T00:00:00Z',
  total_crossings: 8,
}

const BASELINE_ONLY: VerdePrediction = {
  cve_producto: 'SANDBOX-SKU-NEW',
  probability: 0.85,
  band: 'medium',
  summary: 'Probabilidad 85% de cruzar verde · confianza media',
  factors: [],
  baseline_pct: 85,
  cve_proveedor: null,
  last_fecha_cruce: null,
  total_crossings: 1,
}

// ── Output ─────────────────────────────────────────────────────────
function demo(label: string, p: VerdePrediction) {
  console.log(`\n╔══ ${label} ══╗`)

  console.log('\n→ Structured output (for UI components):')
  console.log(JSON.stringify(explainVerdePrediction(p), null, 2))

  console.log('\n→ One-line (for Telegram, list rows — max 160 chars):')
  console.log(`  "${explainVerdePredictionOneLine(p)}"`)

  console.log('\n→ Plain-text (for email, PDF, Mensajería):')
  console.log(
    explainVerdePredictionPlainText(p)
      .split('\n')
      .map((l) => '  ' + l)
      .join('\n'),
  )
}

demo('High confidence · strong signals', HIGH_CONFIDENCE)
demo('Low confidence · multiple negatives', LOW_CONFIDENCE)
demo('Baseline only · new SKU with no signal', BASELINE_ONLY)

console.log('\n— end —')
