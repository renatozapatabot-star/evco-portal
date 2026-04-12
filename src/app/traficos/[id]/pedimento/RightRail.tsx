'use client'

/**
 * RightRail — placeholder for Slice B6a. Real Validación + Acciones Rápidas
 * panels wire in during B6b once the autosave + validation engine is live.
 */
export function RightRail() {
  const panels = [
    { title: 'Validación', subtitle: 'Próximamente · errores en vivo' },
    { title: 'Acciones rápidas', subtitle: 'Próximamente · siguientes pasos' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {panels.map((p) => (
        <div
          key={p.title}
          style={{
            padding: 20,
            borderRadius: 20,
            background: 'rgba(9,9,11,0.75)',
            border: '1px solid rgba(192,197,206,0.18)',
            backdropFilter: 'blur(20px)',
            color: 'var(--text-secondary)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: 8,
            }}
          >
            {p.title}
          </div>
          <div style={{ fontSize: 13 }}>{p.subtitle}</div>
        </div>
      ))}
    </div>
  )
}
