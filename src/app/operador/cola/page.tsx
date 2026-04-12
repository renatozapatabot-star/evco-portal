import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { QueueClient } from './QueueClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface WorkflowEvent {
  id: string
  workflow: string
  event_type: string
  trigger_id: string | null
  company_id: string
  payload: Record<string, unknown> | null
  status: 'pending' | 'failed' | 'dead_letter'
  created_at: string
  error_message: string | null
  attempt_count: number | null
}

export default async function ColaPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value

  // Gate: operator, admin, or broker only
  if (!role || !['admin', 'broker', 'operator'].includes(role)) {
    redirect('/')
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: events } = await sb
    .from('workflow_events')
    .select('id, workflow, event_type, trigger_id, company_id, payload, status, created_at, error_message, attempt_count')
    .in('status', ['pending', 'failed', 'dead_letter'])
    .order('created_at', { ascending: true })
    .limit(100)

  const typedEvents: WorkflowEvent[] = (events || []) as WorkflowEvent[]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'rgba(0,229,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#00E5FF',
          }}
        >
          <AlertTriangle size={20} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#E6EDF3', margin: 0 }}>
          Cola de Excepciones
        </h1>
      </div>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px', paddingLeft: 52 }}>
        Eventos que requieren intervencion manual del operador
      </p>

      <QueueClient initialEvents={typedEvents} />
    </div>
  )
}
