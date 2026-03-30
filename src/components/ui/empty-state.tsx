import { CheckCircle, Search, AlertTriangle, Truck, FileText } from 'lucide-react'

interface EmptyStateProps {
  icon: 'check' | 'search' | 'alert' | 'truck' | 'docs'
  title: string
  subtitle?: string
  action?: { label: string; href?: string; onClick?: () => void }
}

const ICONS = {
  check: CheckCircle,
  search: Search,
  alert: AlertTriangle,
  truck: Truck,
  docs: FileText,
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const Icon = ICONS[icon]
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 'var(--space-12) var(--space-6)',
      textAlign: 'center', gap: 'var(--space-3)'
    }}>
      <Icon size={32} style={{ color: 'var(--text-tertiary)' }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{subtitle}</div>}
      {action && (
        <a href={action.href} onClick={action.onClick} style={{
          marginTop: 'var(--space-2)', color: 'var(--gold, #B8953F)',
          fontSize: 14, fontWeight: 600, textDecoration: 'none'
        }}>{action.label} →</a>
      )}
    </div>
  )
}
