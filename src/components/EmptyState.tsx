import { FolderOpen } from 'lucide-react'

interface Props {
  icon?: React.ReactNode
  title?: string
  subtitle?: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({
  icon,
  title = 'Sin datos',
  subtitle = 'No hay información disponible',
  action,
}: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '64px 32px', textAlign: 'center',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 8, background: 'rgba(212,168,67,0.1)',
        border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16,
      }}>
        {icon || <FolderOpen size={20} style={{ color: 'var(--amber-600)' }} />}
      </div>
      <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</p>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 320 }}>{subtitle}</p>
      {action && (
        <button onClick={action.onClick} style={{
          marginTop: 16, padding: '8px 24px', borderRadius: 8,
          background: 'rgba(212,168,67,0.1)', border: '1px solid var(--border-primary)',
          color: 'var(--amber-600)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}>{action.label}</button>
      )}
    </div>
  )
}
