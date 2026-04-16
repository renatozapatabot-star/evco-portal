// AguilaWordmark — inline SVG "CRUZ" wordmark (April 2026 rebrand)
// Filename preserved for import stability; renders the new CRUZ brand.
// Gold gradient for identity surfaces; silver tones kept for chrome contexts.

import type { CSSProperties } from 'react'

export type AguilaWordmarkTone = 'gold' | 'silver' | 'silver-bright'

export interface AguilaWordmarkProps {
  size?: number // height in px
  tone?: AguilaWordmarkTone
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

const WORDMARK_TEXT = 'CRUZ'

export function AguilaWordmark({
  size = 24,
  tone = 'gold',
  className,
  style,
  'aria-label': ariaLabel = 'CRUZ',
}: AguilaWordmarkProps) {
  const gradId = `zapata-wordmark-${tone}`
  const fill =
    tone === 'silver-bright' ? '#E8EAED' : `url(#${gradId})`
  // Aspect: "CRUZ" is 9 chars (incl. space) at fontSize 28, ls 6
  // → ~260 wide, 40 tall → ratio 6.5
  const viewW = 260
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
        fontFamily="'Inter', 'Helvetica Neue', Arial, sans-serif"
        fontSize="26"
        fontWeight="400"
        letterSpacing="5"
        fill={fill}
      >
        {WORDMARK_TEXT}
      </text>
    </svg>
  )
}

export const ZapataWordmark = AguilaWordmark

export default AguilaWordmark
