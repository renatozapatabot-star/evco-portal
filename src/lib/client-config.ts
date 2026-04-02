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

// --- Firm-level constants (not client-specific) ---
export const PORTAL_URL = 'evco-portal.vercel.app'
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

const EVCO_DEFAULTS: ClientConfig = {
  CLIENT_NAME: 'EVCO Plastics de México',
  CLIENT_RFC: 'EPM001109I74',
  CLIENT_CLAVE: 'evco',
  COMPANY_ID: 'evco',
  PATENTE: '3596',
  ADUANA: '240',
}

/**
 * Resolve client config from Supabase auth session → companies table.
 * Falls back to EVCO defaults for existing users without company metadata.
 */
export async function getClientConfig(supabase: SupabaseClient): Promise<ClientConfig> {
  const { data: { session } } = await supabase.auth.getSession()
  const companyId = session?.user?.user_metadata?.company_id
    ?? session?.user?.user_metadata?.clave_cliente
    ?? ''

  const { data: company } = await supabase
    .from('companies')
    .select('name, rfc, clave_cliente, company_id, patente, aduana')
    .eq('company_id', companyId)
    .single()

  if (!company) return EVCO_DEFAULTS

  return {
    CLIENT_NAME: company.name ?? EVCO_DEFAULTS.CLIENT_NAME,
    CLIENT_RFC: company.rfc ?? EVCO_DEFAULTS.CLIENT_RFC,
    CLIENT_CLAVE: company.clave_cliente ?? EVCO_DEFAULTS.CLIENT_CLAVE,
    COMPANY_ID: company.company_id ?? EVCO_DEFAULTS.COMPANY_ID,
    PATENTE: company.patente ?? EVCO_DEFAULTS.PATENTE,
    ADUANA: company.aduana ?? EVCO_DEFAULTS.ADUANA,
  }
}
