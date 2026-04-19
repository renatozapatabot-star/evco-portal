import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { PageShell, GlassCard, SectionHeader } from '@/components/aguila'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER } from '@/lib/design-system'
import { formatAge, loadTrackerData, type DockStatus, type TrackerItem } from '@/lib/bodega/tracker'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const STATUS_CFG: Record<DockStatus, { label: string; fg: string; bg: string; border: string }> = {
  receiving: { label: 'Recibiendo', fg: 'var(--portal-status-amber-fg)', bg: 'var(--portal-status-amber-bg)', border: 'var(--portal-status-amber-ring)' },
  staged:    { label: 'En patio',   fg: TEXT_SECONDARY,                  bg: 'var(--portal-status-gray-bg)',  border: 'var(--portal-status-gray-ring)'  },
  released:  { label: 'Liberado',   fg: 'var(--portal-status-green-fg)', bg: 'var(--portal-status-green-bg)', border: 'var(--portal-status-green-ring)' },
}

function fmtKg(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('es-MX', { maximumFractionDigits: 1 }) + ' kg'
}

function ItemCard({ item }: { item: TrackerItem }) {
  const e = item.entry
  const cfg = STATUS_CFG[e.status]
  const alert = item.hasDamage || item.hasFaltantes
  return (
    <GlassCard
      href={e.trafico_id ? `/embarques/${e.trafico_id}` : undefined}
      severity={alert ? 'critical' : undefined}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr) auto',
        gap: 20,
        alignItems: 'center',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 999,
              background: cfg.bg, color: cfg.fg, border: `1px solid ${cfg.border}`,
            }}>{cfg.label}</span>
            {e.dock_assigned && (
              <span style={{
                fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
                padding: '2px 8px', borderRadius: 999,
                background: 'rgba(192,197,206,0.08)', color: ACCENT_SILVER,
                border: '1px solid rgba(192,197,206,0.20)',
                fontFamily: 'var(--font-jetbrains-mono), monospace',
              }}>Dock {e.dock_assigned}</span>
            )}
            {alert && (
              <span style={{
                fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
                padding: '2px 8px', borderRadius: 999,
                background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.30)',
              }}>
                {item.hasDamage ? 'Daño' : 'Faltantes'}
              </span>
            )}
          </div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 15, color: TEXT_PRIMARY, fontWeight: 700, marginBottom: 2,
          }}>
            Caja {e.trailer_number}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>Recibido por <span style={{ color: TEXT_SECONDARY }}>{e.received_by}</span></span>
            <span>·</span>
            <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>{formatAge(e.received_at)} atrás</span>
          </div>
          {e.notes && (
            <p style={{
              fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, margin: '6px 0 0', lineHeight: 1.4,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>{e.notes}</p>
          )}
        </div>
        <div>
          <div style={{
            fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2,
          }}>Embarque</div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-body)', color: TEXT_PRIMARY, fontWeight: 600,
          }}>{e.trafico_id}</div>
          <div style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, marginTop: 4 }}>
            {item.entradas > 0 ? `${item.entradas} entrada${item.entradas === 1 ? '' : 's'}` : 'Sin entradas ligadas'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: TEXT_PRIMARY,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {item.bultosTotal ?? '—'}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Bultos · {fmtKg(item.pesoTotal)}
          </div>
          {e.photo_urls.length > 0 && (
            <div style={{
              fontSize: 'var(--aguila-fs-label)', color: ACCENT_SILVER, marginTop: 4,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
            }}>
              📷 {e.photo_urls.length}
            </div>
          )}
        </div>
        <span style={{ color: ACCENT_SILVER, fontSize: 'var(--aguila-fs-kpi-small)' }}>→</span>
      </div>
    </GlassCard>
  )
}

function Kpi({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <GlassCard size="compact">
      <div style={{
        fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8,
        textTransform: 'uppercase', color: TEXT_MUTED, marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, color: TEXT_PRIMARY,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, marginTop: 4 }}>{sub}</div>}
    </GlassCard>
  )
}

export default async function WarehouseTrackerPage() {
  const token = (await cookies()).get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const isInternal = ['admin', 'broker', 'operator'].includes(session.role)
  const tracker = await loadTrackerData(supabase, {
    companyId: isInternal ? null : session.companyId,
    limit: 100,
  })

  const receiving = tracker.items.filter(i => i.entry.status === 'receiving')
  const staged = tracker.items.filter(i => i.entry.status === 'staged')
  const released = tracker.items.filter(i => i.entry.status === 'released')

  return (
    <PageShell
      title="Warehouse · Dock Tracker"
      subtitle="Estado en vivo del patio · últimas 100 recepciones"
      systemStatus={tracker.totals.damaged > 0 ? 'warning' : 'healthy'}
    >
      <div style={{ display: 'grid', gap: 20, maxWidth: 1200 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <Kpi label="Recibiendo" value={tracker.totals.receiving} sub="trailers en dock" />
          <Kpi label="En patio" value={tracker.totals.staged} sub="staged · pendiente liberar" />
          <Kpi label="Liberados" value={tracker.totals.released} sub="despachados" />
          <Kpi label="Recibidos hoy" value={tracker.totals.today} sub="desde 00:00 CDT" />
          {tracker.totals.damaged > 0 && (
            <Kpi label="Con alerta" value={tracker.totals.damaged} sub="daño o faltantes" />
          )}
        </div>

        {tracker.items.length === 0 ? (
          <GlassCard>
            <div style={{ textAlign: 'center', padding: '32px 16px', color: TEXT_SECONDARY }}>
              <div style={{ fontSize: 'var(--aguila-fs-kpi-mid)', marginBottom: 12, color: ACCENT_SILVER }}>▤</div>
              <p style={{ fontSize: 'var(--aguila-fs-section)', color: TEXT_PRIMARY, margin: '0 0 4px', fontWeight: 600 }}>
                Patio vacío
              </p>
              <p style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_MUTED, margin: '0 0 16px' }}>
                Ninguna recepción registrada en warehouse_entries.
              </p>
              {isInternal && (
                <Link
                  href="/bodega/recibir"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    minHeight: 44, padding: '0 20px',
                    background: 'rgba(255,255,255,0.06)', color: TEXT_PRIMARY,
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, fontSize: 'var(--aguila-fs-body)', fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Ir a recepción
                </Link>
              )}
            </div>
          </GlassCard>
        ) : (
          <>
            {receiving.length > 0 && (
              <>
                <SectionHeader title="En recepción" count={receiving.length} />
                <div style={{ display: 'grid', gap: 12 }}>
                  {receiving.map(it => <ItemCard key={it.entry.id} item={it} />)}
                </div>
              </>
            )}

            {staged.length > 0 && (
              <>
                <SectionHeader title="En patio" count={staged.length} />
                <div style={{ display: 'grid', gap: 12 }}>
                  {staged.map(it => <ItemCard key={it.entry.id} item={it} />)}
                </div>
              </>
            )}

            {released.length > 0 && (
              <>
                <SectionHeader
                  title="Liberados recientes"
                  count={released.length}
                  action={isInternal ? { label: 'Ver historial completo', href: '/bodega' } : undefined}
                />
                <div style={{ display: 'grid', gap: 12 }}>
                  {released.slice(0, 10).map(it => <ItemCard key={it.entry.id} item={it} />)}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </PageShell>
  )
}
