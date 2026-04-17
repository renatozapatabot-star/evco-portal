import { describe, it, expect } from 'vitest'
import { formatFreshness, classifySyncHealth, type FreshnessReading } from '../freshness'

function reading(minutesAgo: number | null, hasData = true): FreshnessReading {
  return {
    minutesAgo,
    lastSyncedAt: hasData ? '2026-04-20T00:00:00Z' : null,
    isStale: minutesAgo != null && minutesAgo > 90,
    hasData,
  }
}

describe('classifySyncHealth', () => {
  it('returns "unknown" when no data', () => {
    expect(classifySyncHealth(reading(null, false))).toBe('unknown')
  })
  it('returns "green" at or below 45 minutes (within 1.5× cadence)', () => {
    expect(classifySyncHealth(reading(0))).toBe('green')
    expect(classifySyncHealth(reading(28))).toBe('green')
    expect(classifySyncHealth(reading(45))).toBe('green')
  })
  it('returns "amber" between 46 and 90 minutes', () => {
    expect(classifySyncHealth(reading(46))).toBe('amber')
    expect(classifySyncHealth(reading(75))).toBe('amber')
    expect(classifySyncHealth(reading(90))).toBe('amber')
  })
  it('returns "red" above 90 minutes', () => {
    expect(classifySyncHealth(reading(91))).toBe('red')
    expect(classifySyncHealth(reading(60 * 4))).toBe('red')
  })
})

describe('formatFreshness', () => {
  it('returns null when no data available', () => {
    expect(formatFreshness({ minutesAgo: null, lastSyncedAt: null, isStale: false, hasData: false })).toBeNull()
  })

  it('renders "ahora" for sub-minute readings', () => {
    expect(formatFreshness({ minutesAgo: 0, lastSyncedAt: '2026-04-20T00:00:00Z', isStale: false, hasData: true }))
      .toBe('Sincronizado ahora')
  })

  it('renders "hace 1 min" for exactly 1 minute', () => {
    expect(formatFreshness({ minutesAgo: 1, lastSyncedAt: '2026-04-20T00:00:00Z', isStale: false, hasData: true }))
      .toBe('Sincronizado hace 1 min')
  })

  it('renders minutes for < 60', () => {
    expect(formatFreshness({ minutesAgo: 28, lastSyncedAt: '2026-04-20T00:00:00Z', isStale: false, hasData: true }))
      .toBe('Sincronizado hace 28 min')
  })

  it('renders hours for ≥ 60 minutes', () => {
    expect(formatFreshness({ minutesAgo: 125, lastSyncedAt: '2026-04-20T00:00:00Z', isStale: true, hasData: true }))
      .toBe('Sincronizado hace 2 h')
  })

  it('renders "hace 1 h" for exactly 60 minutes', () => {
    expect(formatFreshness({ minutesAgo: 60, lastSyncedAt: '2026-04-20T00:00:00Z', isStale: false, hasData: true }))
      .toBe('Sincronizado hace 1 h')
  })

  it('renders days when older than 24 h', () => {
    expect(formatFreshness({ minutesAgo: 60 * 26, lastSyncedAt: '2026-04-19T00:00:00Z', isStale: true, hasData: true }))
      .toBe('Sincronizado hace 1 día')
    expect(formatFreshness({ minutesAgo: 60 * 24 * 3, lastSyncedAt: '2026-04-17T00:00:00Z', isStale: true, hasData: true }))
      .toBe('Sincronizado hace 3 días')
  })
})
