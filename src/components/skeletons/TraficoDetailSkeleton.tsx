export function TraficoDetailSkeleton() {
  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div className="skeleton-shimmer" style={{ width: 200, height: 32, borderRadius: 4, marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton-shimmer" style={{ width: 80, height: 22, borderRadius: 12 }} />
          <div className="skeleton-shimmer" style={{ width: 70, height: 22, borderRadius: 12 }} />
        </div>
      </div>

      {/* Data cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="stat-card" style={{ padding: 16 }}>
            <div className="skeleton-shimmer" style={{ width: 60, height: 10, borderRadius: 3, marginBottom: 10 }} />
            <div className="skeleton-shimmer" style={{ width: 100, height: 18, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div style={{ background: 'var(--card-bg)', borderRadius: 8, padding: 20 }}>
        <div className="skeleton-shimmer" style={{ width: 160, height: 16, borderRadius: 4, marginBottom: 20 }} />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div className="skeleton-shimmer" style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-shimmer" style={{ width: 140, height: 13, borderRadius: 3, marginBottom: 4 }} />
              <div className="skeleton-shimmer" style={{ width: 90, height: 10, borderRadius: 3 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
