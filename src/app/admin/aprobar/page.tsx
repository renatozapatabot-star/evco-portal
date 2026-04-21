import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { ApprovalQueue, type EscalationRow } from './ApprovalQueue'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getYesterdayISO(): string {
  return new Date(Date.now() - 86400000).toISOString()
}

interface DraftRow {
  id: string
  trafico_id: string | null
  draft_data: Record<string, unknown> | null
  status: string
  created_at: string
  updated_at: string
  company_id: string | null
}

export default async function AprobarPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value
  if (!token) redirect('/login')
  const session = await verifySession(token)
  if (!session || (session.role !== 'admin' && session.role !== 'broker')) redirect('/')

  // Fetch all pending drafts across ALL clients (Tito sees everything)
  const { data: pendingDrafts } = await supabase
    .from('pedimento_drafts')
    .select('*')
    .in('status', ['draft', 'pending', 'approved_pending'])
    .order('created_at', { ascending: true })
    .limit(50)

  // Fetch recently approved/rejected (last 24h) for the activity feed
  const yesterday = getYesterdayISO()
  const { data: recentDrafts } = await supabase
    .from('pedimento_drafts')
    .select('*')
    .in('status', ['approved', 'approved_corrected', 'rejected'])
    .gte('updated_at', yesterday)
    .order('updated_at', { ascending: false })
    .limit(20)

  // Fetch escalated workflow events (operator escalated to broker)
  const { data: escalations } = await supabase
    .from('workflow_events')
    .select('*')
    .eq('status', 'dead_letter')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="page-shell" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <ApprovalQueue
        initialPending={(pendingDrafts || []) as DraftRow[]}
        initialRecent={(recentDrafts || []) as DraftRow[]}
        initialEscalations={(escalations || []) as EscalationRow[]}
      />
    </div>
  )
}
