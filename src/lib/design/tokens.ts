// CRUZ Design System — Canonical Design Tokens
// Single source of truth for colors, typography, spacing
// Usage: import { tokens } from '@/lib/design/tokens'

export const tokens = {
  color: {
    bg: '#FAFAF8',
    bgDark: '#0D0D0C',
    ink: '#0D0D0C',
    gold: '#C9A84C',
    teal: '#2C7A7B',
    slate: '#64748B',
    gray: '#94A3B8',
    plum: '#6B2C5C',
    amber: '#D97706',
    orange: '#EA580C',
    green: '#15803D',
    red: '#B91C1C',
  },
  font: {
    sans: 'Geist, system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  },
  touch: { min: 60 },
} as const
