/**
 * Workflow #2 — High-Value Risk Flagging.
 *
 * One detector, four risk patterns that share the same signal shape
 * (audit-risk). Each pattern produces a distinct signature so Ursula
 * can thumbs up/down them independently and the training loop can
 * tune confidence per pattern-class.
 *
 *   1. unusual_value        — valor_aduana more than 3× the supplier's
 *                             90-day median (or 3× the tenant median
 *                             when supplier history is too thin).
 *   2. fraccion_mismatch    — same descripción (normalized) previously
 *                             classified under a different fracción
 *                             within the same tenant.
 *   3. duplicate_pedimento  — two distinct traficos share a pedimento
 *                             number. Either a data-entry slip or a
 *                             real SAT-audit exposure.
 *   4. high_value_single    — valor_aduana > $250K USD without a
 *                             paid pedimento yet. Pure "needs eyes"
 *                             signal, low confidence, easy dismissal.
 */

import type {
  DetectorContext,
  DetectedFinding,
  FlagForReviewProposal,
  TraficoRow,
} from '../types'

const DETECTOR_VERSION = 'high_value_risk.v1'
const USD_SINGLE_SHIPMENT_THRESHOLD = 250_000
const UNUSUAL_VALUE_MULTIPLIER = 3
const MIN_SUPPLIER_HISTORY = 4

function median(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v) && v > 0)
  if (clean.length === 0) return null
  clean.sort((a, b) => a - b)
  const mid = Math.floor(clean.length / 2)
  return clean.length % 2 === 0
    ? (clean[mid - 1]! + clean[mid]!) / 2
    : clean[mid]!
}

