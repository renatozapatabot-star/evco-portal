import { GOLD, GOLD_HOVER } from '@/lib/design-system'

// ---- Types ----
export type VoiceState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING'

export interface ConversationEntry {
  id: string
  userText: string
  assistantText: string
}

// ---- Constants ----
export const STATUS_LABELS: Record<VoiceState, string> = {
  IDLE: 'Toca para hablar',
  LISTENING: 'Escuchando...',
  PROCESSING: 'Procesando...',
  SPEAKING: 'Hablando...',
}

export const COLORS = {
  bg: 'var(--bg-main)',
  gold: GOLD,
  goldDark: GOLD_HOVER,
  goldFaint: 'rgba(196,150,60,0.08)',
  white: 'var(--bg-card)',
  gray: 'var(--text-secondary)',
  grayLight: 'var(--text-muted)',
  grayDark: 'var(--text-primary)',
  red: 'var(--danger-500)',
  green: 'var(--success-500)',
}
