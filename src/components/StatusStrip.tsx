'use client'
import { useState, useEffect } from 'react'
import { CLIENT_CLAVE } from '@/lib/client-config'

export function StatusStrip() {
  const [status, setStatus] = useState<{ level: string; sentence: string } | null>(() => {
    if (typeof window === 'undefined') return null
    const cached = localStorage.getItem(`cruz_status_${CLIENT_CLAVE}`)
    if (!cached) return null
    try { return JSON.parse(cached) } catch { return null }
  })

  useEffect(() => {
    fetch('/api/status-sentence').then(r => r.json()).then(fresh => {
      setStatus(fresh)
      localStorage.setItem(`cruz_status_${CLIENT_CLAVE}`, JSON.stringify({ ...fresh, cached_at: Date.now() }))
    }).catch(() => { /* silent */ })
  }, [])

  const dotColor = status?.level === 'red' ? '#C03030' : status?.level === 'amber' ? '#C07A18' : '#1A7A34'

  return (
    <div className="status-strip" style={{
      position: 'fixed', left: 0, right: 0, zIndex: 898,
      background: 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>
      {status ? (
        <>
          <span className="status-strip-dot" style={{ borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
          <span className="status-strip-text" style={{ fontWeight: 600, color: '#1A1A18' }}>{status.sentence}</span>
        </>
      ) : (
        <div className="skeleton status-strip-skeleton" style={{ borderRadius: 4 }} />
      )}
    </div>
  )
}
