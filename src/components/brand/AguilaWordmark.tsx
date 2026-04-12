// AguilaWordmark — inline SVG "AGUILA" wordmark for the AGUILA brand (April 2026)
// Thin geometric sans with wide letter-spacing. Tones match AguilaMark.

import type { CSSProperties } from 'react'

export type AguilaWordmarkTone = 'silver' | 'silver-bright'

export interface AguilaWordmarkProps {
  size?: number // height in px
  tone?: AguilaWordmarkTone
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

export function AguilaWordmark({
  size = 24,
  tone = 'silver',
  className,
  style,
  'aria-label': ariaLabel = 'AGUILA',
}: AguilaWordmarkProps) {
  const gradId = `aguila-wordmark-${tone}`
  const fill = tone === 'silver-bright' ? '#E8EAED' : `url(#${gradId})`
  // Aspect: 6 chars * ~28px ≈ 168 wide, 40 tall → ratio 4.2
  const width = Math.round(size * 4.2)

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 168 40"
      width={width}
      height={size}
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      {tone === 'silver' && (
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E8EAED" />
            <stop offset="50%" stopColor="#C0C5CE" />
            <stop offset="100%" stopColor="#7A7E86" />
          </linearGradient>
        </defs>
      )}
      <text
        x="84"
        y="30"
        textAnchor="middle"
        fontFamily="'Inter', 'Helvetica Neue', Arial, sans-serif"
        fontSize="28"
        fontWeight="300"
        letterSpacing="6"
        fill={fill}
      >
        AGUILA
      </text>
    </svg>
  )
}

export default AguilaWordmark
