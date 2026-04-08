export function DashboardSkeleton({ isMobile = false }: { isMobile?: boolean }) {
  return (
    <div style={{ padding: isMobile ? '0 16px' : '0 48px' }}>
      {/* Mission Header skeleton */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: isMobile ? '16px 20px' : '24px 28px',
        margin: '16px 0', borderRadius: 16, background: '#1A1A1A',
      }}>
        <div className="skeleton-shimmer" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton-shimmer" style={{ width: '60%', height: 20, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 140, height: 14, borderRadius: 4 }} />
        </div>
      </div>

      {/* Wide-screen grid */}
      <div className="cc-grid-wide">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Large card skeletons */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: 16,
          }}>
            {[0, 1].map(i => (
              <div key={i} className="skeleton-shimmer" style={{
                height: 200, borderRadius: 16, background: '#222222',
              }} />
            ))}
          </div>
          {/* Small card skeletons */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
            gap: 12,
          }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton-shimmer" style={{
                height: 160, borderRadius: 12,
              }} />
            ))}
          </div>
        </div>
        {/* Pulse skeleton — dark themed */}
        {!isMobile && (
          <div className="cc-pulse-dark" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="skeleton-shimmer" style={{ height: 16, width: '60%', borderRadius: 4 }} />
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="skeleton-shimmer" style={{ height: 36, borderRadius: 8 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
