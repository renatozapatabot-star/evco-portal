'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])
  
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '400px', gap: '16px',
      color: 'var(--text-secondary)',
      fontFamily: 'var(--font-ui)'
    }}>
      <div style={{ fontSize: '32px' }}>⚠️</div>
      <p style={{ color: 'var(--text-primary)', 
                  fontWeight: 600 }}>
        Algo salió mal
      </p>
      <p style={{ fontSize: '14px', 
                  color: 'var(--text-secondary)' }}>
        {error.message || 'Error inesperado'}
      </p>
      <button onClick={reset} style={{
        background: 'var(--accent-primary)',
        color: 'var(--text-on-accent)',
        border: 'none', borderRadius: '6px',
        padding: '8px 16px', cursor: 'pointer',
        fontSize: '13px', fontWeight: 600
      }}>
        Intentar de nuevo
      </button>
    </div>
  )
}
