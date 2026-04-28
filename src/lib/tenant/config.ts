/**
 * Tenant config — the V2 white-label foundation.
 *
 * Why:
 *   EVCO is tenant #1. MAFESA is next. The goal is a codebase where
 *   onboarding a new tenant is ~5 lines of config + a row in
 *   `companies`, not a cascade of `if (session.companyId === 'evco')`
 *   branches scattered through 30 files.
 *
 *   This module is that single source of truth. Every surface that
 *   needs tenant-specific branding, language, feature flags, or
 *   business metadata reads from `readTenantConfig(supabase, companyId)`
 *   instead of hardcoding.
 *
 * What's in `companies` today:
 *   company_id · name · clave_cliente · rfc · patente · aduana ·
 *   language · active · contact_* · globalpc_clave · portal_url ·
 *   tmec_eligible · immex · traficos_count · health_score · ...
 *
 * What V2 will add (migration to land separately):
 *   branding jsonb  — { logo_url, theme, accent, wordmark_override }
 *   features jsonb  — { mensajeria: true, cruz_ai: true, mi_cuenta: true }
 *
 * Until those columns land, this module returns safe defaults. The
 * shape is forward-compatible — consumers don't change when the
 * migration lands.
 *
 * Caller contract:
 *   - Always scope by `company_id` (the session tenant key)
 *   - Return value is always defined, never null — missing rows
 *     fall back to safe tenant defaults so no cockpit crashes on
 *     a pre-activation tenant
 *   - Cheap to call — single-row lookup, cacheable at the route
 *     handler level when needed
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────

export type PortalLanguage = 'es' | 'en'

export interface TenantBranding {
  /** Display name used in cockpit headers + emails. Falls back to
   * companies.name when missing. */
  wordmark: string | null
  /** Optional logo URL for login + topbar + emails. Not yet wired. */
  logo_url: string | null
  /** Optional accent color override (token reference, e.g., '--portal-gold-500').
   * Never a raw hex — always a CSS var name so design-system tokens
   * stay the source of truth. */
  accent_token: string | null
}

export interface TenantFeatures {
  /** Client-facing Mensajería surface. Default off — operator-only
   * until rollout per CLAUDE.md. */
  mensajeria_client: boolean
  /** CRUZ AI client access. Default on (admin/broker sees it; client
   * sees a feature-gated variant). */
  cruz_ai: boolean
  /** Client A/R at /mi-cuenta. Default off pre-Tito walkthrough
   * (per founder-overrides.md). */
  mi_cuenta: boolean
  /** White-label dashboard surfaces. Default off — Grok ships V2
   * features behind this flag. */
  white_label_surfaces: boolean
}

export interface TenantConfig {
  company_id: string
  name: string
  /** 4-digit GlobalPC clave · foundational for MySQL joins. Null
   * until the tenant is wired to GlobalPC. */
  clave_cliente: string | null
  rfc: string | null
  patente: string | null
  aduana: string | null
  language: PortalLanguage
  /** Is this tenant actively operating? Sync crons may skip
   * inactive tenants. */
  active: boolean
  branding: TenantBranding
  features: TenantFeatures
  /** When the tenant row was created. Null if unknown. */
  created_at: string | null
}

// ── Defaults ───────────────────────────────────────────────────────

export const DEFAULT_BRANDING: TenantBranding = {
  wordmark: null, // falls back to companies.name in UI
  logo_url: null,
  accent_token: null, // falls back to --portal-gold-500 at render time
}

export const DEFAULT_FEATURES: TenantFeatures = {
  mensajeria_client: false,
  cruz_ai: true,
  mi_cuenta: false,
  white_label_surfaces: false,
}

/**
 * Safe stand-in when the companies row is missing entirely. A tenant
 * should never actually hit this in production — it exists so a
 * misconfigured cockpit renders fallbacks instead of crashing.
 */
export function stubTenantConfig(companyId: string): TenantConfig {
  return {
    company_id: companyId,
    name: companyId,
    clave_cliente: null,
    rfc: null,
    patente: null,
    aduana: null,
    language: 'es',
    active: false,
    branding: DEFAULT_BRANDING,
    features: DEFAULT_FEATURES,
    created_at: null,
  }
}

