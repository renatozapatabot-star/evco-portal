'use client'
import { useEffect, useState } from 'react'

export function TipoCambioWidget() {
  const [tc, setTc] = useState<{ tc: number; source?: string } | null>(null)
  useEffect(() => { fetch('/api/tipo-cambio').then(r => r.json()).then(setTc).catch(() => setTc({ tc: 17.50, source: 'fallback' })) }, [])
  if (!tc) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F2F1EE', border: '1px solid #E6E3DC', borderRadius: 7, padding: '4px 10px', fontSize: 12 }}>
      <span style={{ color: '#9C9690', fontSize: 10 }}>TC FIX</span>
      <span style={{ color: '#18160F', fontWeight: 700 }}>${Number(tc.tc).toFixed(4)}</span>
      <span style={{ color: '#9C9690', fontSize: 10 }}>MXN/USD</span>
      {tc.source === 'Banxico FIX' && <span style={{ color: 'var(--success-dark, #166534)', fontSize: 9, fontWeight: 700 }}>● LIVE</span>}
    </div>
  )
}
