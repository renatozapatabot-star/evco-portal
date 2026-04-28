/**
 * PORTAL · Admin feature-flag catalog + runtime override helpers.
 *
 * Production truth for every flag lives in a Vercel env var (the entries
 * under `envVar` below). Those are build-time values, so flipping them
 * needs a redeploy — the /admin/feature-flags page shows a copy-to-clip
 * `vercel env` command for each one.
 *
 * For walkthroughs (Tito previewing Ursula's surface, Renato IV
 * smoke-testing a gate) the admin page sets a short-lived *override*
 * cookie that internal roles (admin/broker/owner/operator/contabilidad)
 * honor on top of the env var. The cookie is per-browser, so a client
 * session never picks it up — cross-tenant exposure is impossible by
 * design.
 *
 * Gates read both layers via `resolveFlagState()`:
 *   effective = envEnabled || (session is internal && override === true)
 *
 * Bypass paths that already exist (e.g. internal roles skip the
 * /mi-cuenta/cruz client gate regardless of flag) are unchanged.
 */
import type { PortalRole } from '@/lib/session'

export interface FeatureFlagDefinition {
  /** Stable key used in URLs, cookies, and the admin UI. */
  key: string
  /** Environment variable that is the production source of truth. */
  envVar: string
  /** Short title in the admin UI (Spanish — matches PORTAL voice). */
  title: string
  /** One-line description, what flipping ON actually does. */
  description: string
  /** Which surface the flag gates. Helps admins find it. */
  surface: '/mi-cuenta' | '/mi-cuenta/cruz' | '/mensajeria' | 'global'
  /** Vercel env scope hint for the copy-to-clip command. */
  vercelEnvScope: 'production' | 'preview' | 'development'
}

/**
 * The source of truth for every flag the admin surface knows about.
 * Adding a new flag? Add it here AND wire a gate to call
 * `resolveFlagState({ key, …})` — the page auto-picks it up.
 */
export const FEATURE_FLAGS: readonly FeatureFlagDefinition[] = [
  {
    key: 'mi_cuenta_enabled',
    envVar: 'NEXT_PUBLIC_MI_CUENTA_ENABLED',
    title: '/mi-cuenta — superficie de cuenta',
    description:
      'Habilita que el rol cliente vea /mi-cuenta. Roles internos siempre ven la superficie para QA.',
    surface: '/mi-cuenta',
    vercelEnvScope: 'production',
  },
  {
    key: 'mi_cuenta_cruz_enabled',
    envVar: 'NEXT_PUBLIC_MI_CUENTA_CRUZ_ENABLED',
    title: '/mi-cuenta/cruz — asistente del cliente',
    description:
      'Habilita el asistente calmo para el rol cliente. El chat corre en modo mi-cuenta-safe con herramientas de solo lectura.',
    surface: '/mi-cuenta/cruz',
    vercelEnvScope: 'production',
  },
  {
    key: 'mensajeria_client_enabled',
    envVar: 'NEXT_PUBLIC_MENSAJERIA_CLIENT',
    title: 'Mensajería — acceso cliente',
    description:
      'Habilita el feed de Mensajería en /inicio para clientes. Se activa después del periodo interno de 2 semanas con operadores.',
    surface: '/mensajeria',
    vercelEnvScope: 'production',
  },
] as const

const FEATURE_FLAG_KEYS: ReadonlySet<string> = new Set(FEATURE_FLAGS.map(f => f.key))

/** Cookie that stores admin override state. JSON map of flagKey → '1' | '0'. */
export const FEATURE_FLAG_OVERRIDE_COOKIE = 'portal_ff_overrides'

/** 30 days — long enough for a demo cycle, short enough to expire naturally. */
export const FEATURE_FLAG_OVERRIDE_TTL_SECONDS = 60 * 60 * 24 * 30

/** Roles that can (a) set overrides and (b) have their session honor them. */
const INTERNAL_ROLES = new Set<PortalRole>([
  'admin',
  'broker',
  'operator',
  'contabilidad',
])

export function isInternalRole(role: PortalRole | undefined | null): boolean {
  return !!role && INTERNAL_ROLES.has(role)
}

export function isKnownFlagKey(key: string): boolean {
  return FEATURE_FLAG_KEYS.has(key)
}

export function getFlagDefinition(key: string): FeatureFlagDefinition | null {
  return FEATURE_FLAGS.find(f => f.key === key) ?? null
}

/**
 * Read the env-var value for a flag. Accepts only the literal string
 * 'true' (case-insensitive, trimmed) so typos in Vercel don't turn on
 * a gate accidentally.
 */
export function readFlagEnvValue(def: FeatureFlagDefinition): boolean {
  const raw = process.env[def.envVar]
  if (!raw) return false
  return raw.trim().toLowerCase() === 'true'
}

/**
 * Parse the override cookie. Silent on any malformed payload — a
 * busted cookie falls back to "no overrides set" rather than
 * throwing into an admin gate.
 */
export function parseOverrideCookie(raw: string | undefined | null): Record<string, boolean> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, boolean> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!FEATURE_FLAG_KEYS.has(k)) continue
      if (v === true || v === '1' || v === 'true') out[k] = true
      else if (v === false || v === '0' || v === 'false') out[k] = false
    }
    return out
  } catch {
    return {}
  }
}

export function serializeOverrideCookie(overrides: Record<string, boolean>): string {
  const filtered: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(overrides)) {
    if (FEATURE_FLAG_KEYS.has(k)) filtered[k] = !!v
  }
  return JSON.stringify(filtered)
}

export interface FlagState {
  key: string
  envVar: string
  envEnabled: boolean
  overrideEnabled: boolean | null
  overrideApplies: boolean
  effectiveEnabled: boolean
  source: 'env' | 'override' | 'default'
}

/**
 * Resolve the effective state of a flag given env + overrides + role.
 *
 * Rules:
 *   - env=true ⇒ effective=true (prod truth wins)
 *   - env=false + internal role + override=true ⇒ effective=true
 *     (admin/broker preview)
 *   - override=false for an internal role never disables a flag env=true
 *     (prod truth wins both ways — overrides can only grant preview
 *     access the admin wouldn't otherwise have)
 *   - non-internal role ⇒ override ignored (client never gets preview)
 */
export function resolveFlagState(args: {
  def: FeatureFlagDefinition
  overrides: Record<string, boolean>
  role: PortalRole | undefined | null
}): FlagState {
  const { def, overrides, role } = args
  const envEnabled = readFlagEnvValue(def)
  const overrideEnabled = def.key in overrides ? overrides[def.key] : null
  const overrideApplies =
    overrideEnabled === true && !envEnabled && isInternalRole(role)
  const effectiveEnabled = envEnabled || overrideApplies
  let source: FlagState['source'] = 'default'
  if (envEnabled) source = 'env'
  else if (overrideApplies) source = 'override'
  return {
    key: def.key,
    envVar: def.envVar,
    envEnabled,
    overrideEnabled,
    overrideApplies,
    effectiveEnabled,
    source,
  }
}

/**
 * Convenience wrapper when a caller only needs the effective boolean.
 * Used by gates that don't care about the breakdown.
 */
export function isFlagEffective(args: {
  key: string
  overrides: Record<string, boolean>
  role: PortalRole | undefined | null
}): boolean {
  const def = getFlagDefinition(args.key)
  if (!def) return false
  return resolveFlagState({ def, overrides: args.overrides, role: args.role }).effectiveEnabled
}
