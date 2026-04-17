// AguilaWordmark — inline SVG "PORTAL" wordmark (Block DD · 2026-04-17).
// Filename preserved for import stability; renders the new PORTAL brand
// in Instrument Serif per the DESIGN_HANDOFF spec.

import type { CSSProperties } from 'react'

export type AguilaWordmarkTone = 'gold' | 'silver' | 'silver-bright'

export interface AguilaWordmarkProps {
  size?: number // height in px
  tone?: AguilaWordmarkTone
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

const WORDMARK_TEXT = 'PORTAL'

export function AguilaWordmark({
  size = 24,
  tone = 'gold',
  className,
  style,
  'aria-label': ariaLabel = 'PORTAL',
}: AguilaWordmarkProps) {
  const gradId = `zapata-wordmark-${tone}`
  const fill =
    tone === 'silver-bright' ? '#E8EAED' : `url(#${gradId})`
  // "PORTAL" in Instrument Serif · letter-spacing 0.24em (hero spec) ·
  // viewBox sized for 6-char wordmark at fontSize 28.
  const viewW = 300
  const viewH = 40
  const width = Math.round(size * (viewW / viewH))

  const goldStops = (
    <>
      <stop offset="0%" stopColor="#F4D47A" />
      <stop offset="50%" stopColor="#C9A74A" />
      <stop offset="100%" stopColor="#8F7628" />
    </>
  )
  const silverStops = (
    <>
      <stop offset="0%" stopColor="#E8EAED" />
      <stop offset="50%" stopColor="#C0C5CE" />
      <stop offset="100%" stopColor="#7A7E86" />
    </>
  )

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${viewW} ${viewH}`}
      width={width}
      height={size}
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      {tone !== 'silver-bright' && (
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            {tone === 'gold' ? goldStops : silverStops}
          </linearGradient>
        </defs>
      )}
      <text
        x={viewW / 2}
        y="30"
        textAnchor="middle"
        fontFamily="var(--font-instrument-serif), 'Instrument Serif', 'Times New Roman', serif"
        fontSize="28"
        fontWeight="400"
        letterSpacing="6.7"
        fill={fill}
      >
        {WORDMARK_TEXT}
      </text>
    </svg>
  )
}

export const ZapataWordmark = AguilaWordmark

export default AguilaWordmark
