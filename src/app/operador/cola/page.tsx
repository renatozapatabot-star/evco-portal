import { createClient } from '@supabase/supabase-js'
import { AlertTriangle } from 'lucide-react'
import { QueueClient } from './QueueClient'
import { requireOperator } from '@/lib/route-guards'

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
  await requireOperator()

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
            background: 'rgba(192,197,206,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--portal-fg-3)',
          }}
        >
          <AlertTriangle size={20} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--portal-fg-1)', margin: 0 }}>
          Cola de Excepciones
        </h1>
      </div>
      <p style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-5)', margin: '0 0 24px', paddingLeft: 52 }}>
        Eventos que requieren intervencion manual del operador
      </p>

      <QueueClient initialEvents={typedEvents} />
    </div>
  )
}
