'use client'

export interface VizPulseItem {
  /** Row label (e.g. trafico number + route). */
  t: string
  /** Right-aligned metric value (e.g. "en ruta", "12m"). */
  v: string
  /** Live indicator — green dot + pulse. */
  live?: boolean
}

export interface VizPulseProps {
  items: VizPulseItem[]
}

/**
 * Vertical stack of live/dimmed rows with a bullet indicator. Used on
 * the Embarques module card to show 2-3 tráficos in transit.
 *
 * Ported verbatim from
 * .planning/design-handoff/cruz-portal/project/src/screen-dashboard.jsx:179-194.
 */
export function VizPulse({ items }: VizPulseProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: 'var(--portal-fg-2)',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 5,
              height: 5,
              borderRadius: 999,
              background: it.live ? 'var(--portal-green-2)' : 'var(--portal-fg-5)',
              boxShadow: it.live ? '0 0 6px var(--portal-green-glow)' : 'none',
              animation: it.live ? 'portalPulse 1.6s ease-in-out infinite' : undefined,
            }}
          />
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {it.t}
          </span>
          <span className="portal-num" style={{ color: 'var(--portal-fg-4)', fontSize: 10 }}>
            {it.v}
          </span>
        </div>
      ))}
    </div>
  )
}
