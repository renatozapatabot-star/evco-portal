export default function Loading() {
  return (
    <div className="aguila-dark" style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #05070B 0%, #0B1220 100%)',
      padding: '24px 16px',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div className="skeleton-shimmer" style={{ width: 280, height: 32, borderRadius: 8, marginBottom: 8 }} />
          <div className="skeleton-shimmer" style={{ width: 200, height: 18, borderRadius: 6 }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="skeleton-shimmer" style={{
                height: 100, borderRadius: 20,
                background: 'rgba(255,255,255,0.04)',
              }} />
            ))}
          </div>
          <div className="skeleton-shimmer" style={{
            height: 500, borderRadius: 20,
            background: 'rgba(255,255,255,0.04)',
          }} />
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .skeleton-shimmer:nth-child(2) { display: none; }
        }
      `}</style>
    </div>
  )
}
