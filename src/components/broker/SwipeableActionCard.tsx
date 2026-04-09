'use client'

import { useCallback, useState } from 'react'
import { motion, useTransform, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { useSwipeAction } from '@/hooks/use-swipe-action'
import { haptic } from '@/hooks/use-haptic'

export interface ActionItem {
  id: string
  type: 'urgent' | 'draft' | 'today' | 'new' | 'bridge'
  icon: string
  label: string
  detail: string
  href: string
}

const TYPE_BORDER: Record<string, string> = {
  urgent: 'var(--danger-500)',
  draft: 'var(--warning)',
  today: 'var(--gold)',
  new: 'var(--gold)',
  bridge: 'var(--slate-400)',
}

interface SwipeableActionCardProps {
  item: ActionItem
  onResolve: (id: string) => void
}

export function SwipeableActionCard({ item, onResolve }: SwipeableActionCardProps) {
  const prefersReduced = useReducedMotion()
  const [showHoverBtn, setShowHoverBtn] = useState(false)

  const handleConfirm = useCallback(() => {
    onResolve(item.id)
  }, [item.id, onResolve])

  const { dragProps, offsetX, progress, isDragging, isReady } = useSwipeAction({
    threshold: 120,
    onConfirm: handleConfirm,
  })

  // Reveal strip opacity based on swipe progress
  const revealOpacity = useTransform(progress, [0, 0.3, 1], [0, 0.5, 1])
  const revealScale = useTransform(progress, [0, 1], [0.8, 1])
  const checkOpacity = useTransform(progress, [0.5, 1], [0, 1])

  const borderColor = TYPE_BORDER[item.type] || 'var(--slate-400)'

  return (
    <motion.div
      layout={!prefersReduced}
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReduced
        ? { opacity: 0 }
        : { opacity: 0, x: 300, scale: 0.9, transition: { duration: 0.3 } }
      }
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}
    >
      {/* Green reveal strip behind the card */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(22,163,74,0.15) 0%, rgba(22,163,74,0.3) 100%)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 24,
          gap: 10,
          opacity: revealOpacity,
          scale: revealScale,
          pointerEvents: 'none',
        }}
        aria-hidden
      >
        <motion.div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'rgba(22,163,74,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: checkOpacity,
          }}
        >
          <Check size={18} color="#FFFFFF" strokeWidth={3} />
        </motion.div>
        <motion.span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--success, #16A34A)',
            opacity: checkOpacity,
          }}
        >
          Resuelto
        </motion.span>
      </motion.div>

      {/* Draggable card */}
      <motion.div
        {...dragProps}
        className="broker-action-item"
        style={{
          ...dragProps.style,
          borderLeftColor: borderColor,
          cursor: isDragging ? 'grabbing' : 'grab',
          position: 'relative',
          zIndex: 1,
          touchAction: 'pan-y',
          background: isReady
            ? 'rgba(22, 163, 74, 0.08)'
            : 'var(--glass-bg)',
        }}
        onMouseEnter={() => setShowHoverBtn(true)}
        onMouseLeave={() => setShowHoverBtn(false)}
        onTapStart={() => haptic.micro()}
      >
        <span className="broker-action-icon">{item.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="broker-action-label">{item.label}</div>
          <div className="broker-action-detail">{item.detail}</div>
        </div>

        {/* Desktop: hover resolve button */}
        {showHoverBtn && !isDragging && (
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              haptic.confirm()
              onResolve(item.id)
            }}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--success, #16A34A)',
              background: 'rgba(22,163,74,0.1)',
              border: '1px solid rgba(22,163,74,0.3)',
              borderRadius: 20,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              minHeight: 32,
              transition: 'background 150ms ease',
            }}
            aria-label="Marcar como resuelto"
          >
            Resolver
          </button>
        )}

        {/* Navigate arrow (hidden during drag) */}
        {!isDragging && !showHoverBtn && (
          <Link
            href={item.href}
            className="broker-action-arrow"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Ver ${item.label}`}
          >
            →
          </Link>
        )}
      </motion.div>
    </motion.div>
  )
}
