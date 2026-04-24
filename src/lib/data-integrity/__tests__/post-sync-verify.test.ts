/**
 * Build 12 — post-sync integrity validators.
 *
 * Tests the pure functions exported from scripts/lib/post-sync-verify.js.
 * The CLI module is required via path so vitest exercises the same code
 * the PM2 sync uses in production — no parallel TS port to drift from.
 */
import { describe, it, expect } from 'vitest'
import path from 'path'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const verifier = require(path.join(__dirname, '../../../../scripts/lib/post-sync-verify.js'))

const { checkRow, summarize, decideVerdict, sampleEvery, PEDIMENTO_RE, FRACCION_RE } = verifier

describe('checkRow', () => {
  const companyIds = new Set(['evco', 'mafesa'])

  it('passes a clean traficos row', () => {
    const row = {
      trafico: 'T12345',
      company_id: 'evco',
      tenant_id: 'broker-uuid',
      pedimento: '26 24 3596 6500441',
    }
    expect(checkRow(row, { pkColumn: 'trafico', companyIds })).toEqual([])
  })

  it('flags missing company_id', () => {
    const row = { trafico: 'T1', company_id: null, tenant_id: 'b' }
    const v = checkRow(row, { pkColumn: 'trafico', companyIds })
    expect(v).toContain('missing_company_id')
  })

  it('flags orphan company_id', () => {
    const row = { trafico: 'T1', company_id: 'orphan-tornillo', tenant_id: 'b' }
    const v = checkRow(row, { pkColumn: 'trafico', companyIds })
    expect(v.some((x: string) => x.startsWith('orphan_company_id'))).toBe(true)
  })

  it('flags missing tenant_id by default', () => {
    const row = { trafico: 'T1', company_id: 'evco', tenant_id: null }
    expect(checkRow(row, { pkColumn: 'trafico', companyIds })).toContain('missing_tenant_id')
  })

  it('skips tenant_id check when not required', () => {
    const row = { cve_entrada: 'E1', company_id: 'evco', tenant_id: null }
    expect(
      checkRow(row, { pkColumn: 'cve_entrada', companyIds, requireTenantId: false })
    ).toEqual([])
  })

  it('flags malformed pedimento (no spaces)', () => {
    const row = {
      trafico: 'T1',
      company_id: 'evco',
      tenant_id: 'b',
      pedimento: '26243596650441',
    }
    const v = checkRow(row, { pkColumn: 'trafico', companyIds })
    expect(v.some((x: string) => x.startsWith('bad_pedimento_format'))).toBe(true)
  })

  it('accepts canonical SAT pedimento format', () => {
    const row = {
      trafico: 'T1',
      company_id: 'evco',
      tenant_id: 'b',
      pedimento: '26 24 3596 6500441',
    }
    expect(checkRow(row, { pkColumn: 'trafico', companyIds })).toEqual([])
  })

  it('flags malformed fraccion (no dots)', () => {
    const row = {
      cve_producto: 'P1',
      company_id: 'evco',
      tenant_id: 'b',
      fraccion: '39012001',
    }
    const v = checkRow(row, { pkColumn: 'cve_producto', companyIds })
    expect(v.some((x: string) => x.startsWith('bad_fraccion_format'))).toBe(true)
  })

  it('accepts canonical fraccion XXXX.XX.XX', () => {
    const row = {
      cve_producto: 'P1',
      company_id: 'evco',
      tenant_id: 'b',
      fraccion: '3901.20.01',
    }
    expect(checkRow(row, { pkColumn: 'cve_producto', companyIds })).toEqual([])
  })

  it('flags missing PK', () => {
    const row = { trafico: null, company_id: 'evco', tenant_id: 'b' }
    expect(checkRow(row, { pkColumn: 'trafico', companyIds })).toContain('missing_pk:trafico')
  })
})

describe('summarize', () => {
  it('aggregates batch results correctly', () => {
    const summary = summarize([
      {
        table: 'traficos',
        expected: 100,
        found: 100,
        missing: 0,
        violationRows: 0,
        violationCounts: {},
      },
      {
        table: 'entradas',
        expected: 50,
        found: 49,
        missing: 1,
        violationRows: 2,
        violationCounts: { missing_tenant_id: 2 },
      },
    ])
    expect(summary.expected).toBe(150)
    expect(summary.found).toBe(149)
    expect(summary.missing).toBe(1)
    expect(summary.violation_rows).toBe(2)
    expect(summary.violations.missing_tenant_id).toBe(2)
    // (149 - 2) / 150 = 0.98 → 98%
    expect(summary.integrity_pct).toBe(98)
  })

  it('reports 100% when nothing was expected', () => {
    expect(summarize([]).integrity_pct).toBe(100)
  })
})

describe('decideVerdict', () => {
  const ok = { table: 't', expected: 100, found: 100, missing: 0, violationRows: 0, violationCounts: {} }

  it('green when everything matches', () => {
    const summary = summarize([ok])
    expect(decideVerdict(summary, [ok])).toBe('green')
  })

  it('red on tenant violation regardless of pct', () => {
    const batch = { ...ok, violationRows: 1, violationCounts: { orphan_company_id: 1 } }
    const summary = summarize([batch])
    expect(decideVerdict(summary, [batch])).toBe('red')
  })

  it('red on missing > 1%', () => {
    const batch = { ...ok, expected: 100, found: 95, missing: 5 }
    const summary = summarize([batch])
    expect(decideVerdict(summary, [batch])).toBe('red')
  })

  it('amber on minor format drift', () => {
    const batch = { ...ok, violationRows: 1, violationCounts: { bad_pedimento_format: 1 } }
    const summary = summarize([batch])
    expect(decideVerdict(summary, [batch])).toBe('amber')
  })

  it('red on query error', () => {
    const batch = { ...ok, queryError: 'connection timeout' }
    const summary = summarize([batch])
    expect(decideVerdict(summary, [batch])).toBe('red')
  })
})

describe('sampleEvery', () => {
  it('returns the input unchanged when below the cap', () => {
    const arr = ['a', 'b', 'c']
    expect(sampleEvery(arr, 5)).toEqual(arr)
  })

  it('downsamples deterministically when above the cap', () => {
    const arr = Array.from({ length: 1000 }, (_, i) => `pk-${i}`)
    const sample = sampleEvery(arr, 100)
    expect(sample).toHaveLength(100)
    expect(sample[0]).toBe('pk-0')
    expect(sample[99]).toBe('pk-990')
    // deterministic: re-sample yields identical output
    expect(sampleEvery(arr, 100)).toEqual(sample)
  })
})

describe('format regexes', () => {
  it('PEDIMENTO_RE accepts only the SAT canonical format', () => {
    expect(PEDIMENTO_RE.test('26 24 3596 6500441')).toBe(true)
    expect(PEDIMENTO_RE.test('26243596 6500441')).toBe(false)
    expect(PEDIMENTO_RE.test('26-24-3596-6500441')).toBe(false)
    expect(PEDIMENTO_RE.test('')).toBe(false)
  })

  it('FRACCION_RE accepts only XXXX.XX.XX', () => {
    expect(FRACCION_RE.test('3901.20.01')).toBe(true)
    expect(FRACCION_RE.test('390120.01')).toBe(false)
    expect(FRACCION_RE.test('3901-20-01')).toBe(false)
    expect(FRACCION_RE.test('39012001')).toBe(false)
  })
})
