/**
 * /admin/leads — sales pipeline view for broker/admin.
 *
 * Reads from the `leads` table (RLS deny-all; service role bypass).
 * Groups by stage, renders counts + detail table, plus a "next actions
 * due" strip at the top so the sales team sees what to hit today first.
 *
 * Server component · revalidates every 30s.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import {
  PageShell,
  GlassCard,
  AguilaDataTable,
  AguilaMetric,
} from '@/components/aguila'
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  LEAD_SOURCE_LABELS,
  type LeadRow,
  type LeadStage,
} from '@/lib/leads/types'

export const dynamic = 'force-dynamic'
export const revalidate = 30

type LeadsPageRow = Record<string, unknown> & {
  id: string
  firm_name: string
  contact_name: string | null
  stage: string
  source: string
  value_monthly_mxn: number | null
  next_action_at: string | null
  next_action_note: string | null
  last_contact_at: string | null
  created_at: string
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Chicago',
    })
  } catch {
    return '—'
  }
}

function fmtMXN(n: number | null): string {
  if (n == null) return '—'
  return `$${n.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
}

export default async function AdminLeadsPage() {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/')

  const supabase = createServerClient()

  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  const rows: LeadsPageRow[] = ((leads ?? []) as LeadRow[]).map((r) => ({
    ...r,
  }))

  // Group counts by stage
  const counts: Record<LeadStage, number> = Object.fromEntries(
    LEAD_STAGES.map((s) => [s, 0]),
  ) as Record<LeadStage, number>
  for (const r of rows) {
    const stage = r.stage as LeadStage
    if (stage in counts) counts[stage] += 1
  }
  const total = rows.length

  // Next-action-due: items with next_action_at <= now
  const now = new Date()
  const due = rows
    .filter((r) => {
      if (!r.next_action_at) return false
      return new Date(r.next_action_at).getTime() <= now.getTime()
    })
    .sort((a, b) => {
      const aDate = a.next_action_at ? new Date(a.next_action_at).getTime() : 0
      const bDate = b.next_action_at ? new Date(b.next_action_at).getTime() : 0
      return aDate - bDate
    })

  const wonValue = rows
    .filter((r) => r.stage === 'won')
    .reduce((s, r) => s + (r.value_monthly_mxn ?? 0), 0)

  return (
    <PageShell
      title="Pipeline de leads"
      subtitle={`${total} prospectos · ${counts.won} ganados · ${counts['demo-viewed']} demo vistos · ${due.length} acciones pendientes`}
      maxWidth={1400}
    >
      {error ? (
        <GlassCard tier="hero" style={{ marginBottom: 16, borderColor: 'var(--portal-status-red-ring)' }}>
          <div style={{ color: 'var(--portal-status-red-fg)', fontSize: 'var(--portal-fs-sm)' }}>
            Error al cargar leads: {error.message}. ¿La migración se aplicó?
          </div>
        </GlassCard>
      ) : null}

      {/* Hero metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <AguilaMetric label="Total" value={String(total)} sub="pipeline completo" />
        <AguilaMetric
          label="Acciones pendientes"
          value={String(due.length)}
          tone={due.length > 0 ? 'attention' : 'neutral'}
          sub="next_action_at vencido"
        />
        <AguilaMetric
          label="Demo vistos"
          value={String(counts['demo-viewed'])}
          tone="positive"
          sub="en las últimas 30 días"
        />
        <AguilaMetric
          label="Ganados"
          value={String(counts.won)}
          tone="positive"
          sub={wonValue > 0 ? `${fmtMXN(wonValue)} MXN/mes` : undefined}
        />
      </div>

      {/* Acciones pendientes */}
      {due.length > 0 && (
        <GlassCard tier="hero" padding={20} style={{ marginBottom: 24 }}>
          <h2
            className="portal-eyebrow"
            style={{
              fontSize: 'var(--portal-fs-label)',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--portal-status-amber-fg)',
              margin: '0 0 12px',
            }}
          >
            Acciones pendientes hoy · {due.length}
          </h2>
          <AguilaDataTable
            ariaLabel="Acciones de lead pendientes"
            columns={[
              { key: 'firm_name', label: 'Firma', type: 'text' },
              {
                key: 'next_action_at',
                label: 'Vencido',
                render: (r) => (
                  <span style={{ color: 'var(--portal-status-amber-fg)' }}>
                    {fmtDate(r.next_action_at as string | null)}
                  </span>
                ),
              },
              {
                key: 'next_action_note',
                label: 'Próxima acción',
                render: (r) => (
                  <span style={{ color: 'var(--portal-fg-2)' }}>
                    {(r.next_action_note as string | null) ?? '—'}
                  </span>
                ),
              },
              {
                key: 'stage',
                label: 'Etapa',
                render: (r) => (
                  <span style={{ color: 'var(--portal-fg-3)' }}>
                    {LEAD_STAGE_LABELS[(r.stage as LeadStage) ?? 'new'] ?? r.stage}
                  </span>
                ),
              },
            ]}
            rows={due as Record<string, unknown>[]}
            keyFor={(r) => r.id as string}
            rowHref={(r) => `/admin/leads/${r.id}`}
          />
        </GlassCard>
      )}

      {/* Full pipeline */}
      <GlassCard tier="hero" padding={20}>
        <h2
          className="portal-eyebrow"
          style={{
            fontSize: 'var(--portal-fs-label)',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--portal-fg-4)',
            margin: '0 0 12px',
          }}
        >
          Todos los leads · {total}
        </h2>

        {rows.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--portal-fg-4)',
              fontSize: 'var(--portal-fs-sm)',
            }}
          >
            Aún no hay leads registrados. Los prospectos que lleguen vía{' '}
            <code>/demo</code> o cold email se capturarán aquí.
          </div>
        ) : (
          <AguilaDataTable
            ariaLabel="Pipeline de prospectos"
            columns={[
              { key: 'firm_name', label: 'Firma', type: 'text' },
              {
                key: 'contact_name',
                label: 'Contacto',
                render: (r) => (
                  <span style={{ color: 'var(--portal-fg-3)' }}>
                    {(r.contact_name as string | null) ?? '—'}
                  </span>
                ),
              },
              {
                key: 'stage',
                label: 'Etapa',
                render: (r) => {
                  const stage = (r.stage as LeadStage) ?? 'new'
                  const color =
                    stage === 'won'
                      ? 'var(--portal-status-green-fg)'
                      : stage === 'lost'
                      ? 'var(--portal-status-red-fg)'
                      : stage === 'demo-viewed' || stage === 'demo-booked'
                      ? 'var(--portal-status-amber-fg)'
                      : 'var(--portal-fg-2)'
                  return (
                    <span style={{ color, fontWeight: 600 }}>
                      {LEAD_STAGE_LABELS[stage] ?? stage}
                    </span>
                  )
                },
              },
              {
                key: 'source',
                label: 'Fuente',
                render: (r) => {
                  const source = r.source as keyof typeof LEAD_SOURCE_LABELS
                  return <span>{LEAD_SOURCE_LABELS[source] ?? (r.source as string)}</span>
                },
              },
              {
                key: 'value_monthly_mxn',
                label: 'Valor mensual',
                render: (r) => (
                  <span className="portal-num" style={{ color: 'var(--portal-fg-2)' }}>
                    {fmtMXN(r.value_monthly_mxn as number | null)}
                  </span>
                ),
              },
              {
                key: 'last_contact_at',
                label: 'Último contacto',
                render: (r) => (
                  <span style={{ color: 'var(--portal-fg-4)' }}>
                    {fmtDate(r.last_contact_at as string | null)}
                  </span>
                ),
              },
              {
                key: 'created_at',
                label: 'Capturado',
                render: (r) => (
                  <span style={{ color: 'var(--portal-fg-5)' }}>
                    {fmtDate(r.created_at as string)}
                  </span>
                ),
              },
            ]}
            rows={rows as Record<string, unknown>[]}
            keyFor={(r) => r.id as string}
            rowHref={(r) => `/admin/leads/${r.id}`}
          />
        )}
      </GlassCard>

      {/* Stage breakdown chips */}
      <div
        style={{
          marginTop: 20,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {LEAD_STAGES.map((s) => (
          <div
            key={s}
            className="portal-badge"
            style={{ gap: 6 }}
          >
            {LEAD_STAGE_LABELS[s]}
            <span
              className="portal-num"
              style={{
                color: counts[s] > 0 ? 'var(--portal-fg-1)' : 'var(--portal-fg-5)',
                fontWeight: 700,
              }}
            >
              {counts[s]}
            </span>
          </div>
        ))}
      </div>
    </PageShell>
  )
}
