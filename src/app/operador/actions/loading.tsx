export default function ActionsQueueLoading() {
  return (
    <div
      className="aguila-dark aguila-canvas"
      style={{
        minHeight: '100vh',
        padding: '24px 16px',
        color: 'var(--portal-fg-3)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div
          style={{
            height: 28,
            width: 240,
            borderRadius: 6,
            background: 'rgba(255,255,255,0.04)',
            marginBottom: 12,
          }}
        />
        <div
          style={{
            height: 16,
            width: 360,
            borderRadius: 6,
            background: 'rgba(255,255,255,0.03)',
            marginBottom: 32,
          }}
        />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 120,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: 12,
            }}
          />
        ))}
      </div>
    </div>
  )
}
