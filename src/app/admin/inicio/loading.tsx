import { BG_GRADIENT_START, BG_GRADIENT_END, TEXT_MUTED } from '@/lib/design-system'

const skelCard: React.CSSProperties = {
  borderRadius: 20,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
}

export default function Loading() {
  return (
    <div
      className="aguila-dark"
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${BG_GRADIENT_START} 0%, ${BG_GRADIENT_END} 100%)`,
        padding: '24px 16px',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 24, color: TEXT_MUTED, fontSize: 13 }}>Cargando cockpit…</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 340px',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 12,
              }}
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ ...skelCard, minHeight: 120 }} />
              ))}
            </div>
            <div style={{ ...skelCard, height: 380 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...skelCard, height: 180 }} />
            <div style={{ ...skelCard, height: 180 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
