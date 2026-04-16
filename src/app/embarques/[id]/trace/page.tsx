import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { composeTrace } from '@/lib/trace/compose'
import { TraceTimeline } from '@/components/trace/TraceTimeline'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { AguilaWordmark } from '@/components/brand/AguilaWordmark'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_DIM,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '@/lib/design-system'
import { PageOpenTracker } from './PageOpenTracker'

/**
 * /embarques/[id]/trace — End-to-End Trace View (V1.5 F8).
 *
 * Answers the SAT Audit standard: show the complete chain of custody for a
 * embarque from entrada to bank reconciliation, in one chronological view.
 *
 * Role gate: admin, broker, operator, contabilidad see everything. Client
 * sees only their own embarque (filtered by company_id in composeTrace).
 */
export default async function TraceViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const traficoId = decodeURIComponent(rawId)

  const cookieStore = await cookies()
  const session = await verifySession(
    cookieStore.get('portal_session')?.value ?? '',
  )
  if (!session) redirect('/login')

  const allowed = new Set(['admin', 'broker', 'operator', 'contabilidad', 'cliente'])
  if (!allowed.has(session.role)) redirect('/inicio')

  const supabase = createServerClient()
  const isInternal =
    session.role === 'admin' ||
    session.role === 'broker' ||
    session.role === 'operator' ||
    session.role === 'contabilidad'

  const { trafico, events } = await composeTrace(
    supabase,
    traficoId,
    isInternal ? null : session.companyId,
  )

  if (!trafico) notFound()

  let clientName: string = trafico.company_id ?? '—'
  if (trafico.company_id) {
    try {
      const { data } = await supabase
        .from('companies')
        .select('name')
        .eq('company_id', trafico.company_id)
        .maybeSingle()
      const c = data as { name: string | null } | null
      if (c?.name) clientName = c.name
    } catch {
      // Fall through to company_id fallback.
    }
  }

  return (
    <main className="aduana-dark" style={{ minHeight: '100vh', padding: '24px 20px 80px' }}>
      <PageOpenTracker traficoId={traficoId} />

      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Link
            href={`/embarques/${encodeURIComponent(traficoId)}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--aguila-fs-body)',
              color: TEXT_MUTED,
              textDecoration: 'none',
              minHeight: 60,
              lineHeight: '60px',
            }}
          >
            <ArrowLeft size={14} /> Volver al embarque
          </Link>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginTop: 4,
              flexWrap: 'wrap',
            }}
          >
            <AguilaMark size={36} tone="silver" aria-label="CRUZ" />
            <AguilaWordmark size={22} tone="silver" />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--aguila-fs-kpi-mid)',
                fontWeight: 800,
                color: TEXT_PRIMARY,
                letterSpacing: '-0.02em',
              }}
            >
              {trafico.trafico}
            </span>
            {trafico.estatus && (
              <span
                style={{
                  fontSize: 'var(--aguila-fs-meta)',
                  fontWeight: 700,
                  color: ACCENT_SILVER,
                  background: 'rgba(192,197,206,0.08)',
                  border: `1px solid rgba(192,197,206,0.22)`,
                  padding: '4px 10px',
                  borderRadius: 999,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {trafico.estatus}
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: 'var(--aguila-fs-meta)',
              fontWeight: 700,
              color: ACCENT_SILVER_DIM,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: 6,
            }}
          >
            {clientName} · Cronología completa · {events.length} evento
            {events.length === 1 ? '' : 's'}
          </div>
        </div>

        <TraceTimeline events={events} />
      </div>
    </main>
  )
}
