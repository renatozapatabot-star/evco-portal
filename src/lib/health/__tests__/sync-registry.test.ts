import { describe, it, expect } from 'vitest'
import {
  SYNC_REGISTRY,
  classifyBySyncType,
  getSyncRegistryEntry,
  minutesOverdue,
  worstBand,
} from '../sync-registry'

describe('SYNC_REGISTRY', () => {
  it('keys match the syncType field on every entry', () => {
    for (const [key, entry] of Object.entries(SYNC_REGISTRY)) {
      expect(entry.syncType).toBe(key)
    }
  })

  it('includes all six critical syncs', () => {
    const critical = Object.values(SYNC_REGISTRY)
      .filter((e) => e.critical)
      .map((e) => e.syncType)
      .sort()
    expect(critical).toEqual([
      'econta_full',
      'email_intake',
      'globalpc',
      'globalpc_delta',
      'risk_feed',
      'risk_scorer',
    ])
  })

  it('every entry has a positive cadenceMin', () => {
    for (const entry of Object.values(SYNC_REGISTRY)) {
      expect(entry.cadenceMin).toBeGreaterThan(0)
    }
  })
})

describe('classifyBySyncType', () => {
  it('returns unknown for sync types not in the registry', () => {
    expect(classifyBySyncType('does_not_exist', 0)).toBe('unknown')
    expect(classifyBySyncType('does_not_exist', null)).toBe('unknown')
    expect(classifyBySyncType('does_not_exist', 99999)).toBe('unknown')
  })

  it('returns red when a known sync has never succeeded in the window', () => {
    expect(classifyBySyncType('globalpc_delta', null)).toBe('red')
    expect(classifyBySyncType('email_intake', null)).toBe('red')
  })

  it('classifies a 15-minute cadence sync at the 22.5 / 45 boundaries', () => {
    // globalpc_delta: cadence 15 → green ≤22.5, amber ≤45, red >45
    expect(classifyBySyncType('globalpc_delta', 0)).toBe('green')
    expect(classifyBySyncType('globalpc_delta', 22)).toBe('green')
    expect(classifyBySyncType('globalpc_delta', 23)).toBe('amber')
    expect(classifyBySyncType('globalpc_delta', 45)).toBe('amber')
    expect(classifyBySyncType('globalpc_delta', 46)).toBe('red')
  })

  it('classifies a 30-minute cadence sync at the canonical 45/90 boundaries', () => {
    // econta_full: cadence 30 → green ≤45, amber ≤90, red >90
    // (matches the client-surface freshness contract exactly)
    expect(classifyBySyncType('econta_full', 45)).toBe('green')
    expect(classifyBySyncType('econta_full', 46)).toBe('amber')
    expect(classifyBySyncType('econta_full', 90)).toBe('amber')
    expect(classifyBySyncType('econta_full', 91)).toBe('red')
  })

  it('classifies a daily sync with wider bands', () => {
    // globalpc: cadence 1440 → green ≤2160 (36h), amber ≤4320 (72h)
    expect(classifyBySyncType('globalpc', 60 * 24)).toBe('green')
    expect(classifyBySyncType('globalpc', 60 * 35)).toBe('green')
    expect(classifyBySyncType('globalpc', 60 * 36)).toBe('green')
    expect(classifyBySyncType('globalpc', 60 * 37)).toBe('amber')
    expect(classifyBySyncType('globalpc', 60 * 72)).toBe('amber')
    expect(classifyBySyncType('globalpc', 60 * 73)).toBe('red')
  })

  it('classifies a weekly backfill against a 7-day cadence', () => {
    // backfill_proveedor_rfc: cadence 7×1440 = 10080 → green ≤15120 (10.5d), amber ≤30240 (21d)
    expect(classifyBySyncType('backfill_proveedor_rfc', 7 * 1440)).toBe('green')
    expect(classifyBySyncType('backfill_proveedor_rfc', 10 * 1440)).toBe('green')
    expect(classifyBySyncType('backfill_proveedor_rfc', 11 * 1440)).toBe('amber')
    expect(classifyBySyncType('backfill_proveedor_rfc', 22 * 1440)).toBe('red')
  })
})

describe('minutesOverdue', () => {
  it('returns 0 for a healthy sync', () => {
    expect(minutesOverdue('globalpc_delta', 10)).toBe(0)
    expect(minutesOverdue('globalpc_delta', 45)).toBe(0)
  })

  it('returns the number of minutes past the red threshold', () => {
    // globalpc_delta red threshold = 15 × 3 = 45
    expect(minutesOverdue('globalpc_delta', 60)).toBe(15)
    expect(minutesOverdue('globalpc_delta', 100)).toBe(55)
  })

  it('returns 0 for unknown sync types or null minutesAgo', () => {
    expect(minutesOverdue('does_not_exist', 9999)).toBe(0)
    expect(minutesOverdue('globalpc_delta', null)).toBe(0)
  })
})

describe('getSyncRegistryEntry', () => {
  it('returns the entry for a known sync type', () => {
    const entry = getSyncRegistryEntry('globalpc_delta')
    expect(entry?.critical).toBe(true)
    expect(entry?.cadenceMin).toBe(15)
  })

  it('returns null for an unknown sync type', () => {
    expect(getSyncRegistryEntry('does_not_exist')).toBeNull()
  })
})

describe('worstBand', () => {
  it('returns green when all bands are green', () => {
    expect(worstBand(['green', 'green', 'green'])).toBe('green')
  })

  it('treats unknown as equivalent to green (never escalates verdict)', () => {
    expect(worstBand(['green', 'unknown', 'green'])).toBe('green')
    expect(worstBand(['unknown', 'unknown'])).toBe('green')
  })

  it('returns amber when any band is amber and none are red', () => {
    expect(worstBand(['green', 'amber', 'green'])).toBe('amber')
    expect(worstBand(['unknown', 'amber'])).toBe('amber')
  })

  it('returns red when any band is red', () => {
    expect(worstBand(['green', 'amber', 'red'])).toBe('red')
    expect(worstBand(['red'])).toBe('red')
  })

  it('returns green for an empty array', () => {
    expect(worstBand([])).toBe('green')
  })
})
