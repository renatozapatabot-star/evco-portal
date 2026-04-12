'use client'

export interface TabPlaceholderProps {
  title: string
  slice: 'B6b' | 'B6c'
}

export function TabPlaceholder({ title, slice }: TabPlaceholderProps) {
  return (
    <div
      style={{
        padding: 32,
        borderRadius: 20,
        background: 'rgba(9,9,11,0.75)',
        border: '1px solid rgba(192,197,206,0.18)',
        backdropFilter: 'blur(20px)',
        color: 'var(--text-secondary)',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)', fontWeight: 600 }}>
        {title}
      </h2>
      <p style={{ marginTop: 12, fontSize: 13 }}>
        Próximamente · contenido llega en Slice {slice}.
      </p>
    </div>
  )
}
