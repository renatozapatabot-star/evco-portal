import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { PageShell, GlassCard, SectionHeader } from '@/components/aguila'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER } from '@/lib/design-system'
import {
  loadAnomalies,
  type Anomaly,
  type AnomalyKind,
  type Severity,
} from '@/lib/anomaly/detector'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const KIND_LABEL: Record<AnomalyKind, string> = {
  VALUE_OUTLIER: 'Valor atípico',
  TMEC_MISS: 'T-MEC faltante',
  IVA_CASCADE: 'IVA cascada',
}

const SEV_CFG: Record<Severity, { label: string; fg: string; bg: string; border: string; systemStatus: 'healthy' | 'warning' | 'critical' }> = {
  alta: { label: 'Alta', fg: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.30)', systemStatus: 'critical' },
  media: { label: 'Media', fg: '#FBBF24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)', systemStatus: 'warning' },
  baja: { label: 'Baja', fg: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.25)', systemStatus: 'healthy' },
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Chicago',
  })
}

function SeverityKpi({ label, value, sev, sub }: { label: string; value: number; sev: Severity; sub?: string }) {
  const cfg = SEV_CFG[sev]
  return (
    <GlassCard size="compact" severity={cfg.systemStatus === 'critical' ? 'critical' : cfg.systemStatus === 'warning' ? 'warning' : undefined}>
      <div style={{
        fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8,
        textTransform: 'uppercase', color: TEXT_MUTED, marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, color: cfg.fg,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, marginTop: 4 }}>{sub}</div>}
    </GlassCard>
  )
}

function AnomalyCard({ a }: { a: Anomaly }) {
  const sev = SEV_CFG[a.severity]
  const sevMap: Record<Severity, 'critical' | 'warning' | undefined> = {
    alta: 'critical', media: 'warning', baja: undefined,
  }
  const upHigh = a.deviation_pct > 0
  return (
    <GlassCard severity={sevMap[a.severity]}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)',
        gap: 20,
        alignItems: 'center',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 999,
              background: sev.bg, color: sev.fg, border: `1px solid ${sev.border}`,
            }}>{sev.label}</span>
            <span style={{
              fontSize: 'var(--aguila-fs-label)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 999,
              background: 'rgba(192,197,206,0.08)', color: ACCENT_SILVER,
              border: '1px solid rgba(192,197,206,0.20)',
            }}>{KIND_LABEL[a.kind]}</span>
            <span style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
              {formatDate(a.fecha)}
            </span>
            {a.clave_cliente && (
              <span style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
                Clave {a.clave_cliente}
              </span>
            )}
          </div>
          <div style={{
            fontSize: 'var(--aguila-fs-section)', color: TEXT_PRIMARY, fontWeight: 600, marginBottom: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {a.proveedor ?? '—'}
          </div>
          <p style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_SECONDARY, margin: 0, lineHeight: 1.5 }}>
            {a.detail}
          </p>
          <div style={{
            display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap',
            fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED,
          }}>
            {a.referencia && (
              <span>
                <span style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 4 }}>Ref.</span>
                <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_SECONDARY }}>{a.referencia}</span>
              </span>
            )}
            {a.pedimento && (
              <span>
                <span style={{ textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 4 }}>Ped.</span>
                <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: TEXT_SECONDARY }}>{a.pedimento}</span>
              </span>
            )}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>
            Esperado
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_SECONDARY, fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
            {a.expected}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>
            Encontrado
          </div>
          <div style={{
            fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: TEXT_PRIMARY,
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {a.found}
          </div>
          <div style={{
            fontSize: 'var(--aguila-fs-meta)', marginTop: 4,
            color: upHigh ? '#ef4444' : '#4ade80',
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {upHigh ? '▲' : '▼'} {Math.abs(a.deviation_pct).toFixed(1)}%
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

export default async function AnomaliasPage() {
  const token = (await cookies()).get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/alertas')

  const report = await loadAnomalies(supabase, { lookbackDays: 30, baselineDays: 365 })

  const systemStatus = report.totals.alta > 0 ? 'critical' : report.totals.media > 0 ? 'warning' : 'healthy'

  return (
    <PageShell
      title="Anomaly Detector"
      subtitle={`Señales sobre ${report.totals.facturasScanned} facturas · ventana ${report.lookbackDays} días · baseline ${report.baselineDays} días`}
      systemStatus={systemStatus}
    >
      <div style={{ display: 'grid', gap: 20, maxWidth: 1200 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <SeverityKpi label="Alta" value={report.totals.alta} sev="alta" sub="escalar a Tito" />
          <SeverityKpi label="Media" value={report.totals.media} sev="media" sub="revisar 24h" />
          <SeverityKpi label="Baja" value={report.totals.baja} sev="baja" sub="reporte semanal" />
          <SeverityKpi label="Facturas escaneadas" value={report.totals.facturasScanned} sev="baja" sub={`ventana ${report.lookbackDays} días`} />
        </div>

        <SectionHeader title="Hallazgos" count={report.anomalies.length} />

        {report.anomalies.length === 0 ? (
          <GlassCard>
            <div style={{ textAlign: 'center', padding: '32px 16px', color: TEXT_SECONDARY }}>
              <div style={{ fontSize: 'var(--aguila-fs-kpi-mid)', marginBottom: 12, color: ACCENT_SILVER }}>◎</div>
              <p style={{ fontSize: 'var(--aguila-fs-section)', color: TEXT_PRIMARY, margin: '0 0 4px', fontWeight: 600 }}>
                Sin anomalías en la ventana
              </p>
              <p style={{ fontSize: 'var(--aguila-fs-compact)', color: TEXT_MUTED, margin: 0 }}>
                Valor, clasificación T-MEC y base de IVA dentro de rangos esperados.
              </p>
            </div>
          </GlassCard>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {report.anomalies.slice(0, 80).map((a, i) => (
              <AnomalyCard key={`${a.referencia ?? a.pedimento ?? i}-${a.kind}`} a={a} />
            ))}
          </div>
        )}

        <GlassCard>
          <p style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, margin: 0, lineHeight: 1.6 }}>
            Detectores activos · <span style={{ color: TEXT_SECONDARY }}>Valor atípico</span> (≥2σ sobre media del proveedor) ·
            <span style={{ color: TEXT_SECONDARY }}> T-MEC faltante</span> (IGI pagado en proveedor que cruza USMCA ≥75% del tiempo) ·
            <span style={{ color: TEXT_SECONDARY }}> IVA cascada</span> (desviación ≥5% vs. valor_aduana + DTA + IGI × tasa de system_config).
            Tasa IVA viene de <span style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>system_config</span> — nunca 0.16 plano.
          </p>
        </GlassCard>
      </div>
    </PageShell>
  )
}
