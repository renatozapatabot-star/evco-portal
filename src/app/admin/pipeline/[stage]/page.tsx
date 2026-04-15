import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { fmtDateTime } from '@/lib/format-utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STAGE_LABELS: Record<string, string> = {
  intake: 'Recepción',
  classify: 'Clasificación',
  docs: 'Documentos',
  pedimento: 'Pedimento',
  crossing: 'Cruce',
  post_op: 'Post-Op',
  invoice: 'Facturación',
  monitor: 'Monitoreo',
}

const VALID_STAGES = new Set(Object.keys(STAGE_LABELS))

type StatusPillKind = 'success' | 'pending' | 'failed' | 'neutral'

function statusKind(status: string | null | undefined): StatusPillKind {
  if (!status) return 'neutral'
  const s = status.toLowerCase()
  if (s === 'completed' || s === 'success' || s === 'done') return 'success'
  if (s === 'failed' || s === 'dead_letter' || s === 'error') return 'failed'
  if (s === 'pending' || s === 'processing' || s === 'retry' || s === 'queued') return 'pending'
  return 'neutral'
}

function pillStyle(kind: StatusPillKind): React.CSSProperties {
  const map: Record<StatusPillKind, { bg: string; fg: string; border: string }> = {
    success: { bg: 'rgba(34,197,94,0.12)', fg: '#22C55E', border: 'rgba(34,197,94,0.3)' },
    pending: { bg: 'rgba(192,197,206,0.12)', fg: '#E8EAED', border: 'rgba(192,197,206,0.3)' },
    failed:  { bg: 'rgba(239,68,68,0.12)', fg: '#EF4444', border: 'rgba(239,68,68,0.3)' },
    neutral: { bg: 'rgba(255,255,255,0.04)', fg: '#8B949E', border: 'rgba(255,255,255,0.08)' },
  }
  const c = map[kind]
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 'var(--aguila-fs-label)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    background: c.bg,
    color: c.fg,
    border: `1px solid ${c.border}`,
  }
}

function summarizePayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const obj = payload as Record<string, unknown>
  const keys = ['trafico', 'trafico_id', 'pedimento', 'doc_type', 'action', 'reason', 'message']
  const parts: string[] = []
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.length > 0) parts.push(`${k}: ${v}`)
    if (typeof v === 'number') parts.push(`${k}: ${v}`)
    if (parts.length >= 3) break
  }
  return parts.join(' · ')
}

interface PageProps {
  params: Promise<{ stage: string }>
}

export default async function PipelineStagePage({ params }: PageProps) {
  const { stage } = await params
  if (!VALID_STAGES.has(stage)) notFound()

  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value
  if (!token) redirect('/login')

  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (session.role !== 'admin' && session.role !== 'broker') redirect('/')

  const sb = createServerClient()

  const { data: events, error } = await sb
    .from('workflow_events')
    .select('id, workflow, event_type, status, trigger_type, trigger_id, payload, created_at')
    .eq('workflow', stage)
    .order('created_at', { ascending: false })
    .limit(50)

  const rows = !error && events ? events : []

  const title = STAGE_LABELS[stage]

  return (
    <div
      className="aguila-dark"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #05070B 0%, #0B1220 100%)',
        padding: '24px 16px',
        color: '#E6EDF3',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Link
          href="/admin/inicio"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#8B949E',
            textDecoration: 'none',
            marginBottom: 12,
            minHeight: 44,
          }}
        >
          ← Volver a Inicio
        </Link>

        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontSize: 'var(--aguila-fs-label)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#C0C5CE',
              marginBottom: 4,
            }}
          >
            Pipeline Autónomo
          </div>
          <h1
            style={{
              fontSize: 'var(--aguila-fs-kpi-mid)',
              fontWeight: 800,
              color: '#E6EDF3',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Pipeline · {title}
          </h1>
          <p style={{ fontSize: 'var(--aguila-fs-body)', color: '#8B949E', margin: '4px 0 0' }}>
            Últimos {rows.length} evento{rows.length === 1 ? '' : 's'} — ordenados por fecha descendente.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.045)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(192,197,206,0.2)',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8B949E', fontSize: 'var(--aguila-fs-section)' }}>
              Sin eventos recientes en este paso.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--aguila-fs-body)' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Trigger ID</th>
                  <th style={thStyle}>Estatus</th>
                  <th style={thStyle}>Resumen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const kind = statusKind(r.status as string | null)
                  return (
                    <tr
                      key={r.id as string}
                      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      <td
                        style={{
                          ...tdStyle,
                          fontFamily: 'var(--font-jetbrains-mono), monospace',
                          color: '#E6EDF3',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {fmtDateTime(r.created_at as string)}
                      </td>
                      <td style={{ ...tdStyle, color: '#E6EDF3' }}>
                        {(r.event_type as string) || '—'}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontFamily: 'var(--font-jetbrains-mono), monospace',
                          color: '#8B949E',
                        }}
                      >
                        {(r.trigger_id as string) || '—'}
                      </td>
                      <td style={tdStyle}>
                        <span style={pillStyle(kind)}>{(r.status as string) || 'n/a'}</span>
                      </td>
                      <td style={{ ...tdStyle, color: '#8B949E', fontSize: 12 }}>
                        {summarizePayload(r.payload) || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 'var(--aguila-fs-label)',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#8B949E',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'middle',
}
