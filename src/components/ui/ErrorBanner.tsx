'use client'

import { useState } from 'react'
import { AlertTriangle, RefreshCw, X } from 'lucide-react'

interface ErrorBannerProps {
  message: string
  onRetry?: () => void
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      background: 'var(--color-danger-muted)',
      borderLeft: '3px solid var(--color-danger)',
      borderRadius: 'var(--radius-md)',
      marginBottom: 12,
      fontSize: 'var(--aguila-fs-body)',
    }}>
      <AlertTriangle size={16} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
      <span style={{ flex: 1, color: 'var(--text-primary)' }}>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', fontSize: 'var(--aguila-fs-compact)', fontWeight: 600,
            background: 'var(--color-danger)', color: 'var(--text-on-accent)',
            border: 'none', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <RefreshCw size={12} /> Reintentar
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, padding: 0,
          background: 'transparent', border: 'none',
          color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0,
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
