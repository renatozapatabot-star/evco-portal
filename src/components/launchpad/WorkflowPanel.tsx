'use client'

import { BottomSheet } from '@/components/ui/BottomSheet'
import { useIsMobile } from '@/hooks/use-mobile'

interface WorkflowPanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function WorkflowPanel({ open, onClose, title, children }: WorkflowPanelProps) {
  const isMobile = useIsMobile()

  if (!open) return null

  if (isMobile) {
    return (
      <BottomSheet open={open} onClose={onClose} title={title}>
        {children}
      </BottomSheet>
    )
  }

  // Desktop: inline card with slide-down animation
  return (
    <div
      className="card"
      style={{
        marginTop: 8,
        overflow: 'hidden',
        animation: 'panelSlideDown 250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        border: '2px solid #C9A84C',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A' }}>
          {title}
        </span>
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            background: '#F5F4F0',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 16,
            color: '#6B6B6B',
          }}
        >
          &#10005;
        </button>
      </div>
      {children}
      <style>{`
        @keyframes panelSlideDown {
          from { opacity: 0; max-height: 0; transform: translateY(-8px); }
          to { opacity: 1; max-height: 800px; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
