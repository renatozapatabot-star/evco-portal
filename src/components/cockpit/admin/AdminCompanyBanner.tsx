// AdminCompanyBanner — company-scoped KPI strip above the Eagle grid.
//
// Static brand identity (patente, aduana, aduana code) anchors the view;
// live KPIs (active tráficos, active clients, dormant, AR pending) summarise
// operational state in JetBrains Mono at a glance. Part of the 11-PM-Executive
// 3-second-certainty contract.

import { TEXT_MUTED, ACCENT_SILVER_BRIGHT } from '@/lib/design-system'

const MONO = 'var(--font-jetbrains-mono), ui-monospace, monospace'

export interface AdminCompanyBannerProps {
  activeTraficosTotal: number
  activeClients: number
  dormantClients: number
  arPendingMxn: number | null
}

function fmtMxn(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M MXN`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K MXN`
  return `$${Math.round(n).toLocaleString('es-MX')} MXN`
}

export function AdminCompanyBanner({
  activeTraficosTotal,
  activeClients,
  dormantClients,
  arPendingMxn,
}: AdminCompanyBannerProps) {
  return (
    <section
      aria-label="Resumen de compañía"
      style={{
        background: 'rgba(9,9,11,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow:
          '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 1px rgba(0,229,255,0.12)',
        borderRadius: 16,
        padding: '16px 20px',
        marginBottom: 16,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: 24,
        alignItems: 'center',
      }}
    >
      {/* Brand block — static, always present */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: TEXT_MUTED,
          }}
        >
          Renato Zapata & Co.
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 15,
            fontWeight: 700,
            color: ACCENT_SILVER_BRIGHT,
            letterSpacing: '-0.01em',
          }}
        >
          Patente 3596 · Aduana 240
        </div>
        <div
          style={{
            fontSize: 11,
            color: TEXT_MUTED,
            letterSpacing: '0.04em',
          }}
        >
          Laredo TX · Est. 1941
        </div>
      </div>

      {/* KPI block — scrolls horizontally on narrow viewports */}
      <div
        style={{
          display: 'flex',
          gap: 32,
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <Kpi label="Tráficos activos" value={activeTraficosTotal.toLocaleString('es-MX')} />
        <Kpi label="Clientes activos" value={activeClients.toLocaleString('es-MX')} />
        <Kpi
          label="Dormidos"
          value={dormantClients.toLocaleString('es-MX')}
          tone={dormantClients > 0 ? 'warn' : 'default'}
        />
        <Kpi label="CxC vencido" value={fmtMxn(arPendingMxn)} />
      </div>
    </section>
  )
}

function Kpi({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'warn'
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 96 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: TEXT_MUTED,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 20,
          fontWeight: 800,
          color: tone === 'warn' ? '#FBBF24' : ACCENT_SILVER_BRIGHT,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  )
}
