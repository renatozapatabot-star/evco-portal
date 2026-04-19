// PORTAL Design System — Legacy Design Tokens (deprecated — prefer @/lib/design-system)
// Kept for back-compat with consumers that import from here. The canonical
// brand gold matches ZAPATA_GOLD_BASE (#C9A74A) in @/lib/design-system so a
// tokens.color.gold consumer and a GOLD_500 consumer render the same hex.
// New code should import ZAPATA_GOLD_* from @/lib/design-system or use
// var(--portal-gold-500) directly. @deprecated use @/lib/design-system

export const tokens = {
  color: {
    bg: '#FAFAF8',
    bgDark: '#0D0D0C',
    ink: '#0D0D0C',
    gold: '#C9A74A', // canonical — matches design-system.ts ZAPATA_GOLD_BASE
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
