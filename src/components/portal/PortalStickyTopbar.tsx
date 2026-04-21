import type { ReactNode } from 'react'

export interface PortalStickyTopbarProps {
  /** Left cluster — typically breadcrumb + back button. */
  left?: ReactNode
  /** Right cluster — actions (aprobar, imprimir, descargar, …). */
  right?: ReactNode
  /** Optional center slot — usually the page title. */
  center?: ReactNode
  /** When true, renders a 2px emerald accent line on the bottom edge. */
  accent?: boolean
  className?: string
}

/**
 * Sticky top bar for detail pages — matches screen-detail-system.jsx
 * reference. Renders at top of viewport, uses `var(--portal-topbar-h)`
 * height, 1px bottom border hairline. Optional emerald accent line
 * signals live/active state.
 */
export function PortalStickyTopbar({
  left,
  right,
  center,
  accent = true,
  className,
}: PortalStickyTopbarProps) {
  return (
    <div
      className={className}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        height: 'var(--portal-topbar-h)',
        background: 'color-mix(in oklch, var(--portal-ink-0) 85%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--portal-line-1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--portal-s-6)',
        gap: 'var(--portal-s-4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--portal-s-3)', minWidth: 0 }}>
        {left}
      </div>
      {center && (
        <div style={{ flex: '0 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {center}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--portal-s-2)', flexShrink: 0 }}>
        {right}
      </div>
      {accent && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 0, right: 0, bottom: -1,
            height: 2,
            background: 'linear-gradient(90deg, transparent, var(--portal-green-2), transparent)',
            boxShadow: '0 0 8px var(--portal-green-glow)',
            opacity: 0.55,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
