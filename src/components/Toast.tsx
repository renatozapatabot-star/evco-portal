'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; message: string; type: ToastType }

const ToastCtx = createContext<{ toast: (msg: string, type?: ToastType) => void }>({ toast: () => {} })
export const useToast = () => useContext(ToastCtx)

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const icons = { success: CheckCircle, error: AlertTriangle, info: Info }
  const colors = { success: 'var(--status-green)', error: 'var(--status-red)', info: 'var(--status-blue)' }

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      {/* Toast stack */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => {
          const Icon = icons[t.type]
          return (
            <div key={t.id} style={{
              width: 320, padding: 16, borderRadius: 8, background: 'var(--bg-card)',
              border: '1px solid var(--border-default)', borderLeft: `3px solid ${colors[t.type]}`,
              display: 'flex', alignItems: 'flex-start', gap: 12,
              animation: 'fadein 200ms ease', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <Icon size={16} style={{ color: colors[t.type], flexShrink: 0, marginTop: 2 }} />
              <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.4 }}>{t.message}</span>
              <button onClick={() => dismiss(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0 }}>
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}
