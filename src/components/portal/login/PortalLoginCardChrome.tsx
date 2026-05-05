'use client'

import type { CSSProperties, ReactNode } from 'react'

/**
 * Glass card chrome that wraps the entire login surface — the eyebrow,
 * wordmark, subtitle, divider, form, handshake, last-seen and live wire
 * all live inside a single panel with login-parity chemistry:
 *
 *   - background: color-mix(in oklch, var(--portal-ink-1) 62%, transparent)
 *   - backdrop-filter: blur(20px)
 *   - border: 1px solid var(--portal-line-2)
 *   - radius: var(--portal-r-5) (24px)
 *   - shadow: deep drop + 1px emerald halo
 *
 * Four hairline emerald L-ticks (top-left, top-right, bottom-right,
 * bottom-left) draw in sequence on first paint via `portalCornerTickIn`
 * (90ms stagger). They glow in emerald with a soft green halo —
 * direct port of `screen-login.jsx:431-452` from the Claude Design
 * bundle ("Swiss instrument coming online").
 *
 * The card breathes on idle (`portalCardBreathe` 6s), intensifies on
 * focus (`portalCardFocus`), and shakes laterally on error
 * (`portalShake`). Reduced-motion neutralizes all entrance + ambient
 * animations.
 */
export function PortalLoginCardChrome({
  children,
  focused,
  shake,
  style,
}: {
  children: ReactNode
  focused?: boolean
  shake?: boolean
  style?: CSSProperties
}) {
  const animation = shake
    ? 'portalShake 420ms cubic-bezier(.36,.07,.19,.97) both'
    : focused
      ? 'portalCardFocus 600ms var(--portal-ease-out) forwards'
      : 'portalCardBreathe 6s ease-in-out infinite'

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 460,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        padding: '40px 38px 32px',
        background: 'color-mix(in oklch, var(--portal-ink-1) 62%, transparent)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--portal-line-2)',
        borderRadius: 'var(--portal-r-5)',
        boxShadow:
          '0 30px 80px -30px rgba(0,0,0,0.7), 0 0 0 1px color-mix(in oklch, var(--portal-green-2) 6%, transparent)',
        animation,
        transformOrigin: 'center',
        ...style,
      }}
    >
      <Tick corner="tl" delay={0} />
      <Tick corner="tr" delay={90} />
      <Tick corner="br" delay={180} />
      <Tick corner="bl" delay={270} />
      {children}
    </div>
  )
}

function Tick({ corner, delay }: { corner: 'tl' | 'tr' | 'br' | 'bl'; delay: number }) {
  const SIZE = 14
  const base: CSSProperties = {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderColor: 'var(--portal-green-3)',
    borderStyle: 'solid',
    borderWidth: 0,
    pointerEvents: 'none',
    boxShadow: '0 0 8px var(--portal-green-glow)',
    animation: `portalCornerTickIn 500ms var(--portal-ease-out) ${delay}ms both`,
  }
  const placement: Record<typeof corner, CSSProperties> = {
    tl: { top: -1, left: -1, borderTopWidth: 1, borderLeftWidth: 1 },
    tr: { top: -1, right: -1, borderTopWidth: 1, borderRightWidth: 1 },
    br: { bottom: -1, right: -1, borderBottomWidth: 1, borderRightWidth: 1 },
    bl: { bottom: -1, left: -1, borderBottomWidth: 1, borderLeftWidth: 1 },
  }
  return <span aria-hidden style={{ ...base, ...placement[corner] }} />
}

/**
 * Three-step handshake row that appears mid-boot:
 *   VUCEM · OK · SAT · OK · CBP · OK
 *
 * Each token fades in 220ms apart starting at 700ms. After the
 * sequence completes the row settles to a quiet dim state and stays
 * — narrative reassurance, not a disappearing flash.
 *
 * Port of the boot-up sequence from chat1.md ("Three micro-handshake
 * lines appear briefly under the eyebrow: VUCEM · OK · SAT · OK ·
 * CBP · OK — then dim").
 */
export function PortalLoginHandshakeRow() {
  const items: Array<[string, number]> = [
    ['VUCEM · OK', 700],
    ['SAT · OK', 920],
    ['CBP · OK', 1140],
  ]
  return (
    <div
      role="status"
      aria-label="Sistemas en línea"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        marginBottom: 14,
        fontFamily: 'var(--portal-font-mono)',
        fontSize: 10, // WHY: handoff micro label scale (chat1.md)
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: 'var(--portal-fg-3)',
        animation: 'portalHandshakeSettle 700ms var(--portal-ease-out) 2000ms both',
      }}
    >
      {items.map(([label, delay], i) => (
        <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden
            style={{
              width: 4,
              height: 4,
              borderRadius: 999,
              background: 'var(--portal-green-2)',
              boxShadow: '0 0 6px var(--portal-green-glow)',
              opacity: 0,
              animation: `portalFadeUp 360ms var(--portal-ease-out) ${delay}ms both`,
            }}
          />
          <span
            style={{
              opacity: 0,
              animation: `portalFadeUp 360ms var(--portal-ease-out) ${delay}ms both`,
            }}
          >
            {label}
          </span>
          {i < items.length - 1 && (
            <span aria-hidden style={{ color: 'var(--portal-fg-5)', opacity: 0.5 }}>
              ·
            </span>
          )}
        </span>
      ))}
    </div>
  )
}
