export default function Loading() {
  return (
    <div className="page-shell">
      <div className="skeleton-shimmer" style={{ height: 28, width: 280, borderRadius: 6, marginBottom: 8 }} />
      <div className="skeleton-shimmer" style={{ height: 14, width: 340, borderRadius: 4, marginBottom: 24 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 60, borderRadius: 8 }} />)}
      </div>
      {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 120, borderRadius: 8, marginBottom: 12 }} />)}
    </div>
  )
}
