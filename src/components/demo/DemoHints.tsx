'use client'

import { useState, useEffect } from 'react'

const HINTS = [
  { text: 'Este es tu estado en tiempo real — todo actualizado automáticamente', position: 'top' },
  { text: 'Toca cualquier tarjeta para ver más detalle sobre tus operaciones', position: 'middle' },
  { text: 'AGUILA AI responde preguntas sobre tus tráficos, pedimentos y documentos', position: 'middle' },
  { text: '¿Lo quieres para tu firma? Toca el botón dorado abajo ↓', position: 'bottom' },
]

export function DemoHints() {
  const [currentHint, setCurrentHint] = useState(0)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('demo-hints-seen')) {
      setDismissed(true)
    }
  }, [])

  if (dismissed) return null

  const hint = HINTS[currentHint]
  if (!hint) return null

  const handleNext = () => {
    if (currentHint >= HINTS.length - 1) {
      setDismissed(true)
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('demo-hints-seen', '1')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setCurrentHint(c => c + 1)
    }
  }

  const positionStyles: Record<string, React.CSSProperties> = {
    top: { top: 100, left: '50%', transform: 'translateX(-50%)' },
    middle: { top: '40%', left: '50%', transform: 'translate(-50%, -50%)' },
    bottom: { bottom: 120, left: '50%', transform: 'translateX(-50%)' },
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={handleNext}>
      <div style={{
        position: 'absolute',
        ...positionStyles[hint.position],
        background: '#E8EAED',
        color: '#111',
        padding: '16px 24px',
        borderRadius: 12,
        maxWidth: 320,
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'fadeIn 300ms ease',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}>
          {hint.text}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, opacity: 0.7 }}>
            {currentHint + 1} de {HINTS.length}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setDismissed(true); if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('demo-hints-seen', '1'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={{
              background: 'transparent', color: 'rgba(0,0,0,0.5)', border: 'none',
              padding: '8px 12px', borderRadius: 8, fontSize: 12,
              cursor: 'pointer', minHeight: 36,
            }}>
              Saltar
            </button>
            <button onClick={handleNext} style={{
              background: '#111', color: '#E8EAED', border: 'none',
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', minHeight: 36,
            }}>
              {currentHint >= HINTS.length - 1 ? 'Explorar →' : 'Siguiente →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
