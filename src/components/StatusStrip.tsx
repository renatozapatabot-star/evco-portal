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
    <div style={{
      position: 'fixed', top: 96, left: 0, right: 0, height: 44, zIndex: 898,
      background: '#F7F6F3', borderBottom: '1px solid #F0ECE4',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      {status ? (
        <>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>{status.sentence}</span>
        </>
      ) : (
        <div className="skeleton" style={{ height: 16, width: 300, borderRadius: 4 }} />
      )}
    </div>
  )
}
