'use server'
/**
 * Block 3 · Dynamic Report Builder — server actions.
 * Thin wrappers over the API routes for client components.
 */
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { runReportQuery, runReportPreview } from '@/lib/report-engine'
import { parseReportConfig } from '@/lib/report-config-validator'
import { SEED_TEMPLATES } from '@/lib/report-templates'
import type { ReportConfig, ReportTemplateRow } from '@/types/reports'

async function requireSession() {
  const jar = await cookies()
  const token = jar.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) throw new Error('UNAUTHORIZED')
  const claveCliente = jar.get('company_clave')?.value ?? null
  return { session, claveCliente }
}

export async function previewReportAction(config: ReportConfig) {
  const { session, claveCliente } = await requireSession()
  const cfg = parseReportConfig(config)
  if (!cfg.ok) return { ok: false as const, message: cfg.message }
  return runReportPreview(cfg.config, {
    companyId: session.companyId,
    role: session.role,
    claveCliente,
  })
}

export async function buildReportAction(config: ReportConfig) {
  const { session, claveCliente } = await requireSession()
  const cfg = parseReportConfig(config)
  if (!cfg.ok) return { ok: false as const, message: cfg.message }
  return runReportQuery(cfg.config, {
    companyId: session.companyId,
    role: session.role,
    claveCliente,
  })
}

export async function listTemplatesAction() {
  const { session } = await requireSession()
  const sb = createServerClient()
  const { data, error } = await sb
    .from('report_templates')
    .select('*')
    .eq('company_id', session.companyId)
    .order('created_at', { ascending: false })
  if (error) return { ok: false as const, message: error.message }
  const userId = `${session.companyId}:${session.role}`
  const rows = (data ?? []) as ReportTemplateRow[]
  return {
    ok: true as const,
    private: rows.filter((r) => r.scope === 'private' && r.created_by === userId),
    team: rows.filter((r) => r.scope === 'team'),
    seed: rows.filter((r) => r.scope === 'seed'),
  }
}

/**
 * Idempotent server-side seed. Safe to call on every page load —
 * UNIQUE(company_id, name) guards against duplicates.
 */
export async function ensureSeedTemplatesAction(expedienteAlive: boolean) {
  const { session } = await requireSession()
  const sb = createServerClient()
  const { data: existing } = await sb
    .from('report_templates')
    .select('name')
    .eq('company_id', session.companyId)
    .eq('scope', 'seed')
  const existingNames = new Set((existing ?? []).map((r: { name: string }) => r.name))

  const toInsert = SEED_TEMPLATES
    .filter((t) => !existingNames.has(t.name))
    .filter((t) => !t.requiresTable || (t.requiresTable === 'expediente_documentos' && expedienteAlive))
    .map((t) => ({
      company_id: session.companyId,
      created_by: 'system:seed',
      name: t.name,
      source_entity: t.source_entity,
      config: t.config,
      scope: 'seed' as const,
    }))

  if (toInsert.length === 0) {
    return { ok: true as const, inserted: 0 }
  }

  // Use upsert with ignoreDuplicates equivalent via onConflict
  const { error } = await sb
    .from('report_templates')
    .upsert(toInsert, { onConflict: 'company_id,name', ignoreDuplicates: true })
  if (error) return { ok: false as const, message: error.message }
  return { ok: true as const, inserted: toInsert.length }
}
