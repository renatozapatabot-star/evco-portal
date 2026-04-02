export function NullCell({ type = 'table' }: { type?: 'table' | 'pending' | 'error' }) {
  if (type === 'table') return <span style={{ color: 'var(--n-300)', fontSize: 13 }}>—</span>
  if (type === 'pending') return <span style={{ color: '#D4952A', fontSize: 12, fontStyle: 'italic' }}>Pendiente</span>
  if (type === 'error') return <span style={{ color: 'var(--danger-500)', fontSize: 12, fontWeight: 600 }}>Faltante</span>
  return null
}
