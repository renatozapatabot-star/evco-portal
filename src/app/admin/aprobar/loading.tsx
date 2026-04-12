export default function AprobarLoading() {
  return (
    <div className="page-shell" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: 14 }} />
        <div>
          <div className="skeleton-shimmer" style={{ width: 180, height: 24, borderRadius: 6, marginBottom: 4 }} />
          <div className="skeleton-shimmer" style={{ width: 120, height: 14, borderRadius: 4 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ width: 120, height: 44, borderRadius: 20 }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="skeleton-shimmer" style={{ width: 80, height: 16, borderRadius: 10 }} />
              <div className="skeleton-shimmer" style={{ width: 60, height: 16, borderRadius: 10 }} />
            </div>
            <div className="skeleton-shimmer" style={{ width: '50%', height: 18, borderRadius: 4, marginBottom: 8 }} />
            <div className="skeleton-shimmer" style={{ width: '30%', height: 14, borderRadius: 4, marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="skeleton-shimmer" style={{ flex: 1, height: 60, borderRadius: 12 }} />
              <div className="skeleton-shimmer" style={{ width: 100, height: 60, borderRadius: 12 }} />
              <div className="skeleton-shimmer" style={{ width: 100, height: 60, borderRadius: 12 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
