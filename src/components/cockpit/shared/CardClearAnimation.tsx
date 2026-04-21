'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { playSound } from '@/lib/sounds'
import { haptic } from '@/hooks/use-haptic'

interface Props {
  show: boolean
  variant?: 'small' | 'medium' | 'large' | 'celebration'
  onComplete?: () => void
}

export function CardClearAnimation({ show, variant = 'small', onComplete }: Props) {
  const [visible, setVisible] = useState(false)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    if (!show) return
    setVisible(true)

    // Sound + haptic
    if (variant === 'celebration' || variant === 'large') {
      playSound('achievement')
      haptic.celebrate()
    } else {
      playSound('success')
      haptic.micro()
    }

    const duration = prefersReduced ? 100
      : variant === 'celebration' ? 1200
      : variant === 'large' ? 600
      : variant === 'medium' ? 400
      : 250

    const t = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, duration)
    return () => clearTimeout(t)
  }, [show, variant, onComplete, prefersReduced])

  if (!visible) return null

  if (prefersReduced) {
    return (
      <div style={{
        position: 'absolute', top: 8, right: 8,
        fontSize: 'var(--aguila-fs-body-lg)', color: 'var(--portal-status-green-fg)', zIndex: 30, pointerEvents: 'none',
      }}>
        ✓
      </div>
    )
  }

  const baseStyle: React.CSSProperties = {
    position: 'absolute', pointerEvents: 'none', zIndex: 30,
  }

  if (variant === 'celebration') {
    return (
      <div style={{ ...baseStyle, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 'var(--aguila-fs-kpi-hero)', animation: 'cruzBounce 600ms ease' }}>🎉</span>
      </div>
    )
  }

  if (variant === 'large') {
    return (
      <div style={{ ...baseStyle, inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 36, color: 'var(--portal-fg-1)', animation: 'cruzPing 600ms ease-out' }}>✓</span>
      </div>
    )
  }

  if (variant === 'medium') {
    return (
      <div style={{ ...baseStyle, top: 8, right: 8 }}>
        <span style={{ fontSize: 'var(--aguila-fs-title)', color: 'var(--portal-status-green-fg)', animation: 'cruzPulseSubtle 400ms ease' }}>✓</span>
      </div>
    )
  }

  return (
    <div style={{ ...baseStyle, top: 8, right: 8 }}>
      <span style={{ fontSize: 'var(--aguila-fs-body-lg)', color: 'var(--portal-status-green-fg)' }}>✓</span>
    </div>
  )
}

/** Determine animation variant based on how many cards cleared today */
export function getClearVariant(count: number): Props['variant'] {
  if (count > 0 && count % 25 === 0) return 'celebration'
  if (count > 0 && count % 10 === 0) return 'large'
  if (count > 0 && count % 5 === 0) return 'medium'
  return 'small'
}
