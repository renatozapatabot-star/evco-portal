// AguilaMark — inline SVG eagle mark for the AGUILA brand (April 2026, rev E1)
// Stylized hawk/eagle silhouette: head facing left with pointed beak and eye
// cutout, angular body, swept-back wings with sharp triangular feather tips,
// and a secondary swoosh stroke beneath. Silver chrome gradient by default.
//
// Tones:
//   silver        — chrome gradient (default, linearGradient fill)
//   silver-bright — flat ACCENT_SILVER_BRIGHT
//   gold          — legacy gold (for transitional surfaces during A2)
//   mono          — currentColor (inherits text color)

import { useId, type CSSProperties } from 'react'

export type AguilaMarkTone = 'silver' | 'silver-bright' | 'gold' | 'mono'

export interface AguilaMarkProps {
  size?: number
  tone?: AguilaMarkTone
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

// Aspect ratio is 200×160 (1.25:1 — wider than tall).
// Head occupies the left third, wings sweep from lower-left to upper-right
// with sharp triangular feather tips; lightning/swoosh runs under the body.
const EAGLE_PATH =
  // Head: crown → back of head → beak tip (left) → under-beak → neck
  'M72 30 L58 44 L38 54 L30 68 L44 70 L58 62 ' +
  // Shoulder down to torso
  'L70 66 L82 78 ' +
  // Upper wing: swept up-and-right with three triangular feather tips
  'L110 58 L118 76 L140 46 L150 74 L174 38 L182 72 ' +
  // Wing trailing edge coming back down
  'L176 84 L156 88 L150 100 L134 94 L128 108 L110 96 ' +
  // Lower wing: two feather tips sweeping down-right
  'L118 116 L96 108 L104 130 L82 118 ' +
  // Tail / body base back to torso
  'L78 100 Z'

// Eye cutout (evenodd)
const EYE_PATH = 'M54 52 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0 Z'

// Lightning / swoosh underneath the body
const SWOOSH_PATH =
  'M38 122 L72 118 L94 134 L124 128 L150 142 L178 134 ' +
  'L176 140 L150 150 L122 138 L94 144 L70 128 L38 132 Z'

export function AguilaMark({
  size = 48,
  tone = 'silver',
  className,
  style,
  'aria-label': ariaLabel = 'AGUILA',
}: AguilaMarkProps) {
  const reactId = useId()
  const gradId = `aguila-chrome-${reactId.replace(/:/g, '')}`

  let fill: string
  if (tone === 'silver') fill = `url(#${gradId})`
  else if (tone === 'silver-bright') fill = '#E8EAED'
  else if (tone === 'gold') fill = '#E8EAED'
  else fill = 'currentColor'

  const height = (size * 160) / 200

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 160"
      width={size}
      height={height}
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
      <path
        d={`${EAGLE_PATH} ${EYE_PATH}`}
        fill={fill}
        fillRule="evenodd"
        stroke={fill}
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
      <path d={SWOOSH_PATH} fill={fill} opacity={0.85} />
    </svg>
  )
}

export default AguilaMark
