export type PortalAccent = 'emerald' | 'teal' | 'lime'
export type PortalBg = 'void' | 'near' | 'blueprint'
export type PortalDensity = 'compact' | 'comfortable' | 'spacious'
export type PortalType = 'editorial' | 'grotesque' | 'mono-all'
export type PortalMotion = 'on' | 'off'

export type PortalTheme = {
  accent: PortalAccent
  bg: PortalBg
  density: PortalDensity
  type: PortalType
  motion: PortalMotion
}

export const PORTAL_THEME_DEFAULTS: PortalTheme = {
  accent: 'emerald',
  bg: 'void',
  density: 'comfortable',
  type: 'editorial',
  motion: 'on',
}

export const PORTAL_THEME_COOKIE = 'portal_theme'

const ACCENTS: readonly PortalAccent[] = ['emerald', 'teal', 'lime']
const BGS: readonly PortalBg[] = ['void', 'near', 'blueprint']
const DENSITIES: readonly PortalDensity[] = ['compact', 'comfortable', 'spacious']
const TYPES: readonly PortalType[] = ['editorial', 'grotesque', 'mono-all']
const MOTIONS: readonly PortalMotion[] = ['on', 'off']

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

export function parsePortalTheme(cookieValue: string | undefined | null): PortalTheme {
  if (!cookieValue) return PORTAL_THEME_DEFAULTS
  try {
    const raw = JSON.parse(decodeURIComponent(cookieValue)) as Record<string, unknown>
    return {
      accent: pick(raw.accent, ACCENTS, PORTAL_THEME_DEFAULTS.accent),
      bg: pick(raw.bg, BGS, PORTAL_THEME_DEFAULTS.bg),
      density: pick(raw.density, DENSITIES, PORTAL_THEME_DEFAULTS.density),
      type: pick(raw.type, TYPES, PORTAL_THEME_DEFAULTS.type),
      motion: pick(raw.motion, MOTIONS, PORTAL_THEME_DEFAULTS.motion),
    }
  } catch {
    return PORTAL_THEME_DEFAULTS
  }
}

export function serializePortalTheme(theme: PortalTheme): string {
  return encodeURIComponent(JSON.stringify(theme))
}
