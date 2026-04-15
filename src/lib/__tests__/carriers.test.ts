/**
 * ZAPATA AI · Block 12 — Carriers master catalog tests.
 *
 * Six tests:
 *  1. Search returns alias matches when the alias substring matches
 *  2. Pure filter stays under 100ms for a 200-row inline dataset
 *  3. carrier_type filter excludes other types
 *  4. active=false entries hidden when onlyActive=true
 *  5. MRU ordering — pure pushMru + mergeMruAndResults
 *  6. Admin catalog write payload shape validated by zod schemas
 */

import { describe, it, expect } from 'vitest'
import {
  CarrierCreateSchema,
  CarrierSearchQuerySchema,
  CarrierUpdateSchema,
  mergeMruAndResults,
  pushMru,
  mruKey,
  MRU_MAX,
  type CarrierSearchResult,
  type MruEntry,
} from '@/lib/carriers'

// Pure in-memory match helper mirroring the search route's fallback ilike.
function pureFilter(
  dataset: readonly (CarrierSearchResult & { active: boolean; aliases?: string[] })[],
  opts: { q?: string; type?: CarrierSearchResult['carrier_type']; onlyActive?: boolean },
): CarrierSearchResult[] {
  const q = (opts.q ?? '').trim().toLowerCase()
  return dataset
    .filter(c => (opts.onlyActive ?? true ? c.active : true))
    .filter(c => (opts.type ? c.carrier_type === opts.type : true))
    .filter(c => {
      if (!q) return true
      if (c.name.toLowerCase().includes(q)) return true
      return (c.aliases ?? []).some(a => a.toLowerCase().includes(q))
    })
    .map(({ id, name, rfc, sct_permit, carrier_type }) => ({
      id,
      name,
      rfc,
      sct_permit,
      carrier_type,
    }))
}

function seedCarriers(n: number) {
  const types: CarrierSearchResult['carrier_type'][] = ['mx', 'transfer', 'foreign']
  const out: (CarrierSearchResult & { active: boolean; aliases?: string[] })[] = []
  for (let i = 0; i < n; i++) {
    const type = types[i % 3]
    out.push({
      id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      name: `Carrier ${i} ${type.toUpperCase()}`,
      rfc: type === 'foreign' ? null : `RFC${i.toString().padStart(7, '0')}`,
      sct_permit: type === 'foreign' ? null : `SCT-MX-${i.toString().padStart(5, '0')}`,
      carrier_type: type,
      active: i % 17 !== 0, // every 17th carrier inactive
      aliases: i % 5 === 0 ? [`C${i}`] : [],
    })
  }
  // Real-world fixtures with known aliases for search assertions.
  out.push({
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Transportes Castores',
    rfc: 'TCA880101AAA',
    sct_permit: 'SCT-MX-00101',
    carrier_type: 'mx',
    active: true,
    aliases: ['Castores'],
  })
  out.push({
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'J.B. Hunt Transport Services',
    rfc: null,
    sct_permit: null,
    carrier_type: 'foreign',
    active: true,
    aliases: ['JB Hunt', 'JBHunt'],
  })
  return out
}

describe('carriers search', () => {
  it('matches by alias substring ("Castores" → Transportes Castores)', () => {
    const dataset = seedCarriers(200)
    const hits = pureFilter(dataset, { q: 'Castores' })
    expect(hits.some(c => c.name === 'Transportes Castores')).toBe(true)

    const jbHits = pureFilter(dataset, { q: 'JB Hunt' })
    expect(jbHits.some(c => c.name === 'J.B. Hunt Transport Services')).toBe(true)
  })

  it('filter stays under 100ms for a 200-row dataset', () => {
    const dataset = seedCarriers(202)
    const start = performance.now()
    for (let i = 0; i < 50; i++) {
      pureFilter(dataset, { q: 'TRANSFER', type: 'transfer' })
    }
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(100)
  })

  it('carrier_type filter excludes other types', () => {
    const dataset = seedCarriers(60)
    const mxOnly = pureFilter(dataset, { type: 'mx' })
    expect(mxOnly.every(c => c.carrier_type === 'mx')).toBe(true)
    expect(mxOnly.length).toBeGreaterThan(0)
  })

  it('active filter hides inactive carriers when onlyActive=true', () => {
    const dataset = seedCarriers(60)
    const activeOnly = pureFilter(dataset, { onlyActive: true })
    // With onlyActive=true, every 17th seed (i=0, 17, 34, 51) is hidden.
    expect(activeOnly.length).toBeLessThan(dataset.length)
    const withInactive = pureFilter(dataset, { onlyActive: false })
    expect(withInactive.length).toBe(dataset.length)
  })
})

describe('MRU cache helpers', () => {
  const carrierA: CarrierSearchResult = {
    id: 'a',
    name: 'Carrier A',
    rfc: null,
    sct_permit: 'SCT-A',
    carrier_type: 'mx',
  }
  const carrierB: CarrierSearchResult = {
    id: 'b',
    name: 'Carrier B',
    rfc: null,
    sct_permit: 'SCT-B',
    carrier_type: 'mx',
  }
  const carrierC: CarrierSearchResult = {
    id: 'c',
    name: 'Carrier C',
    rfc: null,
    sct_permit: 'SCT-C',
    carrier_type: 'mx',
  }

  it('pushMru dedupes, caps at MRU_MAX, MRU surfaces at top of merged list', () => {
    let mru: MruEntry[] = []
    mru = pushMru(mru, carrierA, 1)
    mru = pushMru(mru, carrierB, 2)
    mru = pushMru(mru, carrierA, 3) // dedupe — A stays #1
    expect(mru.map(m => m.id)).toEqual(['a', 'b'])

    // Saturate.
    for (let i = 0; i < MRU_MAX + 5; i++) {
      mru = pushMru(
        mru,
        {
          id: `fill-${i}`,
          name: `Fill ${i}`,
          rfc: null,
          sct_permit: null,
          carrier_type: 'mx',
        },
        100 + i,
      )
    }
    expect(mru.length).toBe(MRU_MAX)

    // Merge: MRU first, then search results without duplicates.
    mru = [{ ...carrierA, usedAt: 10 }, { ...carrierB, usedAt: 5 }]
    const merged = mergeMruAndResults(mru, [carrierB, carrierC])
    expect(merged.map(c => c.id)).toEqual(['a', 'b', 'c'])

    expect(mruKey('op-42', 'transfer')).toBe(
      'aguila:carrier-mru:op-42:transfer',
    )
  })
})

describe('admin catalog write schemas', () => {
  it('create schema validates required + optional fields, update schema allows partial', () => {
    const ok = CarrierCreateSchema.safeParse({
      carrier_type: 'mx',
      name: 'Test Carrier',
      rfc: 'TEST890101XXX',
      sct_permit: 'SCT-TEST',
      dot_number: null,
      scac_code: null,
      notes: null,
    })
    expect(ok.success).toBe(true)

    const bad = CarrierCreateSchema.safeParse({
      carrier_type: 'mars',
      name: '',
    })
    expect(bad.success).toBe(false)

    const partial = CarrierUpdateSchema.safeParse({ active: false })
    expect(partial.success).toBe(true)

    const queryOk = CarrierSearchQuerySchema.safeParse({
      q: 'castores',
      type: 'mx',
      limit: 5,
    })
    expect(queryOk.success).toBe(true)
    if (queryOk.success) expect(queryOk.data.onlyActive).toBe(true)

    const queryBadLimit = CarrierSearchQuerySchema.safeParse({ limit: 999 })
    expect(queryBadLimit.success).toBe(false)
  })
})
