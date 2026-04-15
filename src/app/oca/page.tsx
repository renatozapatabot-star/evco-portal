import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { PageShell, GlassCard, SectionHeader } from '@/components/aguila'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER, SILVER_GRADIENT } from '@/lib/design-system'
import type { OcaRow } from '@/lib/oca/types'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

type Row = Pick<OcaRow,
  | 'id' | 'opinion_number' | 'fraccion_recomendada' | 'product_description'
  | 'pais_origen' | 'status' | 'company_id' | 'created_at' | 'approved_at'
  | 'tmec_elegibilidad' | 'vigencia_hasta'
>

async function loadOpinions(session: { role: string; companyId: string }): Promise<Row[]> {
  let q = supabase
    .from('oca_database')
    .select('id, opinion_number, fraccion_recomendada, product_description, pais_origen, status, company_id, created_at, approved_at, tmec_elegibilidad, vigencia_hasta')
    .order('created_at', { ascending: false })
    .limit(50)

  if (session.role === 'client') {
    q = q.eq('status', 'approved').eq('company_id', session.companyId)
  }

  const { data } = await q
  return (data ?? []) as Row[]
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Chicago',
  })
}

function StatusPill({ status }: { status: Row['status'] }) {
  const cfg = status === 'approved'
    ? { label: 'Aprobada', bg: 'rgba(34,197,94,0.12)', fg: '#4ade80', border: 'rgba(34,197,94,0.25)' }
    : status === 'draft'
    ? { label: 'Borrador', bg: 'rgba(251,191,36,0.10)', fg: '#fbbf24', border: 'rgba(251,191,36,0.25)' }
    : { label: 'Reemplazada', bg: 'rgba(148,163,184,0.10)', fg: TEXT_SECONDARY, border: 'rgba(148,163,184,0.25)' }
  return (
    <span style={{
      fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: 999,
      background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  )
}

export default async function OcaListPage() {
  const token = (await cookies()).get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const opinions = await loadOpinions(session)
  const canGenerate = ['admin', 'broker', 'operator'].includes(session.role)
  const drafts = opinions.filter(o => o.status === 'draft').length
  const approved = opinions.filter(o => o.status === 'approved').length

  return (
    <PageShell
      title="Opiniones OCA"
      subtitle="Clasificación arancelaria · Patente 3596 · firmada por Renato Zapata III"
      systemStatus="healthy"
    >
      <div style={{ display: 'grid', gap: 20, maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 24, fontSize: 'var(--aguila-fs-compact)', color: TEXT_SECONDARY }}>
            <span>
              <span style={{ color: TEXT_MUTED, textTransform: 'uppercase', fontSize: 'var(--aguila-fs-label)', letterSpacing: 0.8, marginRight: 6 }}>Aprobadas</span>
              <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{approved}</span>
            </span>
            {session.role !== 'client' && (
              <span>
                <span style={{ color: TEXT_MUTED, textTransform: 'uppercase', fontSize: 'var(--aguila-fs-label)', letterSpacing: 0.8, marginRight: 6 }}>Borradores</span>
                <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{drafts}</span>
              </span>
            )}
          </div>
          {canGenerate && (
            <Link
              href="/oca/nuevo"
              style={{
                display: 'inline-flex', alignItems: 'center',
                minHeight: 44, padding: '0 20px',
                background: SILVER_GRADIENT, color: '#0A0A0C',
                borderRadius: 10, fontSize: 'var(--aguila-fs-body)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 0.5,
                textDecoration: 'none',
              }}
            >
              Nueva opinión
            </Link>
          )}
        </div>

        <SectionHeader title="Historial" count={opinions.length} />

        {opinions.length === 0 ? (
          <GlassCard>
            <div style={{ textAlign: 'center', padding: '32px 16px', color: TEXT_SECONDARY }}>
              <div style={{ fontSize: 'var(--aguila-fs-kpi-mid)', marginBottom: 12, color: ACCENT_SILVER }}>⚖</div>
              <p style={{ fontSize: 'var(--aguila-fs-section)', color: TEXT_PRIMARY, margin: '0 0 4px', fontWeight: 600 }}>Aún no hay opiniones</p>
              <p style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_MUTED, margin: '0 0 16px' }}>
                {canGenerate
                  ? 'Genera la primera opinión de clasificación arancelaria con Opus.'
                  : 'Las opiniones aprobadas aparecerán aquí cuando estén listas.'}
              </p>
              {canGenerate && (
                <Link
                  href="/oca/nuevo"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    minHeight: 44, padding: '0 20px',
                    background: 'rgba(255,255,255,0.06)', color: TEXT_PRIMARY,
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, fontSize: 'var(--aguila-fs-body)', fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Crear primera opinión
                </Link>
              )}
            </div>
          </GlassCard>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {opinions.map(o => (
              <GlassCard key={o.id} href={`/oca/${o.id}`}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) auto',
                  gap: 20,
                  alignItems: 'center',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                        fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, letterSpacing: 0.6,
                      }}>
                        {o.opinion_number}
                      </span>
                      <StatusPill status={o.status} />
                      {o.tmec_elegibilidad ? (
                        <span style={{
                          fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8,
                          textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: 999,
                          background: 'rgba(34,197,94,0.10)', color: '#4ade80',
                          border: '1px solid rgba(34,197,94,0.25)',
                        }}>T-MEC</span>
                      ) : null}
                    </div>
                    <p style={{
                      fontSize: 'var(--aguila-fs-body)', color: TEXT_PRIMARY, margin: 0, lineHeight: 1.4,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {o.product_description}
                    </p>
                  </div>
                  <div>
                    <div style={{
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: 0.5,
                    }}>
                      {o.fraccion_recomendada}
                    </div>
                    <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 2 }}>
                      {o.pais_origen} · {formatDate(o.approved_at ?? o.created_at)}
                    </div>
                  </div>
                  <span style={{ color: ACCENT_SILVER, fontSize: 'var(--aguila-fs-kpi-small)' }}>→</span>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}
