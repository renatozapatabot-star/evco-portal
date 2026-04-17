import { describe, it, expect } from 'vitest'
import { computeSuccessRate, SUCCESS_RATE_MATURITY_DAYS, SUCCESS_RATE_MIN_SAMPLES } from '../success-rate'

const NOW = new Date('2026-04-20T12:00:00Z').getTime()
const DAY = 86_400_000

function iso(daysAgo: number): string {
  return new Date(NOW - daysAgo * DAY).toISOString()
}

describe('computeSuccessRate', () => {
  it('returns null when sample is below the minimum', () => {
    const rows = Array.from({ length: SUCCESS_RATE_MIN_SAMPLES - 1 }, () => ({
      estatus: 'Cruzado',
      fecha_llegada: iso(30),
    }))
    expect(computeSuccessRate(rows, { now: NOW })).toBeNull()
  })

  it('ignores in-flight tráficos (arrived within maturity window)', () => {
    // 12 arrived yesterday (in-flight, below 14-day maturity) + 10 mature Cruzado
    const inflight = Array.from({ length: 12 }, () => ({ estatus: 'En Proceso', fecha_llegada: iso(1) }))
    const mature = Array.from({ length: 10 }, () => ({ estatus: 'Cruzado', fecha_llegada: iso(30) }))
    expect(computeSuccessRate([...inflight, ...mature], { now: NOW })).toBe(100)
  })

  it('excludes rows without fecha_llegada from the denominator', () => {
    const noLlegada = Array.from({ length: 50 }, () => ({ estatus: 'Cruzado', fecha_llegada: null }))
    const mature = Array.from({ length: 10 }, () => ({ estatus: 'Cruzado', fecha_llegada: iso(30) }))
    expect(computeSuccessRate([...noLlegada, ...mature], { now: NOW })).toBe(100)
  })

  it('computes the expected broker-performance rate on EVCO-shaped data', () => {
    // 18 mature: 17 Cruzado, 1 still En Proceso → 94% (realistic EVCO)
    const rows = [
      ...Array.from({ length: 17 }, () => ({ estatus: 'Cruzado', fecha_llegada: iso(30) })),
      { estatus: 'En Proceso', fecha_llegada: iso(30) },
    ]
    expect(computeSuccessRate(rows, { now: NOW })).toBe(94)
  })

  it('treats E1 and Entregado as crossed terminal states', () => {
    const rows = [
      ...Array.from({ length: 5 }, () => ({ estatus: 'E1', fecha_llegada: iso(30) })),
      ...Array.from({ length: 5 }, () => ({ estatus: 'Entregado', fecha_llegada: iso(30) })),
    ]
    expect(computeSuccessRate(rows, { now: NOW })).toBe(100)
  })

  it('maturity threshold is exactly 14 days (contract)', () => {
    expect(SUCCESS_RATE_MATURITY_DAYS).toBe(14)
  })

  it('min-sample threshold is exactly 10 (contract)', () => {
    expect(SUCCESS_RATE_MIN_SAMPLES).toBe(10)
  })

  it('handles a bad fecha_llegada string without exploding', () => {
    const rows = [
      ...Array.from({ length: 10 }, () => ({ estatus: 'Cruzado', fecha_llegada: iso(30) })),
      { estatus: 'Cruzado', fecha_llegada: 'not-a-date' },
    ]
    expect(computeSuccessRate(rows, { now: NOW })).toBe(100)
  })
})
