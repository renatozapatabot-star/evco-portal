// CRUZ PORTAL — DESIGN SYSTEM TOKENS v4.0
// All UI must reference these. No hardcoded colors.

export const colors = {
  gold: { primary: '#D4A843', muted: '#A8893A', dim: '#6B5A2E' },
  bg: { primary: '#0D0D0D', card: '#1A1A1A', elevated: '#242424' },
  status: { green: '#22C55E', yellow: '#EAB308', red: '#EF4444', blue: '#3B82F6' },
  text: { white: '#FFFFFF', primary: '#E5E7EB', secondary: '#9CA3AF', muted: '#6B7280', dim: '#4B5563' },
  border: { default: '#2A2A2A', subtle: '#1F1F1F', gold: '#6B5A2E' },
} as const

export const type = {
  pageTitle: { size: 32, weight: 600, color: colors.text.white },
  sectionHeader: { size: 22, weight: 500, color: colors.gold.primary },
  body: { size: 16, weight: 400, color: colors.text.primary },
  meta: { size: 14, weight: 400, color: colors.text.secondary },
  caption: { size: 12, weight: 400, color: colors.text.muted },
} as const

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const
export const radius = 8

// CSS variable mapping for globals.css
export const cssVars = {
  '--gold-primary': colors.gold.primary,
  '--gold-muted': colors.gold.muted,
  '--gold-dim': colors.gold.dim,
  '--bg-primary': colors.bg.primary,
  '--bg-card': colors.bg.card,
  '--bg-elevated': colors.bg.elevated,
  '--status-green': colors.status.green,
  '--status-yellow': colors.status.yellow,
  '--status-red': colors.status.red,
  '--status-blue': colors.status.blue,
  '--border-default': colors.border.default,
  '--border-subtle': colors.border.subtle,
  '--border-gold': colors.border.gold,
} as const
