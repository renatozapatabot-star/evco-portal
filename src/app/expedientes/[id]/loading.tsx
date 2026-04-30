export default function Loading() {
  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 64px' }}>
      <div className="skel" style={{ width: 180, height: 14, marginBottom: 12 }} />
      <div className="skel" style={{ width: 320, height: 32, marginBottom: 16 }} />
      <div className="skel" style={{ width: 460, height: 16, marginBottom: 36 }} />

      <div className="skel" style={{ width: 220, height: 14, marginBottom: 14 }} />
      <div className="skel" style={{ height: 320, borderRadius: 10 }} />
    </main>
  )
}
