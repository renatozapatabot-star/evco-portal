/**
 * /admin/leads/[id] — single-lead detail + stage transition console.
 *
 * Admin/broker only. Server component reads the lead, hydrates a client
 * shell that handles PATCH round-trips via /api/leads/[id].
 */

import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { DetailPageShell } from '@/components/aguila'
import type { LeadActivityRow, LeadRow } from '@/lib/leads/types'
import { LeadDetailClient } from './LeadDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/')

  const supabase = createServerClient()
  const [{ data: lead }, { data: activities }] = await Promise.all([
    supabase.from('leads').select('*').eq('id', id).maybeSingle<LeadRow>(),
    supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', id)
      .order('occurred_at', { ascending: false })
      .limit(200),
  ])

  if (!lead) notFound()

  return (
    <DetailPageShell
      breadcrumb={[
        { label: 'Pipeline', href: '/admin/leads' },
        { label: lead.firm_name },
      ]}
      title={lead.firm_name}
      subtitle={lead.contact_name ?? 'Sin contacto asignado'}
      maxWidth={1000}
    >
      <LeadDetailClient
        initialLead={lead}
        initialActivities={(activities ?? []) as LeadActivityRow[]}
      />
    </DetailPageShell>
  )
}
