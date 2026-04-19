// src/lib/client-config.ts
// Client configuration — multi-tenant aware.
//
// All client identity is resolved at runtime from cookies set at login
// by auth/route.ts. The cookies are: company_id, company_clave, company_name.
//
// Client-side: use getCookieValue() or the typed helpers below.
// Server-side (API routes): use request.cookies or the async helpers.

import type { SupabaseClient } from '@supabase/supabase-js'

// --- Client-side cookie helper (for 'use client' components) ---
// Reads document.cookie directly. Returns undefined during SSR.
export function getCookieValue(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

// --- Typed cookie helpers (client-side) ---
// Call these inside components, useEffect, or event handlers — never at module level.

export function getClientClaveCookie(): string {
  return getCookieValue('company_clave') ?? ''
}

export function getCompanyIdCookie(): string {
  return getCookieValue('company_id') ?? ''
}

export function getClientNameCookie(): string {
  return getCookieValue('company_name') ?? ''
}

// --- Typed cookie helpers (client-side) — RFC ---

export function getClientRfcCookie(): string {
  return getCookieValue('company_rfc') ?? ''
}

// --- DEPRECATED sync constants ---
// These exist only to avoid breaking imports during migration.
// They resolve to empty strings. Use the cookie helpers above.
/** @deprecated Use getClientClaveCookie() */
export const CLIENT_CLAVE = ''
/** @deprecated Use getClientNameCookie() */
export const CLIENT_NAME = ''
/** @deprecated Use getCompanyIdCookie() */
export const COMPANY_ID = ''
/** @deprecated Use getClientRfcCookie() */
export const CLIENT_RFC = ''

/**
 * Fetch wrapper that automatically includes the CSRF token header.
 * Use for all POST/PUT/DELETE requests from client components.
 */
export function csrfFetch(url: string, init?: RequestInit): Promise<Response> {
  const csrfToken = getCookieValue('csrf_token') || ''
  const headers = new Headers(init?.headers)
  if (!headers.has('X-CSRF-Token')) headers.set('X-CSRF-Token', csrfToken)
  if (!headers.has('Content-Type') && init?.method && init.method !== 'GET') {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(url, { ...init, headers })
}

// --- Firm-level constants (not client-specific) ---
export const PORTAL_URL = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://evco-portal.vercel.app')
export const PATENTE = '3596'
export const ADUANA = '240'
export const BROKER_ID = 'rzco'
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// --- Runtime cookie helpers (server components + API routes) ---
// These read the auth cookies set at login via next/headers.

export async function getCompanyId(): Promise<string> {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    return cookieStore.get('company_id')?.value ?? ''
  } catch {
    return ''
  }
}

export async function getClientClave(): Promise<string> {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    return cookieStore.get('company_clave')?.value ?? ''
  } catch {
    return ''
  }
}

export async function getClientName(): Promise<string> {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const raw = cookieStore.get('company_name')?.value
    return raw ? decodeURIComponent(raw) : ''
  } catch {
    return ''
  }
}

// --- Multi-tenant async resolver ---

export interface ClientConfig {
  CLIENT_NAME: string
  CLIENT_RFC: string
  CLIENT_CLAVE: string
  COMPANY_ID: string
  PATENTE: string
  ADUANA: string
}

// Tenant-neutral defaults. PATENTE + ADUANA reflect Renato Zapata & Company's
// broker identity (invariant — applies to every tenant under the patente) so
// those stay as stable constants. The client-identifying fields default to
// empty so a MAFESA user with partial auth metadata never inherits EVCO's
// name / RFC / clave. Surfaces that render "cliente" from CLIENT_NAME already
// tolerate empty strings; a missing value is strictly better than a wrong
// tenant's value on screen.
const BROKER_IDENTITY = {
  PATENTE: '3596',
  ADUANA: '240',
} as const

const NEUTRAL_DEFAULTS: ClientConfig = {
  CLIENT_NAME: '',
  CLIENT_RFC: '',
  CLIENT_CLAVE: '',
  COMPANY_ID: '',
  PATENTE: BROKER_IDENTITY.PATENTE,
  ADUANA: BROKER_IDENTITY.ADUANA,
}

/**
 * Resolve client config from Supabase auth session → companies table.
 *
 * MAFESA onboarding contract (codified 2026-04-20): never fall back to a
 * specific tenant's identity when lookup fails. An empty session or a
 * partial companies row returns NEUTRAL_DEFAULTS (broker identity only,
 * client fields blank). Previously EVCO_DEFAULTS fired here and would
 * paint a MAFESA user's cockpit with "EVCO Plastics de México" when their
 * auth metadata was incomplete — silent cross-tenant display bug.
 */
export async function getClientConfig(supabase: SupabaseClient): Promise<ClientConfig> {
  const { data: { session } } = await supabase.auth.getSession()
  const companyId = session?.user?.user_metadata?.company_id
    ?? session?.user?.user_metadata?.clave_cliente
    ?? ''

  if (!companyId) {
    // No session metadata — render neutral. Callers that need to redirect
    // to login should check `COMPANY_ID === ''`.
    return NEUTRAL_DEFAULTS
  }

  const { data: company } = await supabase
    .from('companies')
    .select('name, rfc, clave_cliente, company_id, patente, aduana')
    .eq('company_id', companyId)
    .single()

  if (!company) return NEUTRAL_DEFAULTS

  return {
    CLIENT_NAME: company.name ?? '',
    CLIENT_RFC: company.rfc ?? '',
    CLIENT_CLAVE: company.clave_cliente ?? '',
    COMPANY_ID: company.company_id ?? companyId,
    PATENTE: company.patente ?? BROKER_IDENTITY.PATENTE,
    ADUANA: company.aduana ?? BROKER_IDENTITY.ADUANA,
  }
}
