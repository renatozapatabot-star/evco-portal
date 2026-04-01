// src/lib/client-config.ts
// Client configuration — multi-tenant aware.
//
// LEGACY sync exports: used by 70+ files as compile-time defaults.
// These resolve to EVCO values and are safe for the existing single-tenant
// code paths. New multi-tenant code should use getClientConfig() or the
// runtime cookie helpers (getCompanyId, getClientClave, getClientName).
//
// The runtime client identity is determined at login by auth/route.ts,
// which sets company_id / company_clave / company_name cookies from the
// companies table.

import type { SupabaseClient } from '@supabase/supabase-js'

// --- Legacy sync exports (backward-compatible defaults for EVCO) ---
export const CLIENT_NAME = 'EVCO Plastics de México'
export const CLIENT_RFC = 'EPM001109I74'
export const CLIENT_CLAVE = '9254'
export const COMPANY_ID = 'evco'
export const PORTAL_URL = 'evco-portal.vercel.app'
export const PATENTE = '3596'
export const ADUANA = '240'
export const BROKER_ID = 'rzco'
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// --- Client-side cookie helper (for 'use client' components) ---
// Reads document.cookie directly. Safe to call during SSR (returns undefined).
export function getCookieValue(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

// --- Runtime cookie helpers (server components + API routes) ---
// These read the auth cookies set at login. They fall back to EVCO
// defaults when called outside a request context (client components,
// build time) so existing code keeps working.

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
    return raw ? decodeURIComponent(raw) : 'EVCO Plastics de México'
  } catch {
    return 'EVCO Plastics de México'
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
  CLIENT_CLAVE: '9254',
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
    ?? 'evco'

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
