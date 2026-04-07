import { describe, it, expect } from 'vitest'
import {
  fmtCurrency, fmtUSDCompact, fmtUSD, fmtMXN, fmtMXNCompact, fmtMXNInt,
  fmtKg, fmtDate, fmtDateTime, fmtDateShort, fmtDateCompact,
  fmtId, fmtPedimento, fmtDesc, calcPriority, priorityClass,
  pluralize,
} from '../format-utils'

describe('fmtCurrency', () => {
  it('formats USD with 2 decimals by default', () => {
    expect(fmtCurrency(1234.5)).toBe('$1,234.50')
  })
  it('returns em-dash for null/undefined', () => {
    expect(fmtCurrency(null)).toBe('—')
    expect(fmtCurrency(undefined)).toBe('—')
  })
  it('formats compact millions', () => {
    expect(fmtCurrency(2_600_000, { compact: true })).toBe('$2.6M')
  })
  it('formats compact thousands', () => {
    expect(fmtCurrency(15_400, { compact: true })).toBe('$15.4K')
  })
  it('formats compact billions', () => {
    expect(fmtCurrency(1_500_000_000, { compact: true })).toBe('$1.5B')
  })
  it('respects MXN currency', () => {
    const result = fmtCurrency(1234.5, { currency: 'MXN' })
    expect(result).toContain('1,234.50')
  })
  it('respects 0 decimals', () => {
    expect(fmtCurrency(48000, { decimals: 0, currency: 'MXN' })).toContain('48,000')
  })
})

describe('fmtUSDCompact', () => {
  it('formats millions with USD suffix', () => {
    expect(fmtUSDCompact(67_000_000)).toBe('$67.0M USD')
  })
  it('formats thousands', () => {
    expect(fmtUSDCompact(15_420)).toBe('$15.4K USD')
  })
  it('formats small amounts', () => {
    expect(fmtUSDCompact(999)).toBe('$999.00 USD')
  })
  it('returns empty for null', () => {
    expect(fmtUSDCompact(null)).toBe('')
  })
})

describe('fmtUSD / fmtMXN', () => {
  it('fmtUSD formats with 2 decimals', () => {
    expect(fmtUSD(276603.31)).toBe('$276,603.31')
  })
  it('fmtMXN formats with MXN currency', () => {
    const result = fmtMXN(48000)
    expect(result).toContain('48,000.00')
  })
  it('fmtMXNInt rounds to integer', () => {
    const result = fmtMXNInt(48000.75)
    expect(result).toContain('48,001')
  })
})

describe('fmtMXNCompact', () => {
  it('formats millions with MXN suffix', () => {
    expect(fmtMXNCompact(5_600_000)).toBe('$5.6M MXN')
  })
  it('formats thousands', () => {
    expect(fmtMXNCompact(48_000)).toBe('$48K MXN')
  })
})

describe('fmtKg', () => {
  it('formats weight with es-MX locale', () => {
    const result = fmtKg(1234.5)
    expect(result).toBeTruthy()
    expect(result).not.toBe('')
  })
  it('returns empty for null', () => {
    expect(fmtKg(null)).toBe('')
  })
})

describe('fmtDate', () => {
  it('formats date in es-MX with America/Chicago timezone', () => {
    const result = fmtDate('2026-03-27T12:00:00Z')
    expect(result).toContain('27')
    expect(result).toContain('2026')
  })
  it('returns em-dash for null/undefined', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate(undefined)).toBe('—')
  })
  it('handles Date objects', () => {
    const result = fmtDate(new Date('2026-03-27T12:00:00Z'))
    expect(result).toContain('27')
  })
})

describe('fmtDateTime', () => {
  it('includes time component', () => {
    const result = fmtDateTime('2026-03-27T14:32:00Z')
    expect(result).toContain('27')
    expect(result).toContain('2026')
  })
  it('returns em-dash for falsy input', () => {
    expect(fmtDateTime(null)).toBe('—')
  })
})

describe('fmtDateShort / fmtDateCompact', () => {
  it('fmtDateShort returns short date', () => {
    const result = fmtDateShort('2026-03-27T12:00:00Z')
    expect(result).toContain('27')
  })
  it('fmtDateCompact returns compact date', () => {
    const result = fmtDateCompact('2026-03-27T12:00:00Z')
    expect(result).toContain('27')
  })
})

describe('fmtId', () => {
  it('replaces unicode dashes with hyphens', () => {
    expect(fmtId('TRF\u2013001')).toBe('TRF-001')
    expect(fmtId('TRF\u2014001')).toBe('TRF-001')
  })
  it('returns empty for null', () => {
    expect(fmtId(null)).toBe('')
  })
})

describe('fmtPedimento', () => {
  it('preserves correct format with spaces', () => {
    expect(fmtPedimento('26 24 3596 6500441')).toBe('26 24 3596 6500441')
  })
  it('inserts spaces into 16-digit compact format', () => {
    expect(fmtPedimento('2624359665004410')).toBe('26 24 3596 65004410')
  })
  it('returns 7-digit sequential as-is', () => {
    expect(fmtPedimento('6500441')).toBe('6500441')
  })
  it('returns empty for null', () => {
    expect(fmtPedimento(null)).toBe('')
  })
})

describe('fmtDesc', () => {
  it('title-cases descriptions', () => {
    expect(fmtDesc('RESINA DE POLIETILENO')).toBe('Resina de Polietileno')
  })
  it('preserves stop words in lowercase', () => {
    const result = fmtDesc('CAJAS DE CARTON')
    expect(result).toBe('Cajas de Carton')
  })
  it('returns empty for null', () => {
    expect(fmtDesc(null)).toBe('')
  })
})

describe('calcPriority', () => {
  it('scores high for missing pedimento', () => {
    const score = calcPriority({ pedimento: null })
    expect(score).toBeGreaterThanOrEqual(35)
  })
  it('scores higher for old shipments without clearance', () => {
    const oldDate = new Date(Date.now() - 20 * 86400000).toISOString()
    const score = calcPriority({ pedimento: null, estatus: 'En proceso', fecha_llegada: oldDate })
    expect(score).toBeGreaterThanOrEqual(65)
  })
  it('scores 0 for cleared shipment with pedimento', () => {
    const score = calcPriority({ pedimento: '26 24 3596 6500441', estatus: 'Cruzado' })
    expect(score).toBe(0)
  })
  it('adds value score for high-value shipments', () => {
    const score = calcPriority({ pedimento: '26 24 3596 6500441', importe_total: 150000 })
    expect(score).toBe(15)
  })
})

describe('priorityClass', () => {
  it('returns p-crit for 55+', () => {
    expect(priorityClass(55)).toBe('p-crit')
  })
  it('returns p-high for 25-54', () => {
    expect(priorityClass(30)).toBe('p-high')
  })
  it('returns p-norm for 1-24', () => {
    expect(priorityClass(10)).toBe('p-norm')
  })
  it('returns p-low for 0', () => {
    expect(priorityClass(0)).toBe('p-low')
  })
})

describe('pluralize', () => {
  it('returns singular for 1', () => {
    expect(pluralize(1, 'tráfico', 'tráficos')).toBe('tráfico')
  })
  it('returns plural for other counts', () => {
    expect(pluralize(5, 'tráfico', 'tráficos')).toBe('tráficos')
    expect(pluralize(0, 'tráfico', 'tráficos')).toBe('tráficos')
  })
})
