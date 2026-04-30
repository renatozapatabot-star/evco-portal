/**
 * Workflow #3 — Duplicate Shipment Detection + Smart Merge.
 *
 * Catches the data-entry twin pattern. A shipment ingested twice shows
 * up as two traficos with overlapping (supplier, invoice, USD value,
 * arrival date). This happens when operators key the same MySQL row
 * by hand during GlobalPC delta-sync lag windows.
 *
 * Scoring:
 *   · same supplier                               + 0.25
 *   · same invoice number (normalized)            + 0.45
 *   · value within ±2%                            + 0.20
 *   · arrival dates within ±3 days                + 0.10
 * Findings only ship when score ≥ 0.70 so we don't noise the widget
 * with coincidences.
 *
 * Proposal carries which trafico we'd keep as primary (earliest
 * created, per Block EE's "oldest trusted" convention) and which
 * fields to reconcile. Shadow mode: no merge executes automatically.
 * A future /operador/acciones surface will one-click the merge once
 * Ursula's feedback confidence passes the promotion threshold.
 */

import type {
  DetectorContext,
  DetectedFinding,
  MergeShipmentsProposal,
  EntradaRow,
  TraficoRow,
} from '../types'

const DETECTOR_VERSION = 'duplicate_shipment.v1'
const SCORE_THRESHOLD = 0.70
const DATE_WINDOW_DAYS = 3
const VALUE_TOLERANCE = 0.02

function normalizeInvoice(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeSupplier(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

function daysBetween(a: string | null, b: string | null): number {
  if (!a || !b) return Number.POSITIVE_INFINITY
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return Number.POSITIVE_INFINITY
  return Math.abs(ta - tb) / 86_400_000
}

function valueWithinTolerance(a: number | null, b: number | null): boolean {
  if (a == null || b == null) return false
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  if (a === 0 && b === 0) return true
  const base = Math.max(Math.abs(a), Math.abs(b))
  if (base === 0) return false
  return Math.abs(a - b) / base <= VALUE_TOLERANCE
}

interface CandidateScore {
  score: number
  reasons: string[]
  fields: string[]
}

export function scoreDuplicate(
  a: TraficoRow,
  b: TraficoRow,
  invoicesForA: Set<string>,
  invoicesForB: Set<string>,
): CandidateScore {
  const reasons: string[] = []
  const fields: string[] = []
  let score = 0

  const supA = normalizeSupplier(a.proveedores)
  const supB = normalizeSupplier(b.proveedores)
  if (supA && supB && supA === supB) {
    score += 0.25
    reasons.push('Mismo proveedor')
    fields.push('proveedor')
  }

  const invOverlap = [...invoicesForA].some((x) => x && invoicesForB.has(x))
  if (invOverlap) {
    score += 0.45
    reasons.push('Factura compartida')
    fields.push('invoice_number')
  }

  if (valueWithinTolerance(a.valor_comercial_usd, b.valor_comercial_usd)) {
    score += 0.20
    reasons.push('Valor USD dentro de ±2%')
    fields.push('valor_comercial_usd')
  }

  if (daysBetween(a.fecha_llegada, b.fecha_llegada) <= DATE_WINDOW_DAYS) {
    score += 0.10
    reasons.push(`Llegadas en ≤${DATE_WINDOW_DAYS} días`)
    fields.push('fecha_llegada')
  }

  return { score: Math.min(1, score), reasons, fields }
}

function buildMergeProposal(
  primary: TraficoRow,
  duplicate: TraficoRow,
  reasons: string[],
  fields: string[],
): MergeShipmentsProposal {
  return {
    action: 'merge_shipments',
    primary_trafico: primary.trafico,
    duplicate_trafico: duplicate.trafico,
    rationale_es: reasons.join(' · '),
    fields_to_reconcile: fields,
  }
}

function invoicesByTrafico(entradas: EntradaRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const e of entradas) {
    if (!e.trafico) continue
    const norm = normalizeInvoice(e.invoice_number)
    if (!norm) continue
    if (!map.has(e.trafico)) map.set(e.trafico, new Set())
    map.get(e.trafico)!.add(norm)
  }
  return map
}

export function detectDuplicateShipment(
  ctx: DetectorContext,
): DetectedFinding[] {
  const out: DetectedFinding[] = []
  const invoicesMap = invoicesByTrafico(ctx.entradas)

  // Pairwise compare only within the same supplier bucket — O(n²) on a
  // ~1000-row window is fine, but supplier bucketing keeps it to the
  // handful of traficos per supplier per 90-day window in practice.
  const bySupplier = new Map<string, TraficoRow[]>()
  for (const t of ctx.traficos) {
    const key = normalizeSupplier(t.proveedores) || '__no_supplier__'
    if (!bySupplier.has(key)) bySupplier.set(key, [])
    bySupplier.get(key)!.push(t)
  }

  for (const group of bySupplier.values()) {
    if (group.length < 2) continue
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!
        const b = group[j]!
        const invA = invoicesMap.get(a.trafico) ?? new Set<string>()
        const invB = invoicesMap.get(b.trafico) ?? new Set<string>()
        const scored = scoreDuplicate(a, b, invA, invB)
        if (scored.score < SCORE_THRESHOLD) continue

        // Primary = first in natural alphabetical order (deterministic
        // across runs) so the signature is stable.
        const [primary, duplicate] = [a, b].sort((x, y) =>
          x.trafico.localeCompare(y.trafico),
        ) as [TraficoRow, TraficoRow]

        const signature =
          `duplicate_shipment:pair:${primary.trafico}:${duplicate.trafico}`
        out.push({
          kind: 'duplicate_shipment',
          signature,
          severity: scored.score >= 0.85 ? 'critical' : 'warning',
          subject_type: 'trafico',
          subject_id: primary.trafico,
          title_es: `Posible embarque duplicado · ${primary.trafico} y ${duplicate.trafico}`,
          detail_es: `${scored.reasons.join(' · ')}. Proponer fusión manteniendo ${primary.trafico} como primario.`,
          base_confidence: scored.score,
          evidence: {
            detector_version: DETECTOR_VERSION,
            primary: primary.trafico,
            duplicate: duplicate.trafico,
            score: scored.score,
            reasons: scored.reasons,
            primary_valor_comercial_usd: primary.valor_comercial_usd,
            duplicate_valor_comercial_usd: duplicate.valor_comercial_usd,
            primary_fecha_llegada: primary.fecha_llegada,
            duplicate_fecha_llegada: duplicate.fecha_llegada,
          },
          proposal: buildMergeProposal(primary, duplicate, scored.reasons, scored.fields),
        })
      }
    }
  }

  return out
}

export const __internal = {
  normalizeInvoice,
  normalizeSupplier,
  daysBetween,
  valueWithinTolerance,
  invoicesByTrafico,
}
