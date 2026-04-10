/**
 * ADUANA brand mark — infinity/flow symbol with blue glow.
 * Symbolizes seamless, endless border crossing and intelligent document flow.
 * Used in: TopBar, Sidebar, Login, AduanaAvatar.
 */

interface CruzMarkProps {
  /** Circle diameter in px */
  size: number
  className?: string
  /** Override container — when true, renders just the SVG */
  bare?: boolean
}

function InfinitySVG({ size }: { size: number }) {
  const svgSize = Math.round(size * 0.6)
  return (
    <svg
      viewBox="0 0 32 16"
      width={svgSize}
      height={Math.round(svgSize * 0.5)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="infinityGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f0ff" />
          <stop offset="50%" stopColor="#0088ff" />
          <stop offset="100%" stopColor="#0044cc" />
        </linearGradient>
        <filter id="infinityGlow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Infinity loop path */}
      <path
        d="M8 8C8 4.5 5.5 2 3 2C1.5 2 0 3.5 0 5.5C0 7.5 1.5 9 3 10C5 11.5 8 12.5 10 12.5C12 12.5 14 11.5 16 8C18 4.5 20 3.5 22 3.5C24 3.5 27 5 29 8C27 11 24 12.5 22 12.5C20 12.5 18 11.5 16 8C14 4.5 12 3.5 10 3.5C8 3.5 5 5 3 8"
        stroke="url(#infinityGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#infinityGlow)"
        opacity="0.9"
      />
      {/* Inner circuit detail dots */}
      <circle cx="8" cy="8" r="1" fill="#00f0ff" opacity="0.6" />
      <circle cx="24" cy="8" r="1" fill="#0088ff" opacity="0.6" />
      <circle cx="16" cy="8" r="0.8" fill="#00f0ff" opacity="0.4" />
    </svg>
  )
}

export function CruzMark({ size, className, bare }: CruzMarkProps) {
  if (bare) {
    return <InfinitySVG size={size} />
  }

  return (
    <div
      className={`cruz-brand-z ${className || ''}`}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,136,255,0.15) 0%, transparent 70%)',
      }}
    >
      <InfinitySVG size={size} />
    </div>
  )
}
