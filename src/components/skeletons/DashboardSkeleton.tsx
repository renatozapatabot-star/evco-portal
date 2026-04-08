export function DashboardSkeleton({ isMobile = false }: { isMobile?: boolean }) {
  return (
    <div style={{ padding: isMobile ? 16 : 24, maxWidth: isMobile ? 700 : 1100, margin: '0 auto' }}>
      {/* Mission Header skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 0 16px' }}>
        <div className="skeleton-shimmer" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton-shimmer" style={{ width: '70%', height: 18, borderRadius: 4, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 140, height: 14, borderRadius: 4 }} />
        </div>
      </div>

      {isMobile ? (
        /* Mobile: stacked cards */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton-shimmer" style={{
              height: 72, borderRadius: 12,
              borderLeft: '3px solid var(--border)',
            }} />
          ))}
        </div>
      ) : (
        /* Desktop: two-column */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton-shimmer" style={{
                height: 72, borderRadius: 12,
                borderLeft: '3px solid var(--border)',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="skeleton-shimmer" style={{ height: 200, borderRadius: 12 }} />
            <div className="skeleton-shimmer" style={{ height: 100, borderRadius: 12 }} />
          </div>
        </div>
      )}
    </div>
  )
}
