export interface VizBarsProps {
  data: number[]
  max?: number
}

/**
 * Ascending bar chart — last bar gets the accent + glow. All others at
 * 45% emerald. Height is 44px fixed. Used as a fallback viz on any card
 * that wants a simple trend without a per-point sparkline.
 *
 * Ported from screen-dashboard.jsx:121-135.
 */
export function VizBars({ data, max }: VizBarsProps) {
  const cap = max ?? Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44 }} aria-hidden>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / cap) * 100}%`,
            minHeight: 2,
            background:
              i === data.length - 1
                ? 'var(--portal-green-2)'
                : 'color-mix(in oklch, var(--portal-green-2) 45%, transparent)',
            borderRadius: 1,
            boxShadow: i === data.length - 1 ? '0 0 6px var(--portal-green-glow)' : 'none',
            transition: 'all 300ms',
          }}
        />
      ))}
    </div>
  )
}
