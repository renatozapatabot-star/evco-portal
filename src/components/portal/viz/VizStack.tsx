export interface VizStackLayer {
  /** Short label on the left (e.g. "ABR", "MAR"). */
  k: string
  /** Fill percent of the row (0-100). */
  pct: number
  /** Value shown on the right. */
  v: string | number
  /** When true, row uses amber instead of emerald. */
  warn?: boolean
}

export interface VizStackProps {
  layers: VizStackLayer[]
}

/**
 * Horizontal stacked bands — each layer shows a short label, a fill bar
 * (percent-driven), and a numeric value. Used for comparisons that
 * don't have a natural time axis.
 *
 * Ported from screen-dashboard.jsx:157-177.
 */
export function VizStack({ layers }: VizStackProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      {layers.map((l, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="portal-meta"
            style={{ width: 52, color: 'var(--portal-fg-5)', fontSize: 9 }}
          >
            {l.k}
          </span>
          <div
            style={{
              flex: 1,
              height: 6,
              borderRadius: 2,
              background: 'var(--portal-ink-3)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${l.pct}%`,
                height: '100%',
                background: l.warn ? 'var(--portal-amber)' : 'var(--portal-green-2)',
                boxShadow: l.warn ? 'none' : '0 0 6px var(--portal-green-glow)',
                transition: 'width 500ms',
              }}
            />
          </div>
          <span
            className="portal-num"
            style={{
              fontSize: 10,
              color: 'var(--portal-fg-2)',
              minWidth: 30,
              textAlign: 'right',
            }}
          >
            {l.v}
          </span>
        </div>
      ))}
    </div>
  )
}
