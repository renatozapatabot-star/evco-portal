export function DashboardSkeleton({ isMobile = false }: { isMobile?: boolean }) {
  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 960, margin: '0 auto' }}>
      {/* StatusStrip */}
      <div className="skeleton-shimmer" style={{ height: 48, borderRadius: 8, marginBottom: 16 }} />

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <div className="skeleton-shimmer" style={{ width: 280, height: 28, borderRadius: 4, marginBottom: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 200, height: 14, borderRadius: 4 }} />
      </div>

      {/* KPI cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
        gap: 16, marginBottom: 24,
      }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="stat-card" style={{ padding: 20 }}>
            <div className="skeleton-shimmer" style={{ width: 80, height: 12, borderRadius: 3, marginBottom: 12 }} />
            <div className="skeleton-shimmer" style={{ width: 48, height: 28, borderRadius: 4 }} />
          </div>
        ))}
      </div>

      {/* Sparkline card */}
      <div className="skeleton-shimmer" style={{ height: 64, borderRadius: 8, marginBottom: 24 }} />

      {/* Bridge times card */}
      <div className="skeleton-shimmer" style={{ height: 80, borderRadius: 8, marginBottom: 24 }} />

      {/* Table */}
      <div style={{ background: 'var(--card-bg)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between' }}>
          <div className="skeleton-shimmer" style={{ width: 140, height: 16, borderRadius: 4 }} />
          <div className="skeleton-shimmer" style={{ width: 80, height: 14, borderRadius: 4 }} />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 20px', borderTop: '1px solid var(--slate-200)' }}>
            <div className="skeleton-shimmer" style={{ width: 90, height: 14, borderRadius: 3 }} />
            <div className="skeleton-shimmer" style={{ width: 70, height: 14, borderRadius: 3 }} />
            <div className="skeleton-shimmer" style={{ width: 60, height: 14, borderRadius: 3 }} />
            <div className="skeleton-shimmer" style={{ width: 120, height: 14, borderRadius: 3, flex: 1 }} />
            <div className="skeleton-shimmer" style={{ width: 70, height: 14, borderRadius: 3, marginLeft: 'auto' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
