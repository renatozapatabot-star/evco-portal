export function NullCell({ type = 'table' }: { type?: 'table' | 'pending' | 'error' }) {
  if (type === 'table') return <span style={{ color: 'var(--n-300)', fontSize: 'var(--aguila-fs-body)' }}>—</span>
  if (type === 'pending') return <span style={{ color: 'var(--portal-status-amber-fg)', fontSize: 'var(--aguila-fs-compact)', fontStyle: 'italic' }}>Pendiente</span>
  if (type === 'error') return <span style={{ color: 'var(--danger-500)', fontSize: 'var(--aguila-fs-compact)', fontWeight: 600 }}>Faltante</span>
  return null
}
