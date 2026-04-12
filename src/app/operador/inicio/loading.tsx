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
    <div className="p-4 md:px-7 md:py-6" style={{ minHeight: '100vh' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <Skeleton /><Skeleton /><Skeleton /><Skeleton />
      </div>
      <Skeleton height={64} />
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
        <Skeleton height={520} />
        <Skeleton height={520} />
      </div>
    </div>
  )
}
