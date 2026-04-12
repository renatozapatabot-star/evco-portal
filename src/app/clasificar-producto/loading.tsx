export default function ClasificarLoading() {
  return (
    <div className="page-shell" style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div className="skeleton-shimmer" style={{ width: 44, height: 44, borderRadius: 14 }} />
        <div>
          <div className="skeleton-shimmer" style={{ width: 200, height: 24, borderRadius: 6, marginBottom: 4 }} />
          <div className="skeleton-shimmer" style={{ width: 300, height: 14, borderRadius: 4 }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="skeleton-shimmer" style={{ width: '100%', height: 100, borderRadius: 12 }} />
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ width: '100%', height: 56, borderRadius: 12 }} />
        ))}
        <div className="skeleton-shimmer" style={{ width: '100%', height: 60, borderRadius: 12 }} />
      </div>
    </div>
  )
}
