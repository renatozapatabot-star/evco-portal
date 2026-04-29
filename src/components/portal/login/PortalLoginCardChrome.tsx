'use client'

import type { CSSProperties, ReactNode } from 'react'

/**
 * Corner-tick chrome that wraps the login form card. Four hairline
 * L-shaped ticks (top-left, top-right, bottom-right, bottom-left)
 * draw in sequence on first paint via portalCornerTickIn keyframes
 * (200ms stagger). Reads as "the panel is booting up" — Swiss
 * instrument coming online.
 *
 * Port of the boot-up sequence from
 * .planning/design-handoff/cruz-portal/chats/chat1.md ("the card runs
 * a 1.2s sequence: hairline corner ticks draw in"). Reduced-motion
 * neutralizes the entrance — the ticks render in their final state.
 */
export function PortalLoginCardChrome({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        position: 'relative',
        ...style,
      }}
    >
      <Tick corner="tl" delay={0} />
      <Tick corner="tr" delay={200} />
      <Tick corner="br" delay={400} />
      <Tick corner="bl" delay={600} />
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
    borderColor: 'var(--portal-line-3)',
    borderStyle: 'solid',
    borderWidth: 0,
    pointerEvents: 'none',
    animation: `portalCornerTickIn 360ms var(--portal-ease-out) ${delay}ms both`,
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
        fontSize: 10,
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
