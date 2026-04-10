'use client'
import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { Upload, Search, MessageSquare, Phone, X } from 'lucide-react'

const GOLD_GRADIENT = 'linear-gradient(135deg, #eab308, #8B6914)'

export function CruzFAB() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Context-aware: on tráfico detail, pre-fill upload
  const isTraficoDetail = pathname.startsWith('/traficos/') && pathname !== '/traficos'
  const traficoId = isTraficoDetail ? decodeURIComponent(pathname.split('/')[2] || '') : ''

  const actions = [
    {
      icon: Upload, label: isTraficoDetail ? 'Subir doc' : 'Subir documento',
      color: '#0D9488',
      action: () => router.push(isTraficoDetail ? `/documentos/subir?trafico=${traficoId}` : '/documentos/subir'),
    },
    {
      icon: Search, label: 'Buscar',
      color: 'var(--info)',
      action: () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true })) },
    },
    {
      icon: MessageSquare, label: 'ADUANA AI',
      color: 'var(--gold)',
      action: () => document.dispatchEvent(new CustomEvent('cruz:open-chat')),
    },
    {
      icon: Phone, label: 'Llamar',
      color: 'var(--success)',
      action: () => { window.location.href = 'tel:+19568277000' },
    },
  ]

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,0.3)' }}
        />
      )}

      {/* Action buttons */}
      {open && (
        <div style={{ position: 'fixed', bottom: 90, right: 20, zIndex: 999, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => { setOpen(false); a.action() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 16px', borderRadius: 24,
                background: 'var(--bg-card)', border: 'none',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                cursor: 'pointer', minHeight: 60,
                animation: `fabSlideUp 150ms ease ${i * 50}ms both`,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</span>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <a.icon size={18} style={{ color: 'var(--bg-card)' }} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <button
        className="cruz-fab"
        onClick={() => setOpen(o => !o)}
        aria-label="Acciones rápidas"
        style={{ transform: open ? 'rotate(45deg)' : undefined, transition: 'transform 200ms ease' }}
      >
        {open ? (
          <X size={22} style={{ color: 'var(--text-primary)' }} />
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.08em' }}>CRUZ</span>
        )}
      </button>

      <style>{`
        @keyframes fabSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
