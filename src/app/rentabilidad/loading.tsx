export default function Loading() {
  return (
    <div className="page-shell">
      <div className="skeleton-shimmer" style={{ height: 28, width: 240, borderRadius: 6, marginBottom: 8 }} />
      <div className="skeleton-shimmer" style={{ height: 14, width: 320, borderRadius: 4, marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 68, borderRadius: 8 }} />)}
      </div>
      {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 140, borderRadius: 10, marginBottom: 12 }} />)}
    </div>
  )
}
