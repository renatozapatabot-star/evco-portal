'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react'
import { playSound } from '@/lib/sounds'

type ToastType = 'success' | 'error' | 'info' | 'celebration'
interface Toast { id: number; message: string; type: ToastType }

const ToastCtx = createContext<{ toast: (msg: string, type?: ToastType) => void }>({ toast: () => {} })
export const useToast = () => useContext(ToastCtx)

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), type === 'celebration' ? 6000 : 4000)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(type === 'error' ? [10, 30, 10] : 10)
    playSound(type === 'celebration' ? 'achievement' : type === 'error' ? 'alert' : 'success')
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const icons: Record<string, typeof CheckCircle | null> = { success: CheckCircle, error: AlertTriangle, info: Info, celebration: null }
  const colors: Record<string, string> = { success: 'var(--status-green)', error: 'var(--status-red)', info: 'var(--status-blue)', celebration: 'var(--gold, #eab308)' }

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      {/* Toast stack */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => {
          const Icon = icons[t.type]
          return (
            <div key={t.id} style={{
              width: 340, padding: '14px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(0,0,0,0.06)', borderLeft: `3px solid ${colors[t.type]}`,
              display: 'flex', alignItems: 'flex-start', gap: 12,
              backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', animation: 'toastSlideIn 300ms cubic-bezier(0.2, 0, 0, 1)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            }}>
              {Icon
                ? <Icon size={16} style={{ color: colors[t.type], flexShrink: 0, marginTop: 2 }} />
                : <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1, lineHeight: 1 }}>🦀</span>
              }
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
