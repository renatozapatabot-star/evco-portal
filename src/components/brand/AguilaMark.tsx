// AguilaMark — inline SVG eagle mark for the AGUILA brand (April 2026)
// Geometric stylized eagle: head crest, spread wings, tail. Path data
// adapted from scripts/lib/email-templates.js AGUILA_SVG.
//
// Tones:
//   silver        — chrome gradient (default, linearGradient fill)
//   silver-bright — flat ACCENT_SILVER_BRIGHT
//   gold          — legacy gold (for transitional surfaces during A2)
//   mono          — currentColor (inherits text color)

import type { CSSProperties } from 'react'

export type AguilaMarkTone = 'silver' | 'silver-bright' | 'gold' | 'mono'

export interface AguilaMarkProps {
  size?: number
  tone?: AguilaMarkTone
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

const EAGLE_PATH =
  'M36 12 L33 18 L30 16 L32 22 L26 20 L30 26 L22 26 L28 30 L18 32 L28 34 L20 40 L30 38 L24 46 L32 42 L30 52 L36 46 L42 52 L40 42 L48 46 L42 38 L52 40 L44 34 L54 32 L44 30 L50 26 L42 26 L46 20 L40 22 L42 16 L39 18 Z'
const CREST_PATH = 'M34 16 L36 18 L38 16'
const BODY_PATH = 'M36 46 L36 58'
const TAIL_PATH = 'M32 58 L36 62 L40 58'

export function AguilaMark({
  size = 48,
  tone = 'silver',
  className,
  style,
  'aria-label': ariaLabel = 'AGUILA',
}: AguilaMarkProps) {
  const gradId = `aguila-chrome-${tone}`

  let fill: string
  let stroke: string
  if (tone === 'silver') {
    fill = `url(#${gradId})`
    stroke = `url(#${gradId})`
  } else if (tone === 'silver-bright') {
    fill = '#E8EAED'
    stroke = '#E8EAED'
  } else if (tone === 'gold') {
    fill = '#E8EAED'
    stroke = '#E8EAED'
  } else {
    fill = 'currentColor'
    stroke = 'currentColor'
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 72 72"
      width={size}
      height={size}
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      {tone === 'silver' && (
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E8EAED" />
            <stop offset="50%" stopColor="#C0C5CE" />
            <stop offset="100%" stopColor="#7A7E86" />
          </linearGradient>
        </defs>
      )}
      <path d={EAGLE_PATH} fill={fill} stroke={stroke} strokeWidth={0.5} strokeLinejoin="round" />
      <path d={CREST_PATH} fill="none" stroke={stroke} strokeWidth={1.2} strokeLinecap="round" />
      <path d={BODY_PATH} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinecap="round" />
      <path d={TAIL_PATH} fill="none" stroke={stroke} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default AguilaMark
