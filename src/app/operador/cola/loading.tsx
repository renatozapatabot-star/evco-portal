export default function ColaLoading() {
  return (
    <div className="page-shell" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="skeleton-shimmer" style={{ width: 220, height: 28, borderRadius: 8, marginBottom: 8 }} />
      <div className="skeleton-shimmer" style={{ width: 140, height: 16, borderRadius: 6, marginBottom: 24 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ width: 100, height: 36, borderRadius: 20 }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            display: 'flex', gap: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: 20,
          }}>
            <div className="skeleton-shimmer" style={{ width: 4, borderRadius: 4, alignSelf: 'stretch' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton-shimmer" style={{ width: 80, height: 12, borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: '60%', height: 16, borderRadius: 4, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: '40%', height: 12, borderRadius: 4 }} />
            </div>
            <div className="skeleton-shimmer" style={{ width: 100, height: 40, borderRadius: 10, alignSelf: 'center' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
