import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { ApprovalsClient } from './ApprovalsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AprobacionesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value
  if (!token) redirect('/login')

  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (session.role !== 'admin' && session.role !== 'broker') redirect('/')

  const sb = createServerClient()

  const { data: drafts } = await sb
    .from('pedimento_drafts')
    .select('id, trafico_id, draft_data, status, company_id, created_at')
    .in('status', ['ready_for_approval', 'draft', 'pending'])
    .order('created_at', { ascending: true })
    .limit(100)

  // Enrich with company names
  const companyIds = [...new Set((drafts || []).map(d => d.company_id).filter(Boolean))]
  let companyMap: Record<string, string> = {}

  if (companyIds.length > 0) {
    const { data: companies } = await sb
      .from('companies')
      .select('company_id, name')
      .in('company_id', companyIds)

    companyMap = Object.fromEntries((companies || []).map(c => [c.company_id, c.name]))
  }

  const enrichedDrafts = (drafts || []).map(d => ({
    ...d,
    company_name: companyMap[d.company_id] || d.company_id,
  }))

  return (
    <div className="aduana-dark" style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #05070B 0%, #0B1220 100%)',
      padding: '24px 16px',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            fontSize: 28, fontWeight: 900, color: '#E6EDF3',
            letterSpacing: '-0.03em', margin: 0,
          }}>
            Aprobaciones Pendientes
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>
            {enrichedDrafts.length} pedimento{enrichedDrafts.length !== 1 ? 's' : ''} esperando revisión
          </p>
        </div>

        <ApprovalsClient initialDrafts={enrichedDrafts} />
      </div>
    </div>
  )
}
