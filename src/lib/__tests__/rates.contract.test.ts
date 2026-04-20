/**
 * Contract tests for src/lib/rates.ts — the refuse-to-calculate
 * invariants. Paired with the CALCULATION tests in rates.test.ts
 * (which cover IVA cascading math) and with the scripts/lib/rates.js
 * equivalents exercised indirectly via cost-optimizer / generate-
 * invoice / invoice-handlers.
 *
 * What this file locks:
 *   · getIVARate  — throws when system_config row missing
 *   · getIVARate  — throws when valid_to has passed
 *   · getDTARates — same invariants
 *   · getExchangeRate — throws when rate is missing
 *
 * The Tier 2 rate sweep (commit 74b67db, 2026-04-20) replaced silent
 * fallback-to-0.16 patterns across 4 scripts. This file prevents
 * regression on the primitive side — if anyone adds `|| 0.16`
 * fallback inside rates.ts, these tests turn red.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any -- the mocked
   Supabase client's .from().select().eq().single() chain returns
   shapes we control in-test; faithful typing would clone the
   PostgrestQueryBuilder and add zero test value. */

// Stub the Supabase client at module-load so src/lib/rates.ts
// captures OUR mock instead of reaching the real database.
let mockQueryResult: { data: any; error: any } = { data: null, error: null }

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => mockQueryResult,
          }),
        }),
      }),
    }),
  }
})

// Set envs before the rates module loads.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://fake.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'fake-key'

// Import AFTER the mock + env setup so the module captures the stub.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import('../rates').then(() => {})  // warm-import suppresses race

beforeEach(() => {
  mockQueryResult = { data: null, error: null }
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('getIVARate · refuse-to-calculate contract', () => {
  it('throws when system_config row is missing', async () => {
    const { getIVARate } = await import('../rates')
    mockQueryResult = { data: null, error: null }
    await expect(getIVARate()).rejects.toThrow(/IVA rate not found/)
  })

  it('throws when valid_to is in the past', async () => {
    const { getIVARate } = await import('../rates')
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    mockQueryResult = {
      data: { value: { rate: 0.16 }, valid_to: yesterday },
      error: null,
    }
    await expect(getIVARate()).rejects.toThrow(/IVA rate expired/)
  })

  it('returns the rate when row exists and valid_to is future', async () => {
    const { getIVARate } = await import('../rates')
    const future = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)
    mockQueryResult = {
      data: { value: { rate: 0.16 }, valid_to: future },
      error: null,
    }
    const rate = await getIVARate()
    expect(rate).toBe(0.16)
  })

  it('returns the rate when valid_to is null (no expiry set)', async () => {
    const { getIVARate } = await import('../rates')
    mockQueryResult = {
      data: { value: { rate: 0.16 }, valid_to: null },
      error: null,
    }
    const rate = await getIVARate()
    expect(rate).toBe(0.16)
  })
})

describe('getDTARates · refuse-to-calculate contract', () => {
  it('throws when system_config row is missing', async () => {
    const { getDTARates } = await import('../rates')
    mockQueryResult = { data: null, error: null }
    await expect(getDTARates()).rejects.toThrow(/DTA rates not found/)
  })

  it('throws when valid_to is in the past', async () => {
    const { getDTARates } = await import('../rates')
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    mockQueryResult = {
      data: { value: { A1: { type: 'fixed', amount: 408 } }, valid_to: yesterday },
      error: null,
    }
    await expect(getDTARates()).rejects.toThrow(/DTA rates expired/)
  })

  it('returns the typed DTA shape when row exists and is fresh', async () => {
    const { getDTARates } = await import('../rates')
    const future = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)
    const rates = {
      A1: { type: 'fixed', amount: 408 },
      IN: { type: 'fixed', amount: 408 },
      IT: { type: 'fixed', amount: 0 },
    }
    mockQueryResult = { data: { value: rates, valid_to: future }, error: null }
    const result = await getDTARates()
    expect(result.A1.amount).toBe(408)
    expect(result.IT.amount).toBe(0)
  })
})

describe('getExchangeRate · refuse-to-calculate contract', () => {
  it('throws when system_config row is missing', async () => {
    const { getExchangeRate } = await import('../rates')
    mockQueryResult = { data: null, error: null }
    await expect(getExchangeRate()).rejects.toThrow(/Exchange rate not found/)
  })

  it('throws when row exists but value.rate is missing', async () => {
    const { getExchangeRate } = await import('../rates')
    mockQueryResult = {
      data: { value: { date: '2026-04-20' }, valid_to: null },
      error: null,
    }
    await expect(getExchangeRate()).rejects.toThrow(/Exchange rate not found/)
  })

  it('returns {rate, date, source} when row is valid', async () => {
    const { getExchangeRate } = await import('../rates')
    mockQueryResult = {
      data: {
        value: { rate: 17.5, date: '2026-04-20', source: 'banxico' },
        valid_to: null,
      },
      error: null,
    }
    const result = await getExchangeRate()
    expect(result.rate).toBe(17.5)
    expect(result.date).toBe('2026-04-20')
    expect(result.source).toBe('banxico')
  })

  it('defaults source to "system_config" when upstream omits it', async () => {
    const { getExchangeRate } = await import('../rates')
    mockQueryResult = {
      data: { value: { rate: 17.5, date: '2026-04-20' }, valid_to: null },
      error: null,
    }
    const result = await getExchangeRate()
    expect(result.source).toBe('system_config')
  })
})
