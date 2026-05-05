'use client'

/**
 * PORTAL · login signature horizon
 *
 * Barely-visible 1px line at 62% of the viewport height with three
 * geographic ticks (RIO BRAVO · PUENTE II · RIO BRAVO). Anchors the
 * surface in space without being a map. The detail people screenshot.
 *
 * Direct port of `screen-login.jsx:382-408` from the Claude Design
 * bundle. Sits at zIndex 3 (below the card at zIndex 5, above the
 * background grid at zIndex 1). Pointer-events: none — never
 * intercepts a click on the card.
 *
 * Reduced-motion users still see the horizon — the only motion is a
 * single fade-in on first paint, which respects `prefers-reduced-motion`
 * via the global `[data-motion="off"]` cascade.
 */
export function PortalLoginSignatureHorizon() {
  const ticks = [
    { x: '33%', label: 'RIO BRAVO' },
    { x: '50%', label: 'PUENTE II' },
    { x: '67%', label: 'RIO BRAVO' },
  ]
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '62%',
        zIndex: 3,
        pointerEvents: 'none',
        opacity: 0.55,
        animation: 'portalFadeUp 1200ms var(--portal-ease-out) 700ms both',
      }}
    >
      <div
        style={{
          height: 1,
          width: '100%',
          background:
            'linear-gradient(90deg, transparent 0%, var(--portal-line-2) 18%, var(--portal-line-2) 82%, transparent 100%)',
        }}
      />
      {ticks.map((t, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: t.x,
            top: -3,
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ width: 1, height: 6, background: 'var(--portal-line-2)' }} />
          <span
            style={{
              fontFamily: 'var(--portal-font-mono)',
              fontSize: 8, // WHY: handoff micro tick scale (screen-login.jsx:403)
              letterSpacing: '0.32em',
              color: 'var(--portal-fg-5)',
            }}
          >
            {t.label}
          </span>
        </div>
      ))}
    </div>
  )
}
