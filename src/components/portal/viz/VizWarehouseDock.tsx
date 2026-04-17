'use client'

export interface VizWarehouseDockProps {
  /** Which bay (0-4) has the truck docked. Default bay 3. */
  activeBay?: number
}

/**
 * Top-down warehouse scene — 5 bay doors, one active with a truck fully
 * docked, others have static containers every other bay. Completely
 * static (no motion) — keeps the dashboard quiet.
 *
 * Ported verbatim from screen-dashboard.jsx:356-436.
 */
export function VizWarehouseDock({ activeBay = 2 }: VizWarehouseDockProps) {
  const truckX = 66

  return (
    <svg
      width="100%"
      height="44"
      viewBox="0 0 100 44"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
      aria-hidden
    >
      {/* Ground / apron */}
      <rect x="0" y="28" width="100" height="16" fill="var(--portal-ink-3)" opacity="0.6" />
      {/* Lane markings */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <rect
          key={i}
          x={i * 10 + 2}
          y="35"
          width="5"
          height="0.6"
          fill="var(--portal-line-2)"
          opacity="0.5"
        />
      ))}
      {/* Warehouse building — upper band */}
      <rect
        x="0"
        y="2"
        width="100"
        height="26"
        fill="color-mix(in oklch, var(--portal-ink-3) 70%, var(--portal-green-2))"
        opacity="0.22"
      />
      <rect x="0" y="2" width="100" height="1" fill="var(--portal-green-3)" opacity="0.6" />

      {/* Bay doors */}
      {[0, 1, 2, 3, 4].map((i) => {
        const bx = 8 + i * 18
        const active = i === activeBay
        return (
          <g key={i}>
            <rect
              x={bx}
              y="6"
              width="14"
              height="22"
              rx="1"
              fill="var(--portal-ink-0)"
              stroke={active ? 'var(--portal-green-2)' : 'var(--portal-line-2)'}
              strokeWidth="0.6"
              opacity={active ? 1 : 0.8}
            />
            {[0, 1, 2, 3, 4].map((j) => (
              <line
                key={j}
                x1={bx + 1}
                y1={9 + j * 4}
                x2={bx + 13}
                y2={9 + j * 4}
                stroke={active ? 'var(--portal-green-3)' : 'var(--portal-line-2)'}
                strokeWidth="0.4"
                opacity={active ? 0.9 : 0.5}
              />
            ))}
            <text
              x={bx + 7}
              y="4.5"
              fontSize="2.6"
              fontFamily="monospace"
              fill={active ? 'var(--portal-green-2)' : 'var(--portal-fg-5)'}
              textAnchor="middle"
              letterSpacing="0.5"
            >
              {String(i + 1).padStart(2, '0')}
            </text>
            {active && <circle cx={bx + 7} cy="29.5" r="0.8" fill="var(--portal-green-2)" />}
            {!active && i % 2 === 0 && (
              <rect
                x={bx + 2}
                y="31"
                width="10"
                height="5"
                rx="0.5"
                fill="color-mix(in oklch, var(--portal-ink-3) 50%, var(--portal-green-2))"
                opacity="0.55"
              />
            )}
          </g>
        )
      })}

      {/* Active bay — truck approaching */}
      <g transform={`translate(${8 + activeBay * 18 - truckX + 14} 0)`}>
        <rect x="-16" y="31" width="14" height="6" rx="0.5" fill="var(--portal-green-2)" opacity="0.95" />
        <rect x="-16" y="31" width="14" height="1.2" fill="var(--portal-green-3)" />
        <rect x="-2" y="32" width="3.5" height="5" rx="0.5" fill="var(--portal-fg-3)" />
        <circle cx="1.6" cy="34.5" r="0.5" fill="var(--portal-amber)" opacity="0.9" />
      </g>
      <line x1="0" y1="2.5" x2="100" y2="2.5" stroke="var(--portal-green-2)" strokeWidth="0.2" opacity="0.4" />
    </svg>
  )
}
