'use client'

import type { Urgency } from '@/lib/card-urgency'
import { AduanaMark } from './CommandCenterAguilaMark'

interface AduanaAvatarProps {
  size: 48 | 36 | 32
  mood: Urgency | 'green'
  onClick?: () => void
  className?: string
}

const MOOD_GLOW: Record<string, string> = {
  green: '0 0 0 3px rgba(22,163,74,0.3), 0 0 12px rgba(22,163,74,0.15)',
  amber: '0 0 0 3px rgba(217,119,6,0.3), 0 0 12px rgba(217,119,6,0.15)',
  red: '0 0 0 3px rgba(220,38,38,0.3), 0 0 12px rgba(220,38,38,0.15)',
  neutral: '0 0 0 3px rgba(155,155,155,0.2), 0 0 8px rgba(155,155,155,0.1)',
}

export function AduanaAvatar({ size, mood, onClick, className }: AduanaAvatarProps) {
  const interactive = !!onClick

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={className}
      aria-label="Asistente CRUZ"
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #eab308, #8B6914)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: interactive ? 'pointer' : 'default',
        boxShadow: MOOD_GLOW[mood] || MOOD_GLOW.green,
        animation: 'cruzMoodPulse 2s ease-in-out infinite',
        transition: 'box-shadow 300ms ease',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <AduanaMark size={size} bare />
    </button>
  )
}
