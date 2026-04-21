import {
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  TEXT_MUTED,
} from '@/lib/design-system'

const skeletonCard: React.CSSProperties = {
  background: BG_CARD,
  backdropFilter: `blur(${GLASS_BLUR})`,
  WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
  border: `1px solid ${BORDER}`,
  borderRadius: 20,
  boxShadow: GLASS_SHADOW,
}

/**
 * Loading skeleton that mirrors the new detail layout: header,
 * 6-tile hero, two-column grid (tab panel + right rail), below-fold
 * stack. Keeps operator oriented while the server parallel-fetches.
 */
export default function Loading() {
  return (
    <div style={{ padding: '8px 0', maxWidth: 1400, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ ...skeletonCard, height: 48, width: 240 }} />
        <div style={{ ...skeletonCard, height: 32, width: 120 }} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} style={{ ...skeletonCard, minHeight: 92 }} />
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ ...skeletonCard, minHeight: 480 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...skeletonCard, minHeight: 280 }} />
          <div style={{ ...skeletonCard, minHeight: 280 }} />
        </div>
      </div>

      <div
        style={{
          textAlign: 'center',
          padding: '20px 0',
          fontSize: 'var(--aguila-fs-meta)',
          color: TEXT_MUTED,
        }}
      >
        Cargando…
      </div>
    </div>
  )
}
