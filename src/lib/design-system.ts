// design-system — AGUILA Monochrome Chrome tokens (April 2026 rebrand)
// Platform was CRUZ → ADUANA → AGUILA. Silver/chrome monochrome replaces
// cyan/gold. Slice A2b migrated the 73 deprecated-token consumers by
// aliasing the deprecated names to silver/chrome equivalents — consumers
// render silver without every file needing to be rewritten.
// This file is excluded from the gsd-verify color check by path name.

// ── AGUILA brand palette (April 2026 — primary tokens) ──
export const BG_DEEP = '#0A0A0C'
export const ACCENT_SILVER = '#C0C5CE'
export const ACCENT_SILVER_BRIGHT = '#E8EAED'
export const ACCENT_SILVER_DIM = '#7A7E86'
export const SILVER_GRADIENT = 'linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%)'
export const GLOW_SILVER = 'rgba(192,197,206,0.18)'
export const GLOW_SILVER_SUBTLE = 'rgba(192,197,206,0.08)'
export const TOPO_PATTERN_URL = '/brand/topo-hairline.svg'

// ── Semantic status (kept for semantic signals — NOT brand accent) ──
export const GREEN = '#22C55E'          // Success / live / healthy
export const AMBER = '#FBBF24'          // Warning / alerts
export const RED = '#EF4444'            // Danger / risk
export const Z_RED = '#CC1B2F'          // Brand mark only

// ── Deprecated tokens — aliased to silver/chrome for backward compat ──
// A2b migration: the 73 consumers still import these names; values now
// resolve to the silver palette so the visual swap is mechanical. Follow-up
// slice removes the aliases once imports are renamed.
/** @deprecated — use ACCENT_SILVER. */
export const ACCENT_CYAN = ACCENT_SILVER
/** @deprecated — use ACCENT_SILVER_DIM. */
export const ACCENT_BLUE = ACCENT_SILVER_DIM
/** @deprecated — use ACCENT_SILVER_BRIGHT. */
export const GOLD = ACCENT_SILVER_BRIGHT
/** @deprecated — use ACCENT_SILVER. */
export const GOLD_HOVER = ACCENT_SILVER
/** @deprecated — use SILVER_GRADIENT. */
export const GOLD_GRADIENT = SILVER_GRADIENT
/** @deprecated — use ACCENT_SILVER. */
export const GOLD_TEXT = ACCENT_SILVER
/** @deprecated — use GLOW_SILVER. */
export const GLOW_CYAN = GLOW_SILVER
/** @deprecated — use GLOW_SILVER_SUBTLE. */
export const GLOW_CYAN_SUBTLE = GLOW_SILVER_SUBTLE

// ── Glass backgrounds ──
export const BG_GRADIENT_START = '#030508'
export const BG_GRADIENT_END = '#0D1525'
export const BG_PRIMARY = '#05070B'
export const BG_CARD = 'rgba(255,255,255,0.04)'

/**
 * Unified cockpit canvas — radial silver wash at 50% 20% over deep linear.
 * Single source of truth: CockpitShell, /operador/inicio, /admin/eagle must
 * all render on this exact backdrop. Do not inline alternative gradients.
 */
export const COCKPIT_CANVAS =
  'radial-gradient(ellipse at 50% 20%, rgba(192,197,206,0.08) 0%, transparent 50%),' +
  ` linear-gradient(180deg, ${BG_GRADIENT_START} 0%, ${BG_GRADIENT_END} 100%)`
export const BG_ELEVATED = 'rgba(255,255,255,0.04)'
export const BG_SURFACE = 'rgba(255,255,255,0.03)'
export const BORDER = 'rgba(255,255,255,0.08)'

// ── Glass system ──
export const GLASS_BLUR = '20px'
export const GLASS_SHADOW = '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'

// ── Text ──
export const TEXT_PRIMARY = '#E6EDF3'
export const TEXT_SECONDARY = '#94a3b8'
export const TEXT_MUTED = '#64748b'

// ── AGUILA tokens (Block 2 · Unified Search, retained) ──
// TEXT_TERTIARY is a semantic alias of TEXT_SECONDARY.
export const AGUILA_BG_ELEVATED = '#1c1c22'
export const BORDER_HAIRLINE = 'rgba(255,255,255,0.06)'
export const TEXT_TERTIARY = '#94a3b8'
