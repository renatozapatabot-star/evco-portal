'use client'

import Link from 'next/link'

export interface KPIItem {
  label: string
  value: string | number
  href: string
  color?: string
  /** Dim when value is 0 and there are active items elsewhere */
  dim?: boolean
}

interface CockpitKPIStripProps {
  items: KPIItem[]
}

/**
 * Horizontal strip of KPI metrics in cockpit dark style.
 * Replaces the old glass .kpi-grid with solid elevated surfaces.
 * Single row on desktop, 2x2 grid on mobile.
 */
export function CockpitKPIStrip({ items }: CockpitKPIStripProps) {
  return (
    <div className="cockpit-kpi-strip" style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(items.length, 5)}, 1fr)`,
      gap: 10,
    }}>
      {items.map(kpi => (
        <Link
          key={kpi.label}
          href={kpi.href}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <div style={{
            background: 'var(--bg-elevated, #222222)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderTop: `3px solid ${kpi.color || 'var(--gold, #eab308)'}`,
            borderRadius: 10,
            padding: '12px 14px',
            textAlign: 'center',
            opacity: kpi.dim ? 0.5 : 1,
            transition: 'opacity 200ms ease, box-shadow 150ms ease',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 22,
              fontWeight: 800,
              color: kpi.dim ? 'var(--text-muted, #6E7681)' : 'var(--text-primary, #E6EDF3)',
              lineHeight: 1.1,
            }}>
              {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
            </div>
            <div style={{
              fontSize: 11,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted, #6E7681)',
              marginTop: 4,
            }}>
              {kpi.label}
            </div>
          </div>
        </Link>
      ))}

      <style>{`
        @media (max-width: 640px) {
          .cockpit-kpi-strip {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  )
}
