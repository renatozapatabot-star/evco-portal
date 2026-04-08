/**
 * CRUZ brand mark — stylized compass/Z symbol.
 * Renders as an inline SVG inside the gold gradient circle.
 * Used in: TopBar, Sidebar, Login, CruzAvatar.
 */

interface CruzMarkProps {
  /** Circle diameter in px */
  size: number
  className?: string
  /** Override container — when true, renders just the SVG (for CruzAvatar which has its own circle) */
  bare?: boolean
}

function MarkSVG({ size }: { size: number }) {
  const svgSize = Math.round(size * 0.5)
  return (
    <svg
      viewBox="0 0 24 24"
      width={svgSize}
      height={svgSize}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Stylized Z/compass: diagonal cross with arrow direction */}
      <path
        d="M6 6L18 6L6 18L18 18"
        stroke="#0B1623"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Upper-right arrow tip — direction indicator */}
      <path
        d="M14 3L18 6L15 9"
        stroke="#0B1623"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CruzMark({ size, className, bare }: CruzMarkProps) {
  if (bare) {
    return <MarkSVG size={size} />
  }

  return (
    <div
      className={`cruz-brand-z ${className || ''}`}
      style={{ width: size, height: size }}
    >
      <MarkSVG size={size} />
    </div>
  )
}
