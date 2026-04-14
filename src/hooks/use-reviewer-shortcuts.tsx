'use client'

import { useEffect, useCallback, useState } from 'react'

interface ReviewerShortcutHandlers {
  onApprove?: () => void
  onReject?: () => void
  onReview?: () => void
  onNext?: () => void
  onPrev?: () => void
  onApproveAll?: () => void
  onToggleFlow?: () => void
  enabled?: boolean
}

/**
 * Keyboard shortcuts for reviewer mode across all CRUZ surfaces.
 *
 * A / Enter  → Approve current proposal
 * X / Escape → Reject (opens taxonomy)
 * R          → Open review detail
 * Space      → Approve + advance to next
 * J / ↓      → Next proposal
 * K / ↑      → Previous proposal
 * Shift+A    → Approve all high-confidence
 * F          → Toggle flow mode
 * ?          → Show shortcut help (handled by parent)
 */
export function useReviewerShortcuts({
  onApprove, onReject, onReview, onNext, onPrev, onApproveAll, onToggleFlow,
  enabled = true,
}: ReviewerShortcutHandlers) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return

    // Don't fire shortcuts when typing in inputs
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return

    switch (e.key) {
      case 'a':
      case 'Enter':
        if (e.shiftKey && e.key === 'a') { onApproveAll?.(); e.preventDefault(); return }
        onApprove?.(); e.preventDefault(); break
      case ' ':
        onApprove?.(); setTimeout(() => onNext?.(), 300); e.preventDefault(); break
      case 'x':
      case 'Escape':
        onReject?.(); e.preventDefault(); break
      case 'r':
        onReview?.(); e.preventDefault(); break
      case 'j':
      case 'ArrowDown':
        onNext?.(); e.preventDefault(); break
      case 'k':
      case 'ArrowUp':
        onPrev?.(); e.preventDefault(); break
      case 'f':
        onToggleFlow?.(); e.preventDefault(); break
    }
  }, [enabled, onApprove, onReject, onReview, onNext, onPrev, onApproveAll, onToggleFlow])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Small floating help indicator showing "?" that reveals shortcuts on hover/click.
 */
export function ReviewerShortcutHelp() {
  const [show, setShow] = useState(false)

  return (
    <div
      style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 80 }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'rgba(192,197,206,0.12)', border: '1px solid rgba(192,197,206,0.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'help', fontSize: 14, fontWeight: 700, color: '#E8EAED',
      }}>
        ?
      </div>
      {show && (
        <div style={{
          position: 'absolute', bottom: 40, right: 0,
          background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '12px 16px', minWidth: 220,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#C0C5CE', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Atajos de teclado
          </div>
          {[
            ['A / Enter', 'Aprobar'],
            ['Espacio', 'Aprobar + siguiente'],
            ['X / Esc', 'Rechazar'],
            ['R', 'Revisar detalle'],
            ['J / K', 'Navegar'],
            ['Shift+A', 'Aprobar todo'],
            ['F', 'Modo flujo'],
          ].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="font-mono" style={{ fontSize: 11, color: '#C0C5CE', fontWeight: 600 }}>{key}</span>
              <span style={{ fontSize: 11, color: '#8B949E' }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