function normalizeDescripcion(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildFlagProposal(reason: string): FlagForReviewProposal {
  return {
    action: 'flag_for_review',
    reviewer_role: 'operator',
    reason_es: reason,
  }
}

/** #1 — Single-shipment value signals. */
function detectUnusualValue(ctx: DetectorContext): DetectedFinding[] {
  const out: DetectedFinding[] = []

  const bySupplier = new Map<string, number[]>()
  for (const t of ctx.traficos) {
    const supplier = (t.proveedores ?? '').trim()
    if (!supplier) continue
    const v = t.valor_comercial_usd
    if (v == null || !Number.isFinite(v) || v <= 0) continue
    if (!bySupplier.has(supplier)) bySupplier.set(supplier, [])
    bySupplier.get(supplier)!.push(v)
  }

  const tenantValues = ctx.traficos
    .map((t) => t.valor_comercial_usd)
    .filter((v): v is number => typeof v === 'number' && v > 0)
  const tenantMedian = median(tenantValues)

  for (const t of ctx.traficos) {
    const v = t.valor_comercial_usd
    if (v == null || !Number.isFinite(v) || v <= 0) continue

    const supplier = (t.proveedores ?? '').trim()
    const history = bySupplier.get(supplier) ?? []
    // Compare vs supplier median when we have enough history, else tenant.
    const comparable = history.length >= MIN_SUPPLIER_HISTORY
      ? history.filter((x) => x !== v)
      : (tenantMedian != null ? [tenantMedian] : [])
    const refMedian = median(comparable)

    if (refMedian != null && v >= refMedian * UNUSUAL_VALUE_MULTIPLIER) {
      const signature = `high_value_risk:unusual_value:${t.trafico}`
      const multipleText = (v / refMedian).toFixed(1)
      out.push({
        kind: 'high_value_risk',
        signature,
        severity: v >= USD_SINGLE_SHIPMENT_THRESHOLD ? 'critical' : 'warning',
        subject_type: 'trafico',
        subject_id: t.trafico,
        title_es: `Valor inusual · embarque ${t.trafico}`,
        detail_es:
          `Declarado $${v.toLocaleString('en-US')} USD, ${multipleText}× la mediana ` +
          `${history.length >= MIN_SUPPLIER_HISTORY ? `del proveedor ${supplier}` : 'del patrón histórico'}. ` +
          `Conviene validar antes de pagar pedimento.`,
        base_confidence: history.length >= MIN_SUPPLIER_HISTORY ? 0.78 : 0.60,
        evidence: {
          detector_version: DETECTOR_VERSION,
          pattern: 'unusual_value',
          valor_comercial_usd: v,
          reference_median_usd: refMedian,
          multiplier: Number(multipleText),
          supplier_history_count: history.length,
          supplier,
          pedimento: t.pedimento,
        },
        proposal: buildFlagProposal(
          `Valor declarado ${multipleText}× la mediana histórica. Revisar factura + descripción antes de liberar.`,
        ),
      })
    }

    if (v >= USD_SINGLE_SHIPMENT_THRESHOLD && !t.pedimento) {
      const signature = `high_value_risk:high_value_single:${t.trafico}`
      out.push({
        kind: 'high_value_risk',
        signature,
        severity: 'warning',
        subject_type: 'trafico',
        subject_id: t.trafico,
        title_es: `Embarque alto sin pedimento · ${t.trafico}`,
        detail_es:
          `$${v.toLocaleString('en-US')} USD sin pedimento asignado. ` +
          `Prioridad de revisión por valor.`,
        base_confidence: 0.55,
        evidence: {
          detector_version: DETECTOR_VERSION,
          pattern: 'high_value_single',
          valor_comercial_usd: v,
          supplier,
        },
        proposal: buildFlagProposal(
          'Valor alto sin pedimento — alinear con Tito antes del cruce.',
        ),
      })
    }
  }

  return out
}

/** #2 — Descripción → fracción mismatch across tenant history. */
function detectFraccionMismatch(
  ctx: DetectorContext,
): DetectedFinding[] {
  const out: DetectedFinding[] = []

  // Walk every tenant partida to build the "canonical" fracción per description.
  const fraccionByDesc = new Map<string, Map<string, { count: number; examples: Set<string> }>>()
  for (const [trafico, parts] of ctx.partidasByTrafico) {
    for (const p of parts) {
      const key = normalizeDescripcion(p.descripcion)
      if (!key || !p.fraccion) continue
      if (!fraccionByDesc.has(key)) fraccionByDesc.set(key, new Map())
      const fracMap = fraccionByDesc.get(key)!
      const entry = fracMap.get(p.fraccion) ?? { count: 0, examples: new Set() }
      entry.count += 1
      entry.examples.add(trafico)
      fracMap.set(p.fraccion, entry)
    }
  }

  for (const [desc, fracMap] of fraccionByDesc) {
    if (fracMap.size < 2) continue
    // Pick the most-frequent fracción as canonical; everything else
    // is a candidate mismatch.
    const entries = Array.from(fracMap.entries())
    entries.sort((a, b) => b[1].count - a[1].count)
    const [canonicalFraccion, canonicalEntry] = entries[0]!
    for (let i = 1; i < entries.length; i++) {
      const [oddFraccion, oddEntry] = entries[i]!
      for (const traficoRef of oddEntry.examples) {
        const signature = `high_value_risk:fraccion_mismatch:${traficoRef}:${oddFraccion}`
        out.push({
          kind: 'high_value_risk',
          signature,
          severity: 'warning',
          subject_type: 'trafico',
          subject_id: traficoRef,
          title_es: `Fracción distinta · embarque ${traficoRef}`,
          detail_es:
            `Descripción clasificada como ${oddFraccion}; historial usa ` +
            `${canonicalFraccion} (${canonicalEntry.count} embarques). ` +
            `Validar clasificación arancelaria.`,
          base_confidence: Math.min(
            0.85,
            0.55 + 0.05 * Math.min(canonicalEntry.count, 6),
          ),
          evidence: {
            detector_version: DETECTOR_VERSION,
            pattern: 'fraccion_mismatch',
            descripcion_normalizada: desc,
            fraccion_observada: oddFraccion,
            fraccion_canonica: canonicalFraccion,
            historical_count: canonicalEntry.count,
          },
          proposal: buildFlagProposal(
            `Revisar clasificación: ${oddFraccion} vs canónica ${canonicalFraccion}.`,
          ),
        })
      }
    }
  }

  return out
}

/** #3 — Duplicate pedimento across distinct traficos. */
function detectDuplicatePedimento(
  ctx: DetectorContext,
): DetectedFinding[] {
  const out: DetectedFinding[] = []
  const byPedimento = new Map<string, TraficoRow[]>()
  for (const t of ctx.traficos) {
    if (!t.pedimento) continue
    const key = t.pedimento.trim()
    if (!key) continue
    if (!byPedimento.has(key)) byPedimento.set(key, [])
    byPedimento.get(key)!.push(t)
  }

  for (const [pedimento, group] of byPedimento) {
    if (group.length < 2) continue
    // Stable ordering so the signature is deterministic.
    const sorted = [...group].sort((a, b) => a.trafico.localeCompare(b.trafico))
    const ids = sorted.map((t) => t.trafico).join(',')
    for (const t of sorted) {
      const signature = `high_value_risk:duplicate_pedimento:${pedimento}:${t.trafico}`
      out.push({
        kind: 'high_value_risk',
        signature,
        severity: 'critical',
        subject_type: 'pedimento',
        subject_id: pedimento,
        title_es: `Pedimento ${pedimento} en dos embarques`,
        detail_es:
          `El pedimento está asignado a ${group.length} embarques: ${ids}. ` +
          `Revisar antes de que llegue a SAT.`,
        base_confidence: 0.9,
        evidence: {
          detector_version: DETECTOR_VERSION,
          pattern: 'duplicate_pedimento',
          pedimento,
          traficos: sorted.map((x) => x.trafico),
        },
        proposal: buildFlagProposal(
          `Pedimento compartido por ${group.length} embarques — corregir asignación.`,
        ),
      })
    }
  }

  return out
}

export function detectHighValueRisk(ctx: DetectorContext): DetectedFinding[] {
  return [
    ...detectUnusualValue(ctx),
    ...detectFraccionMismatch(ctx),
    ...detectDuplicatePedimento(ctx),
  ]
}

export const __internal = {
  median,
  normalizeDescripcion,
  detectUnusualValue,
  detectFraccionMismatch,
  detectDuplicatePedimento,
}
