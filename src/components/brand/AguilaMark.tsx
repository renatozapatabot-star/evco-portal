// AguilaMark — inline SVG eagle mark for the AGUILA brand (April 2026, rev E2)
// Left-facing hawk silhouette: sharp beak, diagonal eye slit, three swept feather
// blades on the upper wing, two on the lower, and a detached lightning swoosh
// underneath. Silver chrome gradient by default with a specular highlight on the
// leading wing edge.
//
// Escape hatch: if /brand/aguila-eagle.svg exists at runtime, it renders via <img>.
// On load error, component falls back to the inline SVG below automatically.
//
// Tones:
//   silver        — chrome gradient (default, linearGradient fill)
//   silver-bright — flat ACCENT_SILVER_BRIGHT
//   gold          — legacy gold-slot value (same silver-bright during transition)
//   mono          — currentColor (inherits text color)

'use client'

import { useId, useState, type CSSProperties } from 'react'

export type AguilaMarkTone = 'silver' | 'silver-bright' | 'gold' | 'mono'

export interface AguilaMarkProps {
  size?: number
  tone?: AguilaMarkTone
  className?: string
  style?: CSSProperties
  'aria-label'?: string
  /** Skip the asset escape-hatch and always render inline SVG. */
  forceInline?: boolean
}

// viewBox 200×160 (1.25:1). Head is left third, wings sweep up-right with
// three sharp triangular feather blades, two lower blades sweep down-right.
const EAGLE_PATH =
  // Crown → back-of-head → sharp beak tip (left) → under-beak → neck
  'M70 28 L54 40 L34 50 L24 64 L28 70 L46 68 L58 58 ' +
  // Shoulder down to torso front
  'L72 62 L84 74 ' +
  // Upper wing — 3 sharp blades with overlapping triangular tips
  'L104 56 L116 72 L134 42 L148 70 L168 34 L182 68 ' +
  // Wing trailing edge returning
  'L178 80 L158 82 L150 96 L132 88 L124 104 L108 94 ' +
  // Lower wing — 2 blades sweeping down-right
  'L118 114 L94 104 L106 128 L80 114 ' +
  // Tail / torso base close
  'L76 96 Z'

// Eye: clean diagonal slit (not a circle)
const EYE_PATH = 'M48 48 L58 44 L56 50 L46 54 Z'

// Specular highlight on the leading wing edge
const HIGHLIGHT_PATH =
  'M84 74 L104 58 L114 70 L100 68 L86 78 Z'

// Lightning / swoosh underneath, detached, thinner + longer than body
const SWOOSH_PATH =
  'M26 128 L64 122 L90 136 L122 130 L152 144 L184 134 ' +
  'L182 140 L152 150 L120 140 L90 144 L64 132 L26 134 Z'

export function AguilaMark({
  size = 48,
  tone = 'silver',
  className,
  style,
  'aria-label': ariaLabel = 'AGUILA',
  forceInline = false,
}: AguilaMarkProps) {
  const reactId = useId()
  const gradId = `aguila-chrome-${reactId.replace(/:/g, '')}`
  const [assetFailed, setAssetFailed] = useState(false)

  let fill: string
  if (tone === 'silver') fill = `url(#${gradId})`
  else if (tone === 'silver-bright') fill = '#E8EAED'
  else if (tone === 'gold') fill = '#E8EAED'
  else fill = 'currentColor'

  const height = (size * 160) / 200

  // Asset escape hatch — tries /brand/aguila-eagle.svg, falls back on error.
  if (!forceInline && !assetFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/brand/aguila-eagle.svg"
        alt=""
        aria-label={ariaLabel}
        role="img"
        width={size}
        height={height}
        className={className}
        style={style}
        onError={() => setAssetFailed(true)}
      />
    )
  }

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
            <stop offset="0%" stopColor="#F2F4F7" />
            <stop offset="35%" stopColor="#C0C5CE" />
            <stop offset="70%" stopColor="#8A8E96" />
            <stop offset="100%" stopColor="#6A6E76" />
          </linearGradient>
          <linearGradient id={`${gradId}-hi`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
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
      {tone === 'silver' && (
        <path d={HIGHLIGHT_PATH} fill={`url(#${gradId}-hi)`} />
      )}
      <path d={SWOOSH_PATH} fill={fill} opacity={0.82} />
    </svg>
  )
}

export default AguilaMark
