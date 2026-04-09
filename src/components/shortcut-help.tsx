'use client'
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const SHORTCUTS = [
  { section: 'Navegación', items: [
    { keys: ['Ctrl','K'], desc: 'Abrir búsqueda global' },
    { keys: ['g','d'], desc: 'Ir a Dashboard' },
    { keys: ['g','t'], desc: 'Ir a Tráficos' },
    { keys: ['g','e'], desc: 'Ir a Entradas' },
    { keys: ['g','p'], desc: 'Ir a Pedimentos' },
    { keys: ['g','x'], desc: 'Ir a Expedientes' },
    { keys: ['g','r'], desc: 'Ir a Reportes' },
    { keys: ['g','c'], desc: 'Ir a Cuentas' },
  ]},
  { section: 'General', items: [
    { keys: ['?'],     desc: 'Mostrar atajos de teclado' },
    { keys: ['Esc'],   desc: 'Cerrar panel / modal' },
  ]},
]

export function ShortcutHelp() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setOpen(p => !p) }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])
  if (!open) return null
  return (
    <>
      <div className="cmd-overlay" onClick={() => setOpen(false)} />
      <div className="shortcut-modal" role="dialog" aria-label="Atajos de teclado">
        <div className="shortcut-header">
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--n-900)' }}>Atajos de teclado</span>
          <button className="act-btn" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="shortcut-body">
          {SHORTCUTS.map(section => (
            <div key={section.section} className="shortcut-section">
              <div className="shortcut-section-title">{section.section}</div>
              {section.items.map(item => (
                <div key={item.desc} className="shortcut-row">
                  <div className="shortcut-keys">
                    {item.keys.map((k, i) => (
                      <span key={i}>
                        <kbd className="shortcut-key">{k}</kbd>
                        {i < item.keys.length-1 && <span style={{margin:'0 3px',color:'var(--n-300)',fontSize:10}}>+</span>}
                      </span>
                    ))}
                  </div>
                  <span className="shortcut-desc">{item.desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
