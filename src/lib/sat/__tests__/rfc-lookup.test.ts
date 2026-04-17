import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lookupRfcByName, recordRfcFromFormato53 } from '../rfc-lookup'

type AnyFn = (...a: unknown[]) => unknown

function makeSupabaseStub(overrides: {
  cacheRow?: { name_normalized: string; display_name: string; rfc: string | null; source: string; last_lookup_at: string } | null
  upsertError?: string | null
} = {}) {
  const callLog: unknown[] = []
  const from = vi.fn((_table: string) => {
    callLog.push(['from', _table])
    return {
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: async () => ({ data: overrides.cacheRow ?? null, error: null }),
        }),
      }),
      upsert: async (payload: unknown, _opts: unknown) => {
        callLog.push(['upsert', payload])
        return { data: payload, error: overrides.upsertError ? { message: overrides.upsertError } : null }
      },
    }
  }) as unknown as AnyFn
  return { from, callLog }
}

describe('lookupRfcByName', () => {
  beforeEach(() => {
    delete process.env.SAT_RFC_API_URL
    delete process.env.SAT_RFC_API_KEY
  })

  it('returns cached RFC immediately on hit', async () => {
    const stub = makeSupabaseStub({
      cacheRow: {
        name_normalized: 'ACME PLASTICS',
        display_name: 'ACME Plastics',
        rfc: 'ACM001234AB1',
        source: 'formato53',
        last_lookup_at: new Date().toISOString(),
      },
    })
    const result = await lookupRfcByName({ from: stub.from } as unknown as Parameters<typeof lookupRfcByName>[0], 'ACME Plastics')
    expect(result?.rfc).toBe('ACM001234AB1')
    expect(result?.source).toBe('cache')
  })

  it('returns null + writes negative cache when no endpoint configured and no cache hit', async () => {
    const stub = makeSupabaseStub({ cacheRow: null })
    const result = await lookupRfcByName({ from: stub.from } as unknown as Parameters<typeof lookupRfcByName>[0], 'New Supplier')
    expect(result?.rfc).toBeNull()
    // Upsert was called to record negative result
    const upserts = stub.callLog.filter((c) => Array.isArray(c) && c[0] === 'upsert')
    expect(upserts.length).toBe(1)
  })

  it('returns null for empty supplier name without touching DB', async () => {
    const stub = makeSupabaseStub({ cacheRow: null })
    const result = await lookupRfcByName({ from: stub.from } as unknown as Parameters<typeof lookupRfcByName>[0], '')
    expect(result).toBeNull()
    expect(stub.callLog).toHaveLength(0)
  })

  it('respects negative cache within freshness window', async () => {
    const stub = makeSupabaseStub({
      cacheRow: {
        name_normalized: 'UNKNOWN CO',
        display_name: 'Unknown Co',
        rfc: null,
        source: 'unknown',
        last_lookup_at: new Date(Date.now() - 30 * 86_400_000).toISOString(), // 30 days old, within 180
      },
    })
    const result = await lookupRfcByName({ from: stub.from } as unknown as Parameters<typeof lookupRfcByName>[0], 'Unknown Co')
    expect(result?.rfc).toBeNull()
    expect(result?.source).toBe('cache')
    // No upsert — we backed off
    const upserts = stub.callLog.filter((c) => Array.isArray(c) && c[0] === 'upsert')
    expect(upserts.length).toBe(0)
  })
})

describe('recordRfcFromFormato53', () => {
  it('writes one upsert per non-empty entry', async () => {
    const stub = makeSupabaseStub()
    const result = await recordRfcFromFormato53(
      { from: stub.from } as unknown as Parameters<typeof recordRfcFromFormato53>[0],
      [
        { supplier_name: 'ACME Plastics', rfc: 'ACM001234AB1' },
        { supplier_name: 'Beta Supply', rfc: '34-1151140' },
        { supplier_name: '', rfc: 'ignored' }, // skip empty name
        { supplier_name: 'Gamma', rfc: '' }, // skip empty rfc
      ],
    )
    expect(result.written).toBe(2)
    expect(result.skipped).toBe(2)
  })

  it('counts upsert errors as skipped', async () => {
    const stub = makeSupabaseStub({ upsertError: 'constraint violation' })
    const result = await recordRfcFromFormato53(
      { from: stub.from } as unknown as Parameters<typeof recordRfcFromFormato53>[0],
      [{ supplier_name: 'X', rfc: 'Y' }],
    )
    expect(result.written).toBe(0)
    expect(result.skipped).toBe(1)
  })
})
