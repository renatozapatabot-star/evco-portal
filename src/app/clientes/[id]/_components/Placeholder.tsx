import { TEXT_MUTED } from '@/lib/design-system'

export function Placeholder({ message }: { message?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '32px 16px', color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>
      {message ?? 'Disponible próximamente.'}
    </div>
  )
}