// ── Parser ─────────────────────────────────────────────────────────

interface CompanyRow {
  company_id: string
  name: string
  clave_cliente: string | null
  rfc: string | null
  patente: string | null
  aduana: string | null
  language: string | null
  active: boolean | null
  created_at: string | null
  // Future cols — not yet in the migration but parsed when present
  branding?: unknown
  features?: unknown
}

function parseLanguage(value: unknown): PortalLanguage {
  return value === 'en' ? 'en' : 'es'
}

function parseBranding(raw: unknown): TenantBranding {
  if (!raw || typeof raw !== 'object') return DEFAULT_BRANDING
  const b = raw as Record<string, unknown>
  return {
    wordmark: typeof b.wordmark === 'string' ? b.wordmark : null,
    logo_url: typeof b.logo_url === 'string' ? b.logo_url : null,
    accent_token:
      typeof b.accent_token === 'string' && b.accent_token.startsWith('--portal-')
        ? b.accent_token
        : null,
  }
}

function parseFeatures(raw: unknown, envMiCuenta: string | undefined): TenantFeatures {
  const base: TenantFeatures = {
    ...DEFAULT_FEATURES,
    // Honor the existing Vercel env var as the MI_CUENTA feature flag
    // gate until the companies.features column lands. Keeps the
    // founder-override contract intact.
    mi_cuenta: envMiCuenta?.toLowerCase() === 'true',
  }
  if (!raw || typeof raw !== 'object') return base
  const f = raw as Record<string, unknown>
  return {
    mensajeria_client:
      typeof f.mensajeria_client === 'boolean'
        ? f.mensajeria_client
        : base.mensajeria_client,
    cruz_ai: typeof f.cruz_ai === 'boolean' ? f.cruz_ai : base.cruz_ai,
    mi_cuenta: typeof f.mi_cuenta === 'boolean' ? f.mi_cuenta : base.mi_cuenta,
    white_label_surfaces:
      typeof f.white_label_surfaces === 'boolean'
        ? f.white_label_surfaces
        : base.white_label_surfaces,
  }
}

/**
 * Pure parser — exported so tests can exercise the default-merge
 * logic without a Supabase fixture.
 */
export function parseTenantConfig(
  row: CompanyRow | null,
  companyId: string,
  envMiCuenta?: string,
): TenantConfig {
  if (!row) return stubTenantConfig(companyId)
  return {
    company_id: row.company_id,
    name: row.name,
    clave_cliente: row.clave_cliente,
    rfc: row.rfc,
    patente: row.patente,
    aduana: row.aduana,
    language: parseLanguage(row.language),
    active: row.active === true,
    branding: parseBranding(row.branding),
    features: parseFeatures(row.features, envMiCuenta),
    created_at: row.created_at,
  }
}

// ── DB-facing entry point ──────────────────────────────────────────

/**
 * Load the tenant config for `companyId`. Never throws; returns a
 * stub when the row is missing so cockpits degrade gracefully.
 */
export async function readTenantConfig(
  supabase: SupabaseClient,
  companyId: string,
): Promise<TenantConfig> {
  if (!companyId) return stubTenantConfig('unknown')
  try {
    const { data } = await supabase
      .from('companies')
      .select(
        'company_id, name, clave_cliente, rfc, patente, aduana, language, active, created_at',
      )
      .eq('company_id', companyId)
      .maybeSingle<CompanyRow>()
    return parseTenantConfig(data, companyId, process.env.NEXT_PUBLIC_MI_CUENTA_ENABLED)
  } catch {
    return stubTenantConfig(companyId)
  }
}

// ── Utility for feature-flag checks at render time ─────────────────

/**
 * Convenience for UI code that just needs "is feature X on for this tenant?"
 * without plumbing the full TenantConfig through props. Call at the
 * server-component level; the config is cheap enough to re-read per
 * request.
 */
export async function hasFeature(
  supabase: SupabaseClient,
  companyId: string,
  feature: keyof TenantFeatures,
): Promise<boolean> {
  const config = await readTenantConfig(supabase, companyId)
  return Boolean(config.features[feature])
}
