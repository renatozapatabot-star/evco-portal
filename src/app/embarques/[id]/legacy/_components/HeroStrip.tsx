import { BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW, TEXT_MUTED, TEXT_PRIMARY } from '@/lib/design-system'

export interface HeroTile {
  label: string
  value: string
  hint?: string | null
  mono?: boolean
}

export function HeroStrip({ tiles }: { tiles: HeroTile[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 20,
      }}
      className="hero-strip"
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          style={{
            background: BG_CARD,
            backdropFilter: `blur(${GLASS_BLUR})`,
            WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: '16px 20px',
            boxShadow: GLASS_SHADOW,
            minHeight: 92,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 'var(--aguila-fs-meta)',
              fontWeight: 700,
              color: TEXT_MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {t.label}
          </div>
          <div
            style={{
              fontSize: 'var(--aguila-fs-title)',
              fontWeight: 800,
              color: TEXT_PRIMARY,
              fontFamily: t.mono ? 'var(--font-mono)' : undefined,
              lineHeight: 1.1,
              marginTop: 6,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {t.value}
          </div>
          {t.hint && (
            <div
              style={{
                fontSize: 'var(--aguila-fs-meta)',
                color: TEXT_MUTED,
                marginTop: 4,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {t.hint}
            </div>
          )}
        </div>
      ))}
      <style>{`
        @media (max-width: 900px) {
          .hero-strip { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
