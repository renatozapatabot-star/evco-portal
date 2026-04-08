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
      {/* Geometric crosshair — evokes crossing/compass */}
      <line x1="12" y1="3" x2="12" y2="21" stroke="#0B1623" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="12" x2="21" y2="12" stroke="#0B1623" strokeWidth="2" strokeLinecap="round" />
      {/* Diamond center */}
      <path d="M12 8.5L15.5 12L12 15.5L8.5 12Z" fill="#0B1623" />
      {/* Directional arrow tips — north and east */}
      <path d="M12 3L14 6H10Z" fill="#0B1623" />
      <path d="M21 12L18 10V14Z" fill="#0B1623" />
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
