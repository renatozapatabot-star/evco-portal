import { BORDER, GLASS_BLUR, GLASS_SHADOW, COCKPIT_CANVAS, TEXT_PRIMARY, TEXT_MUTED } from '@/lib/design-system'

/**
 * Cockpit loading skeleton — shown while SSR hydrates. Deliberately more
 * visible than the glass cards so users see immediate feedback. Shimmer
 * animation signals activity.
 */
const SKELETON_BG = 'rgba(255,255,255,0.06)'

function Block({ height = 120, width = '100%', radius = 20 }: { height?: number | string; width?: number | string; radius?: number }) {
  return (
    <div
      className="aguila-skeleton-shimmer"
      style={{
        width,
        height,
        background: SKELETON_BG,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        borderRadius: radius,
        boxShadow: GLASS_SHADOW,
      }}
    />
  )
}

export function CockpitSkeleton() {
  return (
    <div className="aguila-dark" style={{ position: 'relative', minHeight: '100vh', background: COCKPIT_CANVAS, color: TEXT_PRIMARY, fontFamily: 'var(--font-sans)', overflow: 'hidden' }}>
      <div className="p-4 md:px-7 md:py-6" style={{ position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Block width={36} height={36} radius={8} />
          <Block width={220} height={18} radius={6} />
        </div>
        <Block width={320} height={28} radius={10} />
        <div style={{ fontSize: 13, color: TEXT_MUTED, margin: '8px 0 32px 0' }}>
          Cargando cockpit…
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
          <Block height={140} /><Block height={140} /><Block height={140} /><Block height={140} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
          <Block height={88} /><Block height={88} />
          <Block height={88} /><Block height={88} />
          <Block height={88} /><Block height={88} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
          <Block height={320} />
          <Block height={320} />
        </div>
      </div>

      <style>{`
        @keyframes aguila-skeleton-shimmer {
          0%   { opacity: 0.75; }
          50%  { opacity: 1; }
          100% { opacity: 0.75; }
        }
        .aguila-skeleton-shimmer {
          animation: aguila-skeleton-shimmer 1.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .aguila-skeleton-shimmer { animation: none; opacity: 0.9; }
        }
      `}</style>
    </div>
  )
}
