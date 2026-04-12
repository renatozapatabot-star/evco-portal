/**
 * AGUILA · V1.5 F3 — /contabilidad
 *
 * Anabel's accounting cockpit. One screen: AR aging, AP aging, monthly
 * close checklist, MVE compliance, facturas ready, last QuickBooks export.
 * Role-gated to contabilidad + admin + broker.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { computeARAging, computeAPAging, type AgingResult } from '@/lib/contabilidad/aging'
import {
  ensureMonthlyChecklist,
  monthAnchor,
  type ChecklistItem,
} from '@/lib/contabilidad/close'
import { ContabilidadCockpitClient } from './ContabilidadCockpitClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface OverviewMveSummary {
  total: number
  critical: number
  warning: number
}

export interface OverviewFacturasReady {
  count: number
  recent: Array<{
    id: number | string
    invoice_number: string | null
    total: number | null
    currency: string | null
    created_at: string
    status: string
  }>
}

export interface OverviewQbExport {
  id: string
  status: string
  row_count: number | null
  entity: string
  format: string
  created_at: string
  completed_at: string | null
  file_bytes: number | null
}

export interface OverviewData {
  month: string
  ar: AgingResult
  ap: AgingResult
  close: ChecklistItem[]
  mve: OverviewMveSummary
  facturasReady: OverviewFacturasReady
  lastQbExport: OverviewQbExport | null
}

export default async function ContabilidadOverviewPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  if (!session) redirect('/login')
  if (!['contabilidad', 'admin', 'broker'].includes(session.role)) redirect('/inicio')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const month = monthAnchor()

  const [ar, ap, close, mveRows, facturasReady, lastQb] = await Promise.all([
    computeARAging(supabase, session.companyId),
    computeAPAging(supabase, session.companyId),
    ensureMonthlyChecklist(supabase, session.companyId, month),
    supabase
      .from('mve_alerts')
      .select('id, severity')
      .eq('company_id', session.companyId)
      .eq('resolved', false)
      .limit(500),
    supabase
      .from('invoices')
      .select('id, invoice_number, total, currency, created_at, status')
      .eq('company_id', session.companyId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('quickbooks_export_jobs')
      .select('id, status, row_count, entity, format, created_at, completed_at, file_bytes')
      .eq('company_id', session.companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const mveOpen = mveRows.data ?? []
  const critical = mveOpen.filter((a) => (a as { severity: string }).severity === 'critical').length
  const warning = mveOpen.filter((a) => (a as { severity: string }).severity === 'warning').length

  // Server-side telemetry — fired on page mount. Lives in payload.event
  // to keep the locked client TelemetryEvent union at 15.
  await supabase.from('interaction_events').insert({
    event_type: 'contabilidad_overview_viewed',
    event_name: 'contabilidad_overview_viewed',
    page_path: '/contabilidad',
    user_id: `${session.companyId}:${session.role}`,
    company_id: session.companyId,
    payload: { event: 'contabilidad_overview_viewed' },
  })

  const data: OverviewData = {
    month,
    ar,
    ap,
    close,
    mve: { total: mveOpen.length, critical, warning },
    facturasReady: {
      count: facturasReady.data?.length ?? 0,
      recent: (facturasReady.data ?? []) as OverviewFacturasReady['recent'],
    },
    lastQbExport: (lastQb.data as OverviewQbExport | null) ?? null,
  }

  return <ContabilidadCockpitClient data={data} />
}
