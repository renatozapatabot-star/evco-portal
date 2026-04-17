/**
 * Cell-renderer unit tests. Verifies every helper covers null, empty,
 * valid, and edge-case inputs. Rendering is verified via textContent +
 * aria attributes so the tests don't depend on style implementation.
 */

import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  renderNull,
  renderPending,
  renderEmpty,
  renderZero,
  renderDate,
  renderCurrency,
  renderNumber,
  renderTrafico,
  renderPedimento,
  renderFraccion,
  renderProveedor,
  renderTransporte,
} from '@/lib/ui/cell-renderers'

function html(node: React.ReactNode): string {
  return renderToStaticMarkup(node as React.ReactElement)
}

describe('renderNull', () => {
  it('renders the canonical em-dash with aria-label', () => {
    const out = html(renderNull())
    expect(out).toContain('—')
    expect(out).toMatch(/aria-label="Sin datos"/)
  })
})

describe('renderPending', () => {
  it('renders italic "pendiente" by default', () => {
    const out = html(renderPending())
    expect(out).toContain('pendiente')
    expect(out).toMatch(/italic/)
  })

  it('accepts a custom label', () => {
    const out = html(renderPending('por asignar'))
    expect(out).toContain('por asignar')
  })
})

describe('renderEmpty', () => {
  it('renders custom empty message', () => {
    const out = html(renderEmpty('Sin operaciones'))
    expect(out).toContain('Sin operaciones')
  })

  it('defaults to "Sin datos"', () => {
    const out = html(renderEmpty())
    expect(out).toContain('Sin datos')
  })
})

describe('renderZero', () => {
  it('renders a monospace 0', () => {
    const out = html(renderZero())
    expect(out).toContain('0')
  })
})

describe('renderDate', () => {
  it('renders null for undefined/null/empty input', () => {
    expect(html(renderDate(null))).toContain('—')
    expect(html(renderDate(undefined))).toContain('—')
    expect(html(renderDate(''))).toContain('—')
  })

  it('renders null for invalid date strings', () => {
    expect(html(renderDate('not-a-date'))).toContain('—')
  })

  it('formats valid ISO dates in es-MX', () => {
    const out = html(renderDate('2026-04-17T18:00:00.000Z'))
    // es-MX uses dd/mm/yyyy in America/Chicago (CST = UTC-6 on Apr 17)
    expect(out).toMatch(/17\/04\/2026/)
  })

  it('includes time when requested', () => {
    const out = html(renderDate('2026-04-17T18:00:00.000Z', { includeTime: true }))
    expect(out).toMatch(/:/)
  })
})

describe('renderCurrency', () => {
  it('renders null for missing/invalid', () => {
    expect(html(renderCurrency(null, 'USD'))).toContain('—')
    expect(html(renderCurrency(undefined, 'MXN'))).toContain('—')
    expect(html(renderCurrency(Number.NaN, 'USD'))).toContain('—')
    expect(html(renderCurrency(Infinity, 'USD'))).toContain('—')
  })

  it('renders zero as the zero-sentinel', () => {
    expect(html(renderCurrency(0, 'USD'))).toContain('0')
  })

  it('formats USD in es-MX locale', () => {
    const out = html(renderCurrency(1500.5, 'USD'))
    expect(out).toContain('1,500.50')
  })

  it('formats MXN in es-MX locale', () => {
    const out = html(renderCurrency(25000, 'MXN'))
    expect(out).toContain('25,000.00')
  })
})

describe('renderNumber', () => {
  it('renders null for null/NaN', () => {
    expect(html(renderNumber(null))).toContain('—')
    expect(html(renderNumber(Number.NaN))).toContain('—')
  })

  it('renders zero as zero-sentinel', () => {
    expect(html(renderNumber(0))).toContain('0')
  })

  it('formats with grouping separator', () => {
    expect(html(renderNumber(1234567))).toContain('1,234,567')
  })

  it('honors decimals option', () => {
    expect(html(renderNumber(3.14159, { decimals: 2 }))).toContain('3.14')
  })
})

describe('renderTrafico', () => {
  it('renders null when blank', () => {
    expect(html(renderTrafico(null))).toContain('—')
    expect(html(renderTrafico(''))).toContain('—')
    expect(html(renderTrafico('   '))).toContain('—')
  })

  it('renders the id trimmed', () => {
    expect(html(renderTrafico(' 26-05001  '))).toContain('26-05001')
  })
})

describe('renderPedimento', () => {
  it('renders null when blank', () => {
    expect(html(renderPedimento(null))).toContain('—')
  })

  it('formats a valid 15-digit pedimento with spaces', () => {
    expect(html(renderPedimento('2624359665004410'.slice(0, 15)))).toContain(
      '26 24 3596 6500441',
    )
  })

  it('preserves existing spaces in already-formatted pedimento', () => {
    expect(html(renderPedimento('26 24 3596 6500441'))).toContain(
      '26 24 3596 6500441',
    )
  })

  it('renders pending for malformed inputs', () => {
    expect(html(renderPedimento('12345'))).toContain('pendiente')
  })
})

describe('renderFraccion', () => {
  it('renders null when blank', () => {
    expect(html(renderFraccion(null))).toContain('—')
  })

  it('formats a bare 8-digit fracción with dots', () => {
    expect(html(renderFraccion('39012001'))).toContain('3901.20.01')
  })

  it('preserves dots in already-formatted fracción', () => {
    expect(html(renderFraccion('3901.20.01'))).toContain('3901.20.01')
  })

  it('renders null for invalid shapes', () => {
    expect(html(renderFraccion('ABC'))).toContain('—')
  })
})

describe('renderProveedor', () => {
  it('prefers a real name over a PRV_ code', () => {
    expect(html(renderProveedor('Milacron LLC', 'PRV_123'))).toContain('Milacron LLC')
  })

  it('falls back to code when name is missing', () => {
    expect(html(renderProveedor(null, 'DURATECH'))).toContain('DURATECH')
  })

  it('renders pending when only PRV_ code exists', () => {
    expect(html(renderProveedor(null, 'PRV_456'))).toContain('pendiente')
  })

  it('renders null when both are missing', () => {
    expect(html(renderProveedor(null, null))).toContain('—')
  })
})

describe('renderTransporte', () => {
  it('renders both carriers when different', () => {
    const out = html(renderTransporte('US Line', 'MX Line'))
    expect(out).toContain('US Line')
    expect(out).toContain('MX Line')
  })

  it('dedupes when US and MX are the same', () => {
    const out = html(renderTransporte('Same Line', 'Same Line'))
    expect((out.match(/Same Line/g) ?? []).length).toBe(1)
  })

  it('falls back to whichever side exists', () => {
    expect(html(renderTransporte('US Only', null))).toContain('US Only')
    expect(html(renderTransporte(null, 'MX Only'))).toContain('MX Only')
  })

  it('renders pending when both are missing', () => {
    expect(html(renderTransporte(null, null))).toContain('pendiente')
  })
})
