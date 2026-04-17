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
      fecha_cruce: iso(28),
    }))
    expect(computeSuccessRate(rows, { now: NOW })).toBeNull()
  })

  it('ignores in-flight tráficos (arrived within maturity window)', () => {
    const inflight = Array.from({ length: 12 }, () => ({ estatus: 'En Proceso', fecha_llegada: iso(1), fecha_cruce: null }))
    const mature = Array.from({ length: 10 }, () => ({ estatus: 'Cruzado', fecha_llegada: iso(30), fecha_cruce: iso(28) }))
    expect(computeSuccessRate([...inflight, ...mature], { now: NOW })).toBe(100)
  })

  it('excludes rows without fecha_llegada from the denominator', () => {
    const noLlegada = Array.from({ length: 50 }, () => ({ estatus: 'Cruzado', fecha_llegada: null, fecha_cruce: iso(5) }))
    const mature = Array.from({ length: 10 }, () => ({ estatus: 'Cruzado', fecha_llegada: iso(30), fecha_cruce: iso(28) }))
    expect(computeSuccessRate([...noLlegada, ...mature], { now: NOW })).toBe(100)
  })

  it('computes the expected broker-performance rate on EVCO-shaped data', () => {
    const rows = [
      ...Array.from({ length: 17 }, () => ({ estatus: 'Cruzado', fecha_llegada: iso(30), fecha_cruce: iso(28) })),
      { estatus: 'En Proceso', fecha_llegada: iso(30), fecha_cruce: null },
    ]
    expect(computeSuccessRate(rows, { now: NOW })).toBe(94)
  })

  it('treats E1, Entregado, Pedimento Pagado, and Desaduanado as success states', () => {
    const rows = [
      ...Array.from({ length: 3 }, () => ({ estatus: 'E1', fecha_llegada: iso(30), fecha_cruce: iso(28) })),
      ...Array.from({ length: 3 }, () => ({ estatus: 'Entregado', fecha_llegada: iso(30), fecha_cruce: iso(28) })),
      ...Array.from({ length: 2 }, () => ({ estatus: 'Pedimento Pagado', fecha_llegada: iso(30), fecha_cruce: null })),
      ...Array.from({ length: 2 }, () => ({ estatus: 'Desaduanado', fecha_llegada: iso(30), fecha_cruce: null })),
    ]
    expect(computeSuccessRate(rows, { now: NOW })).toBe(100)
  })

  it('uses fecha_cruce as authoritative even when estatus still says En Proceso (sync-lag tolerance)', () => {
    const rows = [
      ...Array.from({ length: 9 }, () => ({ estatus: 'Cruzado', fecha_llegada: iso(30), fecha_cruce: iso(28) })),
      // Estatus lagging but fecha_cruce populated → should count as success
      { estatus: 'En Proceso', fecha_llegada: iso(30), fecha_cruce: iso(27) },
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
      ...Array.from({ length: 10 }, () => ({ estatus: 'Cruzado', fecha_llegada: iso(30), fecha_cruce: iso(28) })),
      { estatus: 'Cruzado', fecha_llegada: 'not-a-date', fecha_cruce: null },
    ]
    expect(computeSuccessRate(rows, { now: NOW })).toBe(100)
  })
})
