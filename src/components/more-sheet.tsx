'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, FileText, FolderOpen, CreditCard, Table2 } from 'lucide-react'

const SECTIONS = [
  { label: 'Operaciones', items: [
    { href: '/pedimentos',  label: 'Pedimentos',    icon: FileText },
    { href: '/expedientes', label: 'Expedientes',   icon: FolderOpen },
  ]},
  { label: 'Administración', items: [
    { href: '/cuentas',     label: 'Cuentas',       icon: CreditCard },
    { href: '/anexo24',     label: 'Anexo 24',      icon: Table2 },
  ]},
]

export function MoreSheet() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('cruz:open-more', handler)
    return () => window.removeEventListener('cruz:open-more', handler)
  }, [])

  if (!open) return null

  return (
    <>
      <div className="m-sheet-overlay" onClick={() => setOpen(false)} />
      <div className="m-sheet">
        <div className="m-sheet-handle-row"><div className="m-sheet-handle" /></div>
        <div className="m-sheet-header">
          <span className="m-sheet-title">Más</span>
          <button className="m-sheet-close" onClick={() => setOpen(false)}><X size={20} /></button>
        </div>
        <div className="m-sheet-body">
          {SECTIONS.map(section => (
            <div key={section.label} className="m-sheet-section">
              <div className="m-sheet-section-label">{section.label}</div>
              {section.items.map(item => (
                <button key={item.href} className="m-sheet-item" onClick={() => { router.push(item.href); setOpen(false) }}>
                  <item.icon size={20} style={{ color: 'var(--n-400)' }} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
