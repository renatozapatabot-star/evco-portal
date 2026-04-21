'use client'

/**
 * AguilaLivePill — the "this portal is alive" breathing signal.
 *
 * Canonical treatment: a pulsing green dot inside a glass chip with
 * a short Spanish label. Renders the same on login, cockpit, list
 * pages, detail pages — anywhere the user might pause and want to
 * know the portal is connected + awake.
 *
 * Three callsites today:
 *   · login/page.tsx — "SISTEMA EN LÍNEA · PATENTE 3596"
 *   · PageShell's LiveTimestamp — "DATOS EN VIVO" (inline with clock)
 *   · TopBar right cluster — "EN LÍNEA" (short, always visible)
 *
 * Motion contract: .aguila-dot-pulse (2s ease-in-out infinite, globals.css).
 * Honors prefers-reduced-motion automatically via the utility class's
 * existing @media gate. Never a hard-stop animation; the dot continues
 * to read as a status pill when motion is off.
 */

export interface AguilaLivePillProps {
  label?: string
  /** Compact variant — single "live" dot, no text. Used where horizontal
   *  space is scarce (mobile topbar, dense toolbars). */
  compact?: boolean
  /** Override the default green. Useful for degraded-but-alive states
   *  where a warning amber is the correct signal. */
  tone?: 'alive' | 'warning' | 'error'
}

const TONES = {
  alive: {
    dot: '#22C55E',
    glow: 'rgba(34,197,94,0.5)',
    chipBg: 'rgba(34,197,94,0.08)',
    chipBorder: 'rgba(34,197,94,0.22)',
    text: 'rgba(134,239,172,0.88)',
  },
  warning: {
    dot: '#FBBF24',
    glow: 'rgba(251,191,36,0.5)',
    chipBg: 'rgba(251,191,36,0.08)',
    chipBorder: 'rgba(251,191,36,0.28)',
    text: 'rgba(252,211,77,0.9)',
  },
  error: {
    dot: '#EF4444',
    glow: 'rgba(239,68,68,0.55)',
    chipBg: 'rgba(239,68,68,0.1)',
    chipBorder: 'rgba(239,68,68,0.32)',
    text: 'rgba(252,165,165,0.92)',
  },
} as const

export function AguilaLivePill({
  label = 'En línea',
  compact = false,
  tone = 'alive',
}: AguilaLivePillProps) {
  const palette = TONES[tone]

  if (compact) {
    return (
      <span
        role="status"
        aria-label={label}
        title={label}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24, height: 24,
          borderRadius: 999,
          background: palette.chipBg,
          border: `1px solid ${palette.chipBorder}`,
          flexShrink: 0,
        }}
      >
        <span
          aria-hidden
          className="aguila-dot-pulse"
          style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: palette.dot,
            boxShadow: `0 0 8px ${palette.glow}`,
          }}
        />
      </span>
    )
  }

  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 11px',
        borderRadius: 999,
        background: palette.chipBg,
        border: `1px solid ${palette.chipBorder}`,
        color: palette.text,
        fontSize: 10,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontWeight: 600,
        fontFamily: 'var(--font-jetbrains-mono, monospace)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      <span
        aria-hidden
        className="aguila-dot-pulse"
        style={{
          width: 6, height: 6,
          borderRadius: '50%',
          background: palette.dot,
          boxShadow: `0 0 10px ${palette.glow}`,
        }}
      />
      {label}
    </span>
  )
}
