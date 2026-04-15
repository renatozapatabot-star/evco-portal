import { ACCENT_CYAN, RED, TEXT_MUTED, TEXT_PRIMARY } from '@/lib/design-system'
import type { ShadowByDay } from '@/lib/shadow-analysis'

/**
 * Inline SVG stacked-bar chart. No client lib dependency — this renders
 * server-side as part of the admin shadow page. If recharts adoption grows
 * site-wide, swap this component for a recharts equivalent — the props are
 * stable.
 */
export function AgreementChart({ rows }: { rows: ShadowByDay[] }) {
  const width = 720
  const height = 200
  const padding = { top: 10, right: 10, bottom: 24, left: 32 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const maxTotal = Math.max(1, ...rows.map((r) => r.agreed + r.disagreed))
  const barGap = 2
  const barW = Math.max(2, innerW / rows.length - barGap)

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        style={{ display: 'block' }}
        role="img"
        aria-label="Concordancia diaria entre operadores y sistema"
      >
        {/* axis */}
        <line
          x1={padding.left} y1={padding.top + innerH}
          x2={padding.left + innerW} y2={padding.top + innerH}
          stroke="rgba(255,255,255,0.12)" strokeWidth={1}
        />
        {/* bars */}
        {rows.map((r, i) => {
          const total = r.agreed + r.disagreed
          const h = (total / maxTotal) * innerH
          const hAgreed = total > 0 ? (r.agreed / total) * h : 0
          const hDisagreed = total > 0 ? (r.disagreed / total) * h : 0
          const x = padding.left + i * (barW + barGap)
          const yDisagreed = padding.top + innerH - h
          const yAgreed = yDisagreed + hDisagreed
          return (
            <g key={r.date}>
              {hDisagreed > 0 && (
                <rect
                  x={x}
                  y={yDisagreed}
                  width={barW}
                  height={hDisagreed}
                  fill={RED}
                  opacity={0.75}
                />
              )}
              {hAgreed > 0 && (
                <rect
                  x={x}
                  y={yAgreed}
                  width={barW}
                  height={hAgreed}
                  fill={ACCENT_CYAN}
                  opacity={0.85}
                />
              )}
            </g>
          )
        })}
        {/* axis labels (first / mid / last) */}
        {[0, Math.floor(rows.length / 2), rows.length - 1].filter((i) => i >= 0 && i < rows.length).map((i) => {
          const r = rows[i]
          const x = padding.left + i * (barW + barGap) + barW / 2
          return (
            <text
              key={r.date}
              x={x}
              y={height - 6}
              fontSize={10}
              fill={TEXT_MUTED}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
            >
              {r.date.slice(5)}
            </text>
          )
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 'var(--aguila-fs-meta)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: TEXT_PRIMARY }}>
          <span style={{ width: 10, height: 10, background: ACCENT_CYAN, borderRadius: 2 }} /> Concuerdan
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: TEXT_PRIMARY }}>
          <span style={{ width: 10, height: 10, background: RED, borderRadius: 2 }} /> Discrepan
        </span>
      </div>
    </div>
  )
}
