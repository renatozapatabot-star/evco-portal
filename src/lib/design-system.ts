// design-system — AGUILA Monochrome Chrome tokens (April 2026 rebrand)
// Platform was CRUZ → ADUANA → AGUILA. Silver/chrome monochrome replaces
// cyan/gold. Deprecated tokens retained until A2 migrates the 73 consumers.
// This file is excluded from the gsd-verify color check by path name.

// ── Semantic lighting ──
/** @deprecated — use ACCENT_SILVER. Retained for A2 migration. */
export const ACCENT_CYAN = '#00E5FF'    // System intelligence / active
/** @deprecated — use ACCENT_SILVER. Retained for A2 migration. */
export const ACCENT_BLUE = '#3B82F6'    // Secondary blue
/** @deprecated — use ACCENT_SILVER_BRIGHT. Retained for A2 migration. */
export const GOLD = '#eab308'           // Actions / financial / CTAs
/** @deprecated — use ACCENT_SILVER_BRIGHT. Retained for A2 migration. */
export const GOLD_HOVER = '#ca8a04'
/** @deprecated — use SILVER_GRADIENT. Retained for A2 migration. */
export const GOLD_GRADIENT = 'linear-gradient(135deg, #eab308, #a16207)'
/** @deprecated — use ACCENT_SILVER. Retained for A2 migration. */
export const GOLD_TEXT = '#a16207'

export const GREEN = '#22C55E'          // Success / live
export const AMBER = '#FBBF24'          // Warning / alerts
export const RED = '#EF4444'            // Danger / risk
export const Z_RED = '#CC1B2F'          // Brand mark only

// ── Glass backgrounds ──
export const BG_GRADIENT_START = '#05070B'
export const BG_GRADIENT_END = '#0B1220'
export const BG_PRIMARY = '#05070B'
export const BG_CARD = 'rgba(255,255,255,0.04)'
export const BG_ELEVATED = 'rgba(255,255,255,0.04)'
export const BG_SURFACE = 'rgba(255,255,255,0.03)'
export const BORDER = 'rgba(255,255,255,0.08)'

// ── Glass system ──
export const GLASS_BLUR = '20px'
export const GLASS_SHADOW = '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
/** @deprecated — use GLOW_SILVER. Retained for A2 migration. */
export const GLOW_CYAN = 'rgba(0,229,255,0.25)'
/** @deprecated — use GLOW_SILVER_SUBTLE. Retained for A2 migration. */
export const GLOW_CYAN_SUBTLE = 'rgba(0,229,255,0.1)'

// ── Text ──
export const TEXT_PRIMARY = '#E6EDF3'
export const TEXT_SECONDARY = '#94a3b8'
export const TEXT_MUTED = '#64748b'

// ── AGUILA tokens (Block 2 · Unified Search) ──
// Scoped to the search surface (palette + advanced modal). Do not repurpose
// elsewhere without design review. TEXT_TERTIARY is a semantic alias of
// TEXT_SECONDARY — naming distinction helps search UI readability.
export const AGUILA_BG_ELEVATED = '#1c1c22'
export const BORDER_HAIRLINE = 'rgba(255,255,255,0.06)'
export const ACCENT_SILVER = '#C0C5CE'
export const TEXT_TERTIARY = '#94a3b8'

// ── AGUILA brand palette (April 2026) ──
// Monochrome chrome identity. Replaces cyan/gold.
// Deprecated tokens above retain original hex until A2 migrates consumers.
export const BG_DEEP = '#0A0A0C'
export const ACCENT_SILVER_BRIGHT = '#E8EAED'
export const ACCENT_SILVER_DIM = '#7A7E86'
export const SILVER_GRADIENT = 'linear-gradient(135deg, #E8EAED 0%, #C0C5CE 50%, #7A7E86 100%)'
export const GLOW_SILVER = 'rgba(192,197,206,0.18)'
export const GLOW_SILVER_SUBTLE = 'rgba(192,197,206,0.08)'
export const TOPO_PATTERN_URL = '/brand/topo-hairline.svg'
