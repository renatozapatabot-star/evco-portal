// design-system — ZAPATA AI dual-accent tokens (April 2026 rebrand)
// Platform lineage: CRUZ → ADUANA → ZAPATA AI → ZAPATA. Silver remains the
// chrome for data/information surfaces. Gold returns as the identity accent
// for brand moments (mark, wordmark, primary CTAs, active nav indicator).
// Gold for identity · silver for data. Never decorative color beyond these.
// This file is excluded from the gsd-verify color check by path name.

// ── ZAPATA AI brand palette (April 2026 — primary tokens) ──
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

// ── ZAPATA AI gold palette (April 2026 rebrand — identity surfaces) ──
// Gold returns for brand moments only: mark, wordmark, primary CTAs,
// active nav indicator. Silver still owns data/chrome (KPIs, borders, text).
export const ZAPATA_GOLD_BASE = '#C9A74A'
export const ZAPATA_GOLD_BRIGHT = '#F4D47A'
export const ZAPATA_GOLD_DIM = '#8F7628'
export const ZAPATA_GOLD_GRADIENT =
  'linear-gradient(135deg, #F4D47A 0%, #C9A74A 50%, #8F7628 100%)'
export const ZAPATA_GOLD_GLOW = 'rgba(201,167,74,0.28)'
export const ZAPATA_GOLD_GLOW_SUBTLE = 'rgba(201,167,74,0.12)'

// ── GOLD tokens — restored to real gold for ZAPATA AI brand surfaces ──
// Prior (be416fc) aliased GOLD → silver when the brand went monochrome.
// ZAPATA AI rebrand restores gold for identity moments; consumers importing
// GOLD* now render gold again — exactly what most of them historically meant.
export const GOLD = ZAPATA_GOLD_BRIGHT
export const GOLD_HOVER = ZAPATA_GOLD_BASE
export const GOLD_GRADIENT = ZAPATA_GOLD_GRADIENT
export const GOLD_TEXT = ZAPATA_GOLD_BRIGHT
export const GLOW_GOLD = ZAPATA_GOLD_GLOW
export const GLOW_GOLD_SUBTLE = ZAPATA_GOLD_GLOW_SUBTLE

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

// ── V1 Glass tiers (April 2026) ──
// Login is the visual North Star. Cockpit glass now matches login's weightier
// chemistry: opaque-black bg with a visible silver border and a silver halo
// shadow. Three tiers let the composition breathe without sacrificing depth.
//   · hero       — rgba(0,0,0,0.4)   — KPI tiles, primary nav cards, asistente
//   · secondary  — rgba(0,0,0,0.25)  — section cards, info panels
//   · tertiary   — rgba(0,0,0,0.12)  — chips, inline containers, drawer interiors
export const GLASS_HERO = 'rgba(0,0,0,0.4)'
export const GLASS_SECONDARY = 'rgba(0,0,0,0.25)'
export const GLASS_TERTIARY = 'rgba(0,0,0,0.12)'

export const BORDER_SILVER = 'rgba(192,197,206,0.18)'
export const BORDER_SILVER_HOVER = 'rgba(192,197,206,0.4)'

/** Login-parity shadow: weighty drop + silver halo accent */
export const SHADOW_HERO =
  '0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(192,197,206,0.08)'
/** Hover lift: brighter halo, deeper drop */
export const SHADOW_HERO_HOVER =
  '0 14px 40px rgba(0,0,0,0.7), 0 0 28px rgba(192,197,206,0.14)'

// ── Atmospheric layers (mirror login's topo + halo + aura) ──
export const ATMOSPHERE_HALO =
  'radial-gradient(circle, rgba(192,197,206,0.10) 0%, transparent 70%)'
export const ATMOSPHERE_AURA =
  'radial-gradient(circle, rgba(192,197,206,0.08) 0%, transparent 65%)'

// ── Typography tracking (match login's severity) ──
export const LS_TAGLINE = '0.3em'       // one-word ceremonial captions
export const LS_DRAMATIC = '0.15em'     // section labels, CÓDIGO DE ACCESO scale
export const LS_FOOTER = '0.12em'       // identity footer monospace

// ── Text ──
export const TEXT_PRIMARY = '#E6EDF3'
export const TEXT_SECONDARY = '#94a3b8'
export const TEXT_MUTED = '#64748b'

// ── ZAPATA AI tokens (Block 2 · Unified Search, retained) ──
// TEXT_TERTIARY is a semantic alias of TEXT_SECONDARY.
export const ZAPATA_BG_ELEVATED = '#1c1c22'
export const BORDER_HAIRLINE = 'rgba(255,255,255,0.06)'
export const TEXT_TERTIARY = '#94a3b8'
