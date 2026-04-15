'use client'
import { useState } from 'react'

const UPDATES = [
  { text: 'ZAPATA AI con 17 herramientas, voz, y memoria de sesión' },
  { text: 'Cruz Score con documentos (40%), tiempo, pagos, cumplimiento' },
  { text: 'Alertas en tiempo real — score < 50, overdue, incidencias' },
  { text: 'T-MEC savings calculator en pedimentos' },
  { text: 'Dashboard reorganizado — acciones primero, KPIs después' },
]

const VERSION = 'cruz-whatsnew-v2'

export function WhatsNew() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem(VERSION) === 'true'
  })

  if (dismissed) return null

  return (
    <div style={{
      background: 'var(--gold-50)', borderLeft: '3px solid var(--gold-500)',
      borderRadius: '0 8px 8px 0', padding: '12px 16px',
      marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 800, color: 'var(--n-900)', marginBottom: 6 }}>
          Novedades en ZAPATA AI
        </div>
        {UPDATES.slice(0, 4).map((u, i) => (
          <div key={i} style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--n-600)', marginTop: 3, lineHeight: 1.5 }}>
            - {u.text}
          </div>
        ))}
      </div>
      <button onClick={() => {
        setDismissed(true)
        localStorage.setItem(VERSION, 'true')
      }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--n-400)', fontSize: 'var(--aguila-fs-section)', padding: 4 }}>
        x
      </button>
    </div>
  )
}
