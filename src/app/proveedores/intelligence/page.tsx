import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { PageShell, GlassCard, SectionHeader } from '@/components/aguila'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER } from '@/lib/design-system'
import { loadProveedorIntelligence, type AlertKind, type SupplierAlert } from '@/lib/proveedor/intelligence'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const ALERT_CONFIG: Record<AlertKind, { label: string; fg: string; bg: string; border: string }> = {
  NEW: {
    label: 'Nuevo',
    fg: 'var(--portal-status-green-fg)',
    bg: 'var(--portal-status-green-bg)',
    border: 'var(--portal-status-green-ring)',
  },
  VALUE_SPIKE: {
    label: 'Pico de valor',
    fg: 'var(--portal-status-amber-fg)',
    bg: 'var(--portal-status-amber-bg)',
    border: 'var(--portal-status-amber-ring)',
  },
  DORMANT_RETURN: {
    label: 'Regreso',
    fg: '#c4b5fd',
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.25)',
  },
  COUNTRY_CHANGE: {
    label: 'Cambio de país',
    fg: 'var(--portal-status-red-fg)',
    bg: 'var(--portal-status-red-bg)',
    border: 'var(--portal-status-red-ring)',
  },
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Chicago',
  })
}

const fmtUSD = (n: number | null) =>
  n == null
    ? '—'
    : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function AlertCard({ alert }: { alert: SupplierAlert }) {
  const cfg = ALERT_CONFIG[alert.kind]
  return (
    <GlassCard>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) auto',
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
            {alert.country && (
              <span style={{
                fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.8,
                fontFamily: 'var(--font-jetbrains-mono), monospace',
              }}>{alert.country}</span>
            )}
            <span style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
              {formatDate(alert.latest_date)}
            </span>
          </div>
          <div style={{
            fontSize: 'var(--aguila-fs-section)', color: TEXT_PRIMARY, fontWeight: 600, marginBottom: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {alert.supplier}
          </div>
          <p style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_SECONDARY, margin: 0, lineHeight: 1.4 }}>
            {alert.detail}
          </p>
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: TEXT_PRIMARY,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {fmtUSD(alert.latest_value_usd)}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, marginTop: 2, letterSpacing: 0.4 }}>
            USD · importe embarque
          </div>
          {alert.pedimento && (
            <div style={{
              fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, marginTop: 4,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
            }}>
              Ped. {alert.pedimento}
            </div>
          )}
        </div>
        <span style={{ color: ACCENT_SILVER, fontSize: 'var(--aguila-fs-kpi-small)' }}>→</span>
      </div>
    </GlassCard>
  )
}

export default async function ProveedorIntelligencePage() {
  const token = (await cookies()).get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')

  const isInternal = ['admin', 'broker', 'operator'].includes(session.role)
  const intel = await loadProveedorIntelligence(supabase, {
    companyId: isInternal ? null : session.companyId,
    lookbackDays: 90,
  })

  const alertsByKind = {
    NEW: intel.alerts.filter(a => a.kind === 'NEW').length,
    VALUE_SPIKE: intel.alerts.filter(a => a.kind === 'VALUE_SPIKE').length,
    DORMANT_RETURN: intel.alerts.filter(a => a.kind === 'DORMANT_RETURN').length,
    COUNTRY_CHANGE: intel.alerts.filter(a => a.kind === 'COUNTRY_CHANGE').length,
  }

  return (
    <PageShell
      title="Proveedor Intelligence"
      subtitle={`Señales de comportamiento · ventana ${intel.lookbackDays} días · vs histórico 12 meses`}
      systemStatus={alertsByKind.COUNTRY_CHANGE > 0 ? 'warning' : 'healthy'}
    >
      <div style={{ display: 'grid', gap: 20, maxWidth: 1100 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {(
            [
              { k: 'Embarques en ventana', v: intel.totalTraficos },
              { k: 'Proveedores distintos', v: intel.distinctSuppliers },
              { k: 'Alertas totales', v: intel.alerts.length },
            ] as const
          ).map(x => (
            <GlassCard key={x.k} size="compact">
              <div style={{
                fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8,
                textTransform: 'uppercase', color: TEXT_MUTED, marginBottom: 6,
              }}>{x.k}</div>
              <div style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, color: TEXT_PRIMARY,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {x.v}
              </div>
            </GlassCard>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <SectionHeader title="Alertas" count={intel.alerts.length} />
          <div style={{ display: 'flex', gap: 16, fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY }}>
            {(Object.keys(alertsByKind) as AlertKind[]).map(k => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 999,
                  background: ALERT_CONFIG[k].fg,
                }} />
                <span style={{ color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 'var(--aguila-fs-label)' }}>
                  {ALERT_CONFIG[k].label}
                </span>
                <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>
                  {alertsByKind[k]}
                </span>
              </span>
            ))}
          </div>
        </div>

        {intel.alerts.length === 0 ? (
          <GlassCard>
            <div style={{ textAlign: 'center', padding: '32px 16px', color: TEXT_SECONDARY }}>
              <div style={{ fontSize: 'var(--aguila-fs-kpi-mid)', marginBottom: 12, color: ACCENT_SILVER }}>◎</div>
              <p style={{ fontSize: 'var(--aguila-fs-section)', color: TEXT_PRIMARY, margin: '0 0 4px', fontWeight: 600 }}>
                Ningún proveedor fuera de lo normal
              </p>
              <p style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_MUTED, margin: 0 }}>
                Historial limpio en los últimos {intel.lookbackDays} días.
              </p>
            </div>
          </GlassCard>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {intel.alerts.slice(0, 50).map((a, i) => (
              <AlertCard key={`${a.supplier}-${a.kind}-${i}`} alert={a} />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
          <SectionHeader title="Top proveedores por valor" count={intel.topSuppliers.length} />
          <Link
            href="/proveedores"
            style={{
              fontSize: 'var(--aguila-fs-meta)', color: ACCENT_SILVER, textDecoration: 'none',
              textTransform: 'uppercase', letterSpacing: 0.8,
            }}
          >
            Ver todos →
          </Link>
        </div>

        {intel.topSuppliers.length === 0 ? (
          <GlassCard>
            <p style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_MUTED, margin: 0 }}>
              Sin proveedores en la ventana histórica.
            </p>
          </GlassCard>
        ) : (
          <GlassCard>
            <div style={{ display: 'grid', gap: 0 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,2fr) 1fr 1fr 1fr auto',
                gap: 16,
                padding: '8px 0',
                fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8,
                textTransform: 'uppercase', color: TEXT_MUTED,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <span>Proveedor</span>
                <span style={{ textAlign: 'right' }}>Operaciones</span>
                <span style={{ textAlign: 'right' }}>Promedio</span>
                <span style={{ textAlign: 'right' }}>Total</span>
                <span>Últ.</span>
              </div>
              {intel.topSuppliers.map(s => (
                <div key={s.supplier} style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,2fr) 1fr 1fr 1fr auto',
                  gap: 16,
                  padding: '10px 0',
                  fontSize: 'var(--aguila-fs-compact)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  alignItems: 'center',
                }}>
                  <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: TEXT_PRIMARY }}>{s.supplier}</span>
                    {s.countries[0] && (
                      <span style={{
                        marginLeft: 8, fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED,
                        fontFamily: 'var(--font-jetbrains-mono), monospace',
                      }}>{s.countries[0]}</span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_SECONDARY, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {s.operations}
                  </span>
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_SECONDARY, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtUSD(s.avg_value_usd)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_PRIMARY, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {fmtUSD(s.total_value_usd)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-meta)' }}>
                    {formatDate(s.last_seen)}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </PageShell>
  )
}
