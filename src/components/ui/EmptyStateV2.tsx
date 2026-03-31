'use client'

import { FeedbackButton } from '@/components/ui/FeedbackButton'

export function EmptyStateV2({ variant, title, description, action, lastChecked }: {
  variant: 'monitored' | 'complete' | 'waiting' | 'error'
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  lastChecked?: Date
}) {
  const icons = { monitored: '\u{1F4E1}', complete: '\u2713', waiting: '\u23F3', error: '\u26A0' }
  return (
    <div style={{ textAlign: 'center', padding: '32px 20px', color: '#6B6B6B' }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>{icons[variant]}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: '#1A1A1A' }}>{title}</div>
      {description && <div style={{ fontSize: 12, marginBottom: 12 }}>{description}</div>}
      {lastChecked && (
        <div style={{ fontSize: 11, color: '#9C9890', fontFamily: 'var(--font-jetbrains-mono)' }}>
          Última verificación: {new Date(lastChecked).toLocaleString('es-MX', { timeZone: 'America/Chicago' })}
        </div>
      )}
      {action && (
        <button onClick={action.onClick} style={{
          marginTop: 12, padding: '8px 16px',
          background: '#B8953F', color: '#FFF',
          border: 'none', borderRadius: 8, cursor: 'pointer',
          fontSize: 13, fontWeight: 700, minHeight: 60,
        }}>
          {action.label}
        </button>
      )}
      {(variant === 'error' || variant === 'waiting') && (
        <FeedbackButton context={`${variant}: ${title}`} />
      )}
    </div>
  )
}
