/**
 * Workflow runner — orchestrates detect → blend feedback → upsert.
 *
 * Called from:
 *   · /api/cron/daily-workflows — after every 5-minute delta sync.
 *   · Manual re-runs via the same endpoint with a POST body.
 *
 * Invariants:
 *   · Shadow mode only — writes status='shadow' on every new finding.
 *     Never flips a resolved/dismissed row back to shadow.
 *   · Tenant-scoped — resolves companies allowed via
 *     SHADOW_MODE_COMPANIES, skips everyone else.
 *   · Idempotent — unique (company_id, kind, signature) means
 *     re-running the detector just bumps last_seen_at + seen_count.
 *   · Soft on errors — a detector throwing never corrupts the
 *     other two; we capture + record under run_log for observability.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { SHADOW_MODE_COMPANIES, isShadowModeCompany } from './scope'
import { detectMissingNom } from './detectors/missing-nom'
import { detectHighValueRisk } from './detectors/high-value-risk'
import { detectDuplicateShipment } from './detectors/duplicate-shipment'
import { aggregateFeedback, blendConfidence, signatureFamily } from './feedback'
import type {
  DetectorContext,
  DetectedFinding,
  EntradaRow,
  PartidaRow,
  TraficoRow,
  WorkflowKind,
} from './types'
import { NOM_REGULATED_FRACTION_PREFIXES } from './nom-registry'

const TRAFICO_WINDOW_DAYS = 90
const TRAFICO_ROW_CAP = 2000
const PARTIDA_ROW_CAP = 8000
const ENTRADA_ROW_CAP = 3000

export interface RunOneResult {
  companyId: string
  detectors: Record<WorkflowKind, number>
  upserts: number
  errors: Array<{ step: string; message: string }>
}

export interface RunSummary {
  started_at: string
  finished_at: string
  ran_for: string[]
  results: RunOneResult[]
}

type AnyClient = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

async function fetchTraficos(
  supabase: AnyClient,
  companyId: string,
): Promise<TraficoRow[]> {
  const { data } = await supabase
    .from('traficos')
    .select(
      'trafico, estatus, fecha_llegada, pedimento, proveedores, valor_aduana_mxn, valor_comercial_usd, company_id',
    )
    .eq('company_id', companyId)
    .gte('fecha_llegada', daysAgoISO(TRAFICO_WINDOW_DAYS))
    .order('fecha_llegada', { ascending: false, nullsFirst: false })
    .limit(TRAFICO_ROW_CAP)
  return (data ?? []) as TraficoRow[]
}

async function fetchPartidas(
  supabase: AnyClient,
  companyId: string,
  traficos: TraficoRow[],
): Promise<Map<string, PartidaRow[]>> {
  const map = new Map<string, PartidaRow[]>()
  if (traficos.length === 0) return map

  const refs = traficos.map((t) => t.trafico).filter(Boolean)
  if (refs.length === 0) return map

  // globalpc_partidas is the source of truth for fraccion + value +
  // nom_certificate per shipment line. company_id filter enforces
  // tenant isolation per Block EE contract.
  const { data } = await supabase
    .from('globalpc_partidas')
    .select('trafico, fraccion, descripcion, valor_comercial_usd, cantidad, unidad, nom_certificate')
    .eq('company_id', companyId)
    .in('trafico', refs)
    .limit(PARTIDA_ROW_CAP)

  for (const row of (data ?? []) as PartidaRow[]) {
    const ref = row.trafico
    if (!ref) continue
    if (!map.has(ref)) map.set(ref, [])
    map.get(ref)!.push(row)
  }
  return map
}

async function fetchEntradas(
  supabase: AnyClient,
  companyId: string,
): Promise<EntradaRow[]> {
  const { data } = await supabase
    .from('entradas')
    .select('id, trafico, proveedor, invoice_number, valor_usd, fecha_llegada_mercancia, company_id')
    .eq('company_id', companyId)
    .gte('fecha_llegada_mercancia', daysAgoISO(TRAFICO_WINDOW_DAYS))
    .order('fecha_llegada_mercancia', { ascending: false, nullsFirst: false })
    .limit(ENTRADA_ROW_CAP)
  return (data ?? []) as EntradaRow[]
}

async function fetchFeedbackCounts(
  supabase: AnyClient,
  companyId: string,
): Promise<Map<string, { up: number; down: number }>> {
  const { data } = await supabase
    .from('workflow_feedback')
    .select('kind, signature, thumbs')
    .eq('company_id', companyId)
    .limit(5000)

  return aggregateFeedback(
    (data ?? []) as Array<{
      kind: WorkflowKind
      signature: string
      thumbs: 'up' | 'down'
    }>,
  )
}

function runDetectors(ctx: DetectorContext): DetectedFinding[] {
  return [
    ...detectMissingNom(ctx),
    ...detectHighValueRisk(ctx),
    ...detectDuplicateShipment(ctx),
  ]
}

async function upsertFinding(
  supabase: AnyClient,
  companyId: string,
  finding: DetectedFinding,
  confidence: number,
): Promise<'inserted' | 'bumped' | 'skipped'> {
  const nowIso = new Date().toISOString()

  // Check existing so we respect the append-only lifecycle:
  //   · status='shadow' → bump last_seen_at + seen_count + confidence.
  //   · status in ('acknowledged','dismissed','resolved') → leave alone.
  //     (a human has decided about it; the runner doesn't override.)
  const { data: existing } = await supabase
    .from('workflow_findings')
    .select('id, status, seen_count')
    .eq('company_id', companyId)
    .eq('kind', finding.kind)
    .eq('signature', finding.signature)
    .limit(1)
    .maybeSingle()

  if (existing) {
    if (existing.status !== 'shadow') return 'skipped'
    const { error } = await supabase
      .from('workflow_findings')
      .update({
        last_seen_at: nowIso,
        seen_count: (existing.seen_count ?? 0) + 1,
        confidence,
        severity: finding.severity,
        title_es: finding.title_es,
        detail_es: finding.detail_es,
        evidence: finding.evidence,
        proposal: finding.proposal,
      })
      .eq('id', existing.id)
    if (error) throw new Error(`update failed: ${error.message}`)
    return 'bumped'
  }

  const { error } = await supabase.from('workflow_findings').insert({
    company_id: companyId,
    kind: finding.kind,
    signature: finding.signature,
    severity: finding.severity,
    subject_type: finding.subject_type,
    subject_id: finding.subject_id,
    title_es: finding.title_es,
    detail_es: finding.detail_es,
    evidence: finding.evidence,
    proposal: finding.proposal,
    confidence,
    seen_count: 1,
    status: 'shadow',
  })
  if (error) throw new Error(`insert failed: ${error.message}`)
  return 'inserted'
}

export async function runWorkflowsForCompany(
  supabase: AnyClient,
  companyId: string,
): Promise<RunOneResult> {
  if (!isShadowModeCompany(companyId)) {
    return {
      companyId,
      detectors: { missing_nom: 0, high_value_risk: 0, duplicate_shipment: 0 },
      upserts: 0,
      errors: [{ step: 'scope', message: 'Tenant is not in SHADOW_MODE_COMPANIES' }],
    }
  }

  const errors: RunOneResult['errors'] = []
  const detectorCounts: Record<WorkflowKind, number> = {
    missing_nom: 0,
    high_value_risk: 0,
    duplicate_shipment: 0,
  }

  let traficos: TraficoRow[] = []
  let partidasByTrafico: Map<string, PartidaRow[]> = new Map()
  let entradas: EntradaRow[] = []
  let feedbackByFamily: Map<string, { up: number; down: number }> = new Map()

  try {
    traficos = await fetchTraficos(supabase, companyId)
  } catch (e) {
    errors.push({ step: 'fetch_traficos', message: (e as Error).message })
  }

  try {
    partidasByTrafico = await fetchPartidas(supabase, companyId, traficos)
  } catch (e) {
    errors.push({ step: 'fetch_partidas', message: (e as Error).message })
  }

  try {
    entradas = await fetchEntradas(supabase, companyId)
  } catch (e) {
    errors.push({ step: 'fetch_entradas', message: (e as Error).message })
  }

  try {
    feedbackByFamily = await fetchFeedbackCounts(supabase, companyId)
  } catch (e) {
    errors.push({ step: 'fetch_feedback', message: (e as Error).message })
  }

  const ctx: DetectorContext = {
    companyId,
    traficos,
    partidasByTrafico,
    entradas,
    nomRegulatedFracciones: NOM_REGULATED_FRACTION_PREFIXES,
  }

  let findings: DetectedFinding[] = []
  try {
    findings = runDetectors(ctx)
  } catch (e) {
    errors.push({ step: 'detectors', message: (e as Error).message })
  }

  let upserts = 0
  for (const f of findings) {
    detectorCounts[f.kind] = (detectorCounts[f.kind] ?? 0) + 1
    const family = signatureFamily(f.kind, f.signature)
    const blended = blendConfidence(f.base_confidence, feedbackByFamily.get(family) ?? null)
    try {
      const status = await upsertFinding(supabase, companyId, f, blended)
      if (status !== 'skipped') upserts += 1
    } catch (e) {
      errors.push({ step: `upsert:${f.kind}`, message: (e as Error).message })
    }
  }

  return { companyId, detectors: detectorCounts, upserts, errors }
}

export async function runAllShadowWorkflows(
  supabase: AnyClient,
): Promise<RunSummary> {
  const started_at = new Date().toISOString()
  const results: RunOneResult[] = []
  for (const companyId of SHADOW_MODE_COMPANIES) {
    const one = await runWorkflowsForCompany(supabase, companyId)
    results.push(one)
  }
  return {
    started_at,
    finished_at: new Date().toISOString(),
    ran_for: [...SHADOW_MODE_COMPANIES],
    results,
  }
}

export const __internal = {
  runDetectors,
  upsertFinding,
  fetchTraficos,
  fetchPartidas,
  fetchEntradas,
  fetchFeedbackCounts,
}
