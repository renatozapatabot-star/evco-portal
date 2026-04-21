'use client'
import { useState, useEffect } from 'react'
import { getClientClaveCookie } from '@/lib/client-config'

interface StatusOverride {
  level: 'ok' | 'warning' | 'danger'
  text: string
}

export function StatusStrip({ override }: { override?: StatusOverride | null }) {
  const [status, setStatus] = useState<{ level: string; sentence: string } | null>(() => {
    if (typeof window === 'undefined') return null
    const clave = getClientClaveCookie()
    const cached = localStorage.getItem(`cruz_status_${clave}`)
    if (!cached) return null
    try { return JSON.parse(cached) } catch { return null }
  })

  useEffect(() => {
    const clave = getClientClaveCookie()
    fetch('/api/status-sentence').then(r => r.json()).then(fresh => {
      setStatus(fresh)
      localStorage.setItem(`cruz_status_${clave}`, JSON.stringify({ ...fresh, cached_at: Date.now() }))
    }).catch(() => { /* silent */ })
  }, [])

  // Use override if provided (from dashboard data), otherwise use API status
  const displayLevel = override?.level ?? (status?.level === 'red' ? 'danger' : status?.level === 'amber' ? 'warning' : 'ok')
  const displayText = override?.text ?? status?.sentence

  const dotColor = displayLevel === 'danger' ? '#C03030'
    : displayLevel === 'warning' ? '#C07A18'
    : '#1A7A34'

  const dotClass = displayLevel === 'ok' ? 'dot-live' : ''

  return (
    <div className="status-strip" style={{
      position: 'fixed', left: 0, right: 0, zIndex: 898,
      background: 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    }}>
      {displayText ? (
        <>
          <span className={`status-strip-dot ${dotClass}`} style={{ borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
          <span className="status-strip-text" style={{ fontWeight: 600, color: 'var(--portal-ink-1)' }}>{displayText}</span>
        </>
      ) : (
        <div className="skeleton status-strip-skeleton" style={{ borderRadius: 4 }} />
      )}
    </div>
  )
}
