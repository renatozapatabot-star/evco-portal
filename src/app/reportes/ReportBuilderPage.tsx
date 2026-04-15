/**
 * Block 3 · Dynamic Report Builder — server shell.
 */
import React from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { REPORT_ENTITIES } from '@/lib/report-registry'
import { SEED_TEMPLATES } from '@/lib/report-templates'
import { ReportHeader } from '@/components/reports/ReportHeader'
import { ReportBuilderClient } from './ReportBuilderClient'
import type { ReportEntityId, ReportTemplateRow } from '@/types/reports'
import { fmtDate } from '@/lib/format-utils'

async function probeTables(): Promise<{
  alive: ReportEntityId[]
  expedienteAlive: boolean
}> {
  const sb = createServerClient()
  const alive: ReportEntityId[] = []
  await Promise.all(
    REPORT_ENTITIES.map(async (entity) => {
      const { error } = await sb.from(entity.table).select('*', { head: true, count: 'exact' }).limit(1)
      if (!error) alive.push(entity.id)
    }),
  )
  const { error: edErr } = await sb
    .from('expediente_documentos')
    .select('*', { head: true, count: 'exact' })
    .limit(1)
  return { alive, expedienteAlive: !edErr }
}

async function ensureSeedTemplates(
  companyId: string,
  expedienteAlive: boolean,
): Promise<void> {
  const sb = createServerClient()
  const { data: existing } = await sb
    .from('report_templates')
    .select('name')
    .eq('company_id', companyId)
    .eq('scope', 'seed')
  const existingNames = new Set((existing ?? []).map((r: { name: string }) => r.name))
  const toInsert = SEED_TEMPLATES
    .filter((t) => !existingNames.has(t.name))
    .filter((t) => !t.requiresTable || (t.requiresTable === 'expediente_documentos' && expedienteAlive))
    .map((t) => ({
      company_id: companyId,
      created_by: 'system:seed',
      name: t.name,
      source_entity: t.source_entity,
      config: t.config,
      scope: 'seed' as const,
    }))
  if (toInsert.length === 0) return
  await sb
    .from('report_templates')
    .upsert(toInsert, { onConflict: 'company_id,name', ignoreDuplicates: true })
}

async function loadTemplates(companyId: string, userId: string) {
  const sb = createServerClient()
  const { data } = await sb
    .from('report_templates')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  const rows = (data ?? []) as ReportTemplateRow[]
  return {
    private: rows.filter((r) => r.scope === 'private' && r.created_by === userId),
    team: rows.filter((r) => r.scope === 'team'),
    seed: rows.filter((r) => r.scope === 'seed'),
  }
}

export interface ReportBuilderPageProps {
  initialTemplateId?: string
}

export async function ReportBuilderPage({
  initialTemplateId,
}: ReportBuilderPageProps = {}) {
  const jar = await cookies()
  const token = jar.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const { alive, expedienteAlive } = await probeTables()
  const allowedByRole = REPORT_ENTITIES.filter((e) => {
    if (e.roleGate && !e.roleGate.includes(session.role)) return false
    return alive.includes(e.id)
  }).map((e) => e.id)

  await ensureSeedTemplates(session.companyId, expedienteAlive)
  const templates = await loadTemplates(
    session.companyId,
    `${session.companyId}:${session.role}`,
  )

  return (
    <div className="mx-auto min-h-screen max-w-[1400px] px-4 py-6 lg:px-8">
      <ReportHeader
        title="Constructor de reportes"
        subtitle={`Generado ${fmtDate(new Date())}`}
      />
      <div className="mt-6">
        <ReportBuilderClient
          availableEntities={allowedByRole}
          expedienteAlive={expedienteAlive}
          initialTemplates={templates}
          initialTemplateId={initialTemplateId}
        />
      </div>
    </div>
  )
}
