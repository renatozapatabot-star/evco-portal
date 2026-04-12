import { BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW } from '@/lib/design-system'

function Skeleton({ height = 120 }: { height?: number }) {
  return (
    <div style={{
      background: BG_CARD,
      backdropFilter: `blur(${GLASS_BLUR})`,
      WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
      border: `1px solid ${BORDER}`,
      borderRadius: 20,
      boxShadow: GLASS_SHADOW,
      height,
      opacity: 0.4,
    }} />
  )
}

export default function Loading() {
  return (
    <div className="p-4 md:px-7 md:py-6" style={{ minHeight: '100vh', maxWidth: 1400, margin: '0 auto' }}>
      <Skeleton height={80} />
      <div style={{ marginTop: 16 }}>
        <Skeleton height={64} />
      </div>
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Skeleton /><Skeleton /><Skeleton /><Skeleton />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <Skeleton height={96} /><Skeleton height={96} />
            <Skeleton height={96} /><Skeleton height={96} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Skeleton height={200} />
          <Skeleton height={220} />
        </div>
      </div>
    </div>
  )
}
