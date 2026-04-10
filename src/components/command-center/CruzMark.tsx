/**
 * ADUANA IO brand mark — abstract "A" formed by 3 flowing ribbon loops.
 * Blue gradient symbolizing intelligent flow across borders.
 * Used in: TopBar, Sidebar, Login, AduanaAvatar.
 */

interface AduanaMarkProps {
  size: number
  className?: string
  bare?: boolean
}

function AduanaLogoSVG({ size }: { size: number }) {
  const svgSize = Math.round(size * 0.7)
  return (
    <svg
      viewBox="0 0 64 64"
      width={svgSize}
      height={svgSize}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="aduanaGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f0ff" />
          <stop offset="50%" stopColor="#0088ff" />
          <stop offset="100%" stopColor="#0044cc" />
        </linearGradient>
        <linearGradient id="aduanaGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0088ff" />
          <stop offset="100%" stopColor="#00d4ff" />
        </linearGradient>
        <filter id="aduanaGlow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Ribbon 1 — left flowing loop */}
      <path
        d="M20 52C12 52 6 44 10 36C14 28 24 24 32 18C28 24 22 30 20 36C18 42 22 48 28 48"
        stroke="url(#aduanaGrad1)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#aduanaGlow)"
        opacity="0.85"
      />
      {/* Ribbon 2 — right flowing loop */}
      <path
        d="M44 52C52 52 58 44 54 36C50 28 40 24 32 18C36 24 42 30 44 36C46 42 42 48 36 48"
        stroke="url(#aduanaGrad2)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#aduanaGlow)"
        opacity="0.85"
      />
      {/* Ribbon 3 — center peak (forms the A top) */}
      <path
        d="M32 8C28 16 22 24 18 32C24 26 28 20 32 14C36 20 40 26 46 32C42 24 36 16 32 8Z"
        fill="url(#aduanaGrad1)"
        opacity="0.15"
      />
      <path
        d="M32 8C28 16 22 26 20 34"
        stroke="url(#aduanaGrad1)"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#aduanaGlow)"
        opacity="0.9"
      />
      <path
        d="M32 8C36 16 42 26 44 34"
        stroke="url(#aduanaGrad2)"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#aduanaGlow)"
        opacity="0.9"
      />
      {/* Crossbar hint */}
      <path
        d="M24 38C28 36 36 36 40 38"
        stroke="url(#aduanaGrad1)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  )
}

export function AduanaMark({ size, className, bare }: AduanaMarkProps) {
  if (bare) {
    return <AduanaLogoSVG size={size} />
  }

  return (
    <div
      className={`aduana-brand ${className || ''}`}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,136,255,0.12) 0%, transparent 70%)',
      }}
    >
      <AduanaLogoSVG size={size} />
    </div>
  )
}

// Backward compatibility
export { AduanaMark as CruzMark }
