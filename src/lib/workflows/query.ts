/**
 * Read-side queries for the dashboard widget + API.
 *
 * Every function takes a service-role Supabase client and a companyId;
 * RLS `FOR ALL USING (false)` on both tables means the service role is
 * the only reader — the app-layer filter is the primary isolation
 * gate per `.claude/rules/tenant-isolation.md`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { StoredFinding, WorkflowKind, WorkflowProposal } from './types'

type AnyClient = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const ACTIVE_STATUSES = ['shadow', 'acknowledged'] as const
const DEFAULT_LIMIT = 40

interface WorkflowFindingRow {
  id: string
  kind: string
  signature: string
  severity: string
  subject_type: string
  subject_id: string
  title_es: string
  detail_es: string
  evidence: unknown
  proposal: unknown
  confidence: number
  seen_count: number
  status: string
  created_at: string
  last_seen_at: string
}

function parseProposal(raw: unknown): WorkflowProposal {
  if (!raw || typeof raw !== 'object') {
    return { action: 'none', rationale_es: 'Sin propuesta registrada.' }
  }
  return raw as WorkflowProposal
}

function castRow(row: WorkflowFindingRow): StoredFinding {
  return {
    id: row.id,
    kind: row.kind as WorkflowKind,
    signature: row.signature,
    severity: row.severity as StoredFinding['severity'],
    subject_type: row.subject_type,
    subject_id: row.subject_id,
    title_es: row.title_es,
    detail_es: row.detail_es,
    evidence: (row.evidence as Record<string, unknown>) ?? {},
    proposal: parseProposal(row.proposal),
    confidence: Number(row.confidence) || 0,
    seen_count: row.seen_count,
    status: row.status as StoredFinding['status'],
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
  }
}

export interface ListFindingsOptions {
  /** Only active findings by default (shadow + acknowledged). */
  includeResolved?: boolean
  limit?: number
  kinds?: WorkflowKind[]
}

export async function listFindings(
  supabase: AnyClient,
  companyId: string,
  opts: ListFindingsOptions = {},
): Promise<StoredFinding[]> {
  if (!companyId) return []
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), 200)
  let query = supabase
    .from('workflow_findings')
    .select(
      'id, kind, signature, severity, subject_type, subject_id, title_es, detail_es, evidence, proposal, confidence, seen_count, status, created_at, last_seen_at',
    )
    .eq('company_id', companyId)
    .order('severity', { ascending: false })
    .order('confidence', { ascending: false })
    .order('last_seen_at', { ascending: false })
    .limit(limit)

  if (!opts.includeResolved) {
    query = query.in('status', [...ACTIVE_STATUSES])
  }
  if (opts.kinds && opts.kinds.length > 0) {
    query = query.in('kind', opts.kinds)
  }

  const { data } = await query
  const rows = (data ?? []) as WorkflowFindingRow[]
  return rows.map(castRow)
}

export interface WorkflowSummary {
  total: number
  by_kind: Record<WorkflowKind, number>
  by_severity: { info: number; warning: number; critical: number }
  last_run_at: string | null
}

export async function summarize(
  supabase: AnyClient,
  companyId: string,
): Promise<WorkflowSummary> {
  const empty: WorkflowSummary = {
    total: 0,
    by_kind: { missing_nom: 0, high_value_risk: 0, duplicate_shipment: 0 },
    by_severity: { info: 0, warning: 0, critical: 0 },
    last_run_at: null,
  }
  if (!companyId) return empty

  const findings = await listFindings(supabase, companyId, { limit: 200 })
  let lastRunIso: string | null = null
  for (const f of findings) {
    empty.total += 1
    empty.by_kind[f.kind] = (empty.by_kind[f.kind] ?? 0) + 1
    empty.by_severity[f.severity] = (empty.by_severity[f.severity] ?? 0) + 1
    if (!lastRunIso || f.last_seen_at > lastRunIso) lastRunIso = f.last_seen_at
  }
  empty.last_run_at = lastRunIso
  return empty
}

export async function setFindingStatus(
  supabase: AnyClient,
  findingId: string,
  companyId: string,
  status: 'acknowledged' | 'dismissed' | 'resolved',
  actorRole: string,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('workflow_findings')
    .update({
      status,
      resolved_at: status === 'resolved' || status === 'dismissed' ? now : null,
      resolved_by: actorRole,
    })
    .eq('id', findingId)
    .eq('company_id', companyId)
  if (error) throw new Error(`setFindingStatus: ${error.message}`)
}
