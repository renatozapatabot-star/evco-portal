import { vi } from "vitest";
import { readTenantConfig } from "../config";
/**
 * Tenant config parser tests — the white-label foundation.
 *
 * Exercises the pure parser with fixture rows. The DB-facing
 * readTenantConfig/hasFeature are thin wrappers that delegate to
 * parseTenantConfig + a single Supabase maybeSingle, already
 * covered by the routes that consume them.
 */

import { describe, it, expect } from 'vitest'
import {
  parseTenantConfig,
  stubTenantConfig,
  DEFAULT_BRANDING,
  DEFAULT_FEATURES,
  type TenantConfig,
} from '../config'

describe('stubTenantConfig', () => {
  it('produces a safe fallback for a missing tenant row', () => {
    const stub = stubTenantConfig('unknown-tenant')
    expect(stub.company_id).toBe('unknown-tenant')
    expect(stub.name).toBe('unknown-tenant')
    expect(stub.active).toBe(false)
    expect(stub.language).toBe('es')
    expect(stub.branding).toEqual(DEFAULT_BRANDING)
    expect(stub.features).toEqual(DEFAULT_FEATURES)
  })
})

describe('parseTenantConfig', () => {
  it('returns a stub when the row is null', () => {
    const cfg = parseTenantConfig(null, 'mafesa')
    expect(cfg.company_id).toBe('mafesa')
    expect(cfg.active).toBe(false)
    expect(cfg.branding).toEqual(DEFAULT_BRANDING)
    expect(cfg.features).toEqual(DEFAULT_FEATURES)
  })

  it('maps present columns onto the config shape', () => {
    const row = {
      company_id: 'evco',
      name: 'EVCO Plastics de México',
      clave_cliente: '9254',
      rfc: 'EVC910101XX1',
      patente: '3596',
      aduana: '240',
      language: 'es',
      active: true,
      created_at: '2026-01-01T00:00:00Z',
    }
    const cfg = parseTenantConfig(row, 'evco')
    expect(cfg.name).toBe('EVCO Plastics de México')
    expect(cfg.clave_cliente).toBe('9254')
    expect(cfg.patente).toBe('3596')
    expect(cfg.active).toBe(true)
    expect(cfg.language).toBe('es')
  })

  it('defaults language to "es" when null or invalid', () => {
    expect(parseTenantConfig({ company_id: 'x', name: 'X', clave_cliente: null, rfc: null, patente: null, aduana: null, language: null, active: true, created_at: null }, 'x').language).toBe('es')
    expect(parseTenantConfig({ company_id: 'x', name: 'X', clave_cliente: null, rfc: null, patente: null, aduana: null, language: 'fr', active: true, created_at: null }, 'x').language).toBe('es')
    expect(parseTenantConfig({ company_id: 'x', name: 'X', clave_cliente: null, rfc: null, patente: null, aduana: null, language: 'en', active: true, created_at: null }, 'x').language).toBe('en')
  })

  it('honors NEXT_PUBLIC_MI_CUENTA_ENABLED env flag when set to "true"', () => {
    const row = {
      company_id: 'evco', name: 'EVCO', clave_cliente: null, rfc: null,
      patente: null, aduana: null, language: null, active: true, created_at: null,
    }
    expect(parseTenantConfig(row, 'evco', 'true').features.mi_cuenta).toBe(true)
    expect(parseTenantConfig(row, 'evco', 'True').features.mi_cuenta).toBe(true)
    expect(parseTenantConfig(row, 'evco', 'false').features.mi_cuenta).toBe(false)
    expect(parseTenantConfig(row, 'evco', undefined).features.mi_cuenta).toBe(false)
  })

  it('keeps defaults for future columns (branding / features) when absent', () => {
    const row = {
      company_id: 'evco', name: 'EVCO', clave_cliente: null, rfc: null,
      patente: null, aduana: null, language: null, active: true, created_at: null,
    }
    const cfg = parseTenantConfig(row, 'evco')
    expect(cfg.branding).toEqual(DEFAULT_BRANDING)
    expect(cfg.features.cruz_ai).toBe(true)
    expect(cfg.features.mi_cuenta).toBe(false)
    expect(cfg.features.mensajeria_client).toBe(false)
    expect(cfg.features.white_label_surfaces).toBe(false)
  })

  it('parses a branding jsonb blob when present (future migration)', () => {
    const row = {
      company_id: 'mafesa', name: 'MAFESA', clave_cliente: null, rfc: null,
      patente: null, aduana: null, language: null, active: true, created_at: null,
      branding: {
        wordmark: 'MAFESA · Premium',
        logo_url: 'https://cdn.example.com/mafesa-logo.svg',
        accent_token: '--portal-status-amber-fg',
      },
    }
    const cfg = parseTenantConfig(row, 'mafesa')
    expect(cfg.branding.wordmark).toBe('MAFESA · Premium')
    expect(cfg.branding.logo_url).toBe('https://cdn.example.com/mafesa-logo.svg')
    expect(cfg.branding.accent_token).toBe('--portal-status-amber-fg')
  })

  it('rejects accent tokens that are raw hex (tokens-only rule)', () => {
    const row = {
      company_id: 'x', name: 'X', clave_cliente: null, rfc: null,
      patente: null, aduana: null, language: null, active: true, created_at: null,
      branding: { accent_token: '#C9A74A' },
    }
    const cfg = parseTenantConfig(row, 'x')
    // Hex values are not in the tokens namespace — get rejected back to null
    expect(cfg.branding.accent_token).toBeNull()
  })

  it('parses a features jsonb blob and merges over defaults', () => {
    const row = {
      company_id: 'evco', name: 'EVCO', clave_cliente: null, rfc: null,
      patente: null, aduana: null, language: null, active: true, created_at: null,
      features: {
        mensajeria_client: true,
        white_label_surfaces: true,
        // cruz_ai + mi_cuenta unspecified → take defaults
      },
    }
    const cfg = parseTenantConfig(row, 'evco')
    expect(cfg.features.mensajeria_client).toBe(true)
    expect(cfg.features.white_label_surfaces).toBe(true)
    expect(cfg.features.cruz_ai).toBe(true) // default
    expect(cfg.features.mi_cuenta).toBe(false) // default
  })

  it('ignores garbage in branding / features (non-object values)', () => {
    const row = {
      company_id: 'x', name: 'X', clave_cliente: null, rfc: null,
      patente: null, aduana: null, language: null, active: true, created_at: null,
      branding: 'not an object',
      features: 42,
    }
    const cfg = parseTenantConfig(row, 'x')
    expect(cfg.branding).toEqual(DEFAULT_BRANDING)
    expect(cfg.features).toEqual(DEFAULT_FEATURES)
  })

  it('treats active: null as inactive (conservative default)', () => {
    const row = {
      company_id: 'x', name: 'X', clave_cliente: null, rfc: null,
      patente: null, aduana: null, language: null, active: null as boolean | null, created_at: null,
    }
    const cfg: TenantConfig = parseTenantConfig(row, 'x')
    expect(cfg.active).toBe(false)
  })
})

// Regression test: ensure branding + features are always selected
it('readTenantConfig selects branding and features columns', async () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  } as any;

  await readTenantConfig(mockSupabase, 'test-company');

  expect(mockSupabase.select).toHaveBeenCalledWith(
    expect.stringContaining('branding')
  );
  expect(mockSupabase.select).toHaveBeenCalledWith(
    expect.stringContaining('features')
  );
});
