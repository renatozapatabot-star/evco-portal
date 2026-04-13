import { BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW, COCKPIT_CANVAS, TEXT_PRIMARY } from '@/lib/design-system'

/**
 * Cockpit loading skeleton — shown while the SSR Promise.all hydrates.
 * Uses the same glass chrome as the real cockpit so the transition is seamless.
 */
export function CockpitSkeleton() {
  const cards = new Array(4).fill(null)
  const nav = new Array(6).fill(null)
  return (
    <div className="aguila-dark" style={{ position: 'relative', minHeight: '100vh', background: COCKPIT_CANVAS, color: TEXT_PRIMARY, fontFamily: 'var(--font-sans)', overflow: 'hidden' }}>
      <div className="p-4 md:px-7 md:py-6" style={{ position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ height: 28, width: 160, background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 12 }} />
        <div style={{ height: 32, width: 320, background: 'rgba(255,255,255,0.05)', borderRadius: 10, marginBottom: 32 }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
          {cards.map((_, i) => (
            <div key={i} style={{
              background: BG_CARD,
              backdropFilter: `blur(${GLASS_BLUR})`,
              WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
              border: `1px solid ${BORDER}`,
              borderRadius: 20,
              padding: 20,
              boxShadow: GLASS_SHADOW,
              minHeight: 140,
            }} />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
          {nav.map((_, i) => (
            <div key={i} style={{
              background: BG_CARD,
              backdropFilter: `blur(${GLASS_BLUR})`,
              WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
              border: `1px solid ${BORDER}`,
              borderRadius: 20,
              padding: 16,
              boxShadow: GLASS_SHADOW,
              minHeight: 60,
            }} />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
          <div style={{
            background: BG_CARD,
            backdropFilter: `blur(${GLASS_BLUR})`,
            WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            boxShadow: GLASS_SHADOW,
            minHeight: 320,
          }} />
          <div style={{
            background: BG_CARD,
            backdropFilter: `blur(${GLASS_BLUR})`,
            WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            boxShadow: GLASS_SHADOW,
            minHeight: 320,
          }} />
        </div>
      </div>
    </div>
  )
}
