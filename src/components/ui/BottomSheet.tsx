'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

/**
 * Mobile bottom sheet — slides up from the bottom with drag-to-dismiss.
 * Apple-style with handle bar and spring animation.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY
    setDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) setDragY(delta) // Only allow dragging down
  }

  const handleTouchEnd = () => {
    setDragging(false)
    if (dragY > 120) {
      onClose()
    }
    setDragY(0)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 998,
          background: 'rgba(0,0,0,0.4)',
          opacity: Math.max(0, 1 - dragY / 300),
          transition: dragging ? 'none' : 'opacity 300ms ease',
          animation: 'fadeIn 200ms ease',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          zIndex: 999,
          maxHeight: '85vh',
          background: 'var(--bg-card, #FFFFFF)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
          transform: `translateY(${dragY}px)`,
          transition: dragging ? 'none' : 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          animation: 'sheetSlideUp 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Handle bar */}
        <div style={{
          display: 'flex', justifyContent: 'center', padding: '12px 0 8px',
          cursor: 'grab',
        }}>
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: 'var(--slate-300, #CBD5E1)',
          }} />
        </div>

        {/* Header */}
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px 12px',
            borderBottom: '1px solid var(--border, #E8E5E0)',
          }}>
            <span style={{ fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              style={{
                background: 'var(--slate-100)', border: 'none', borderRadius: '50%',
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-muted)',
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px 32px', WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes sheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  )
}
