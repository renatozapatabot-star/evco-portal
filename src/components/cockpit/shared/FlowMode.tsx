'use client'

import { useState, useCallback } from 'react'
import { AduanaRecommendation } from './CruzRecommendation'
import { useReviewerShortcuts } from '@/hooks/use-reviewer-shortcuts'
import { playSound } from '@/lib/sounds'
import { haptic } from '@/hooks/use-haptic'

interface FlowItem {
  id: string
  label: string
  recommendation: string
  confidence: number
  reasoning?: string[]
  approveHref?: string
  onApprove?: () => Promise<void>
}

interface Props {
  items: FlowItem[]
  onClose: () => void
  operatorName: string
}

/**
 * Full-screen flow mode for power reviewers.
 * One proposal at a time. Space to approve + advance.
 * "12 de 47" counter. Variable reward sounds.
 * Exit with Escape or the X button.
 */
export function FlowMode({ items, onClose, operatorName }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [approved, setApproved] = useState(new Set<number>())
  const [completed, setCompleted] = useState(false)

  const current = items[currentIndex]

  const handleApprove = useCallback(async () => {
    if (!current) return
    try {
      await current.onApprove?.()
      const count = approved.size + 1
      // Variable reward
      if (count % 10 === 0) { playSound('achievement'); haptic.celebrate() }
      else if (count % 5 === 0) { playSound('success'); haptic.notify() }
      else { playSound('send'); haptic.micro() }

      setApproved(prev => new Set(prev).add(currentIndex))

      // Advance
      if (currentIndex < items.length - 1) {
        setTimeout(() => setCurrentIndex(i => i + 1), 300)
      } else {
        setCompleted(true)
      }
    } catch { /* ignore */ }
  }, [current, currentIndex, items.length, approved.size])

  const handleNext = useCallback(() => {
    if (currentIndex < items.length - 1) setCurrentIndex(i => i + 1)
  }, [currentIndex, items.length])

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1)
  }, [currentIndex])

  useReviewerShortcuts({
    onApprove: handleApprove,
    onNext: handleNext,
    onPrev: handlePrev,
    onReject: onClose,
    enabled: !completed,
  })

  if (completed) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 300, background: 'var(--portal-ink-0)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{ fontSize: 'var(--aguila-fs-kpi-hero)', marginBottom: 16 }}>🦀</div>
        <div style={{ fontSize: 'var(--aguila-fs-title)', fontWeight: 700, color: 'var(--portal-fg-1)', marginBottom: 8 }}>
          ¡{approved.size} aprobaciones completadas!
        </div>
        <div style={{ fontSize: 'var(--aguila-fs-section)', color: 'var(--portal-fg-4)', marginBottom: 24 }}>
          Buen trabajo, {operatorName.split(' ')[0]}. Cola despejada.
        </div>
        <button onClick={onClose} style={{
          padding: '14px 32px', borderRadius: 10,
          background: 'var(--portal-fg-1)', color: '#111', fontSize: 'var(--aguila-fs-body-lg)', fontWeight: 700,
          border: 'none', cursor: 'pointer', minHeight: 60,
        }}>
          Volver al cockpit →
        </button>
      </div>
    )
  }

  if (!current) {
    onClose()
    return null
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'var(--portal-ink-0)',
      display: 'flex', flexDirection: 'column',
      padding: '24px 24px 100px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24,
      }}>
        <div>
          <span style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--portal-fg-1)' }}>
            Modo flujo
          </span>
          <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-4)', marginLeft: 12 }}>
            {currentIndex + 1} de {items.length}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--portal-fg-4)', borderRadius: 6, padding: '6px 14px',
          fontSize: 'var(--aguila-fs-compact)', cursor: 'pointer', minHeight: 36,
        }}>
          Salir (Esc)
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{
          width: `${((currentIndex + 1) / items.length) * 100}%`,
          height: '100%', background: 'var(--portal-fg-1)', borderRadius: 2,
          transition: 'width 300ms ease',
        }} />
      </div>

      {/* Current proposal — centered */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 500, width: '100%' }}>
          <div style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--portal-fg-5)', marginBottom: 8 }}>
            {current.label}
          </div>
          <AduanaRecommendation
            recommendation={current.recommendation}
            confidence={current.confidence}
            approveLabel="Aprobar"
            onApprove={handleApprove}
            reasoning={current.reasoning}
          />
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-5)' }}>
            Espacio para aprobar · J/K para navegar · Esc para salir
          </div>
        </div>
      </div>

      {/* Approved counter */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(255,255,255,0.045)', borderRadius: 10, padding: '10px 20px',
        border: '1px solid rgba(192,197,206,0.2)',
      }}>
        <span className="font-mono" style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 800, color: 'var(--portal-fg-1)' }}>
          {approved.size}
        </span>
        <span style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--portal-fg-4)', marginLeft: 8 }}>
          aprobada{approved.size !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
