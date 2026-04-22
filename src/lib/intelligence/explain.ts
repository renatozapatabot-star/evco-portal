/**
 * Render a VerdePrediction into structured human-readable output.
 *
 * Why this exists:
 *   The predictor emits `factors: Array<{ factor, delta_pp, detail }>`
 *   and the admin page concatenates the top 2 factors into a string.
 *   That inline render is fine for one UI, but as we grow more
 *   consumers (Mensajería drafts, CRUZ AI tools, email reports, PDF
 *   exports) every place does it slightly differently.
 *
 *   `explainVerdePrediction` returns a structured output that every
 *   consumer can hydrate into its own format:
 *     - { headline, confidence_band_label, bullets, meta }
 *     - Sorted, signed, Spanish-labeled bullets
 *     - No React, no UI coupling — pure function
 *
 * Design:
 *   - Pure. Zero I/O. Input = VerdePrediction, output = ExplainOutput.
 *   - Deterministic ordering (magnitude desc, then lexicographic).
 *   - Band labels in Spanish + English (for reports / multi-surface).
 *   - Every bullet has { kind, signed_delta, label } so the consumer
 *     can color / icon separately from the text.
 */

import type { VerdePrediction } from './crossing-insights'

export interface ExplainBullet {
  /** The raw factor kind (streak, proveedor, streak_break, ...). */
  kind: string
  /** Signed pp contribution (+15, -10, ...). */
  signed_delta: number
  /** Human-readable Spanish label derived from the factor detail. */
  label: string
  /** 'positive' | 'negative' | 'neutral' for UI tone. */
  tone: 'positive' | 'negative' | 'neutral'
}

export interface ExplainOutput {
  /** The predictor's one-line summary (already Spanish). */
  headline: string
  /** 'alta' | 'media' | 'baja' — the band in Spanish. */
  confidence_band_label: 'alta' | 'media' | 'baja'
  /** The band in English for report use. */
  confidence_band_en: 'high' | 'medium' | 'low'
  /** The probability as a rounded integer percentage (0..100). */
  probability_pct: number
  /** Structured bullets sorted by magnitude desc. */
  bullets: ExplainBullet[]
  /** Short aggregate meta line: proveedor · total cruces · último cruce. */
  meta: string
}

export interface ExplainOptions {
  /** Max bullets to include. Default 5 (the predictor emits at most 5). */
  maxBullets?: number
  /** Date formatter for the meta line. Default: ISO slice to YYYY-MM-DD. */
  formatDate?: (iso: string) => string
}

/**
 * Render a VerdePrediction into a structured explanation.
 */
export function explainVerdePrediction(
  prediction: VerdePrediction,
  opts: ExplainOptions = {},
): ExplainOutput {
  const maxBullets = opts.maxBullets ?? 5
  const formatDate = opts.formatDate ?? defaultFormatDate

  // Sort factors by absolute delta desc. Stable on label for determinism.
  const sorted = [...prediction.factors]
    .sort((a, b) => {
      const absDelta = Math.abs(b.delta_pp) - Math.abs(a.delta_pp)
      if (absDelta !== 0) return absDelta
      return a.factor.localeCompare(b.factor)
    })
    .slice(0, maxBullets)

  const bullets: ExplainBullet[] = sorted.map((f) => ({
    kind: f.factor,
    signed_delta: f.delta_pp,
    label: f.detail,
    tone:
      f.delta_pp > 0 ? 'positive' : f.delta_pp < 0 ? 'negative' : 'neutral',
  }))

  const confidence_band_label =
    prediction.band === 'high' ? 'alta' : prediction.band === 'medium' ? 'media' : 'baja'

  const probability_pct = Math.round(prediction.probability * 100)

  const metaBits: string[] = []
  if (prediction.cve_proveedor) metaBits.push(`Proveedor ${prediction.cve_proveedor}`)
  metaBits.push(
    `${prediction.total_crossings} cruce${prediction.total_crossings === 1 ? '' : 's'} ventana`,
  )
  if (prediction.last_fecha_cruce) {
    metaBits.push(`último ${formatDate(prediction.last_fecha_cruce)}`)
  }
  const meta = metaBits.join(' · ')

  return {
    headline: prediction.summary,
    confidence_band_label,
    confidence_band_en: prediction.band,
    probability_pct,
    bullets,
    meta,
  }
}

/**
 * Render a one-line summary for terse surfaces (Telegram, list rows).
 * Never more than 160 chars; truncates the meta if needed.
 */
export function explainVerdePredictionOneLine(
  prediction: VerdePrediction,
  opts: ExplainOptions = {},
): string {
  const out = explainVerdePrediction(prediction, opts)
  const top = out.bullets[0]
  const factor = top ? ` · ${top.label}` : ''
  const full = `${prediction.cve_producto} · ${out.probability_pct}% verde (${out.confidence_band_label})${factor}`
  return full.length <= 160 ? full : `${full.slice(0, 157)}...`
}

/**
 * Render a plain-text block (for email / PDF / Mensajería). Uses
 * hyphen-bullets and a blank line between sections.
 */
export function explainVerdePredictionPlainText(
  prediction: VerdePrediction,
  opts: ExplainOptions = {},
): string {
  const out = explainVerdePrediction(prediction, opts)
  const lines: string[] = []
  lines.push(`${prediction.cve_producto}: ${out.probability_pct}% probable verde (confianza ${out.confidence_band_label}).`)
  lines.push('')
  if (out.bullets.length > 0) {
    lines.push('Factores:')
    for (const b of out.bullets) {
      const sign = b.signed_delta > 0 ? '+' : ''
      lines.push(`  - ${b.label} (${sign}${b.signed_delta} pp)`)
    }
    lines.push('')
  }
  lines.push(out.meta)
  return lines.join('\n')
}

function defaultFormatDate(iso: string): string {
  return iso.slice(0, 10)
}
