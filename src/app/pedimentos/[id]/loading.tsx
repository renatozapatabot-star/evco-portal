export default function Loading() {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 48px' }}>
      <div className="skel" style={{ width: 180, height: 14, marginBottom: 12 }} />
      <div className="skel" style={{ width: 320, height: 32, marginBottom: 8 }} />
      <div className="skel" style={{ width: 220, height: 16, marginBottom: 32 }} />

      <div className="skel" style={{ width: 240, height: 14, marginBottom: 12 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 32 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skel" style={{ height: 70, borderRadius: 10 }} />
        ))}
      </div>

      <div className="skel" style={{ width: 180, height: 14, marginBottom: 12 }} />
      <div className="skel" style={{ height: 240, borderRadius: 10 }} />
    </main>
  )
}
