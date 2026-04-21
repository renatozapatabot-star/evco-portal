import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { KPITile, isNumericValue } from '../KPITile'

describe('isNumericValue', () => {
  it('numeric + currency + percentage + dash values count as numeric', () => {
    expect(isNumericValue(30)).toBe(true)
    expect(isNumericValue('30')).toBe(true)
    expect(isNumericValue('$12,400 USD')).toBe(false) // has letters (USD)
    expect(isNumericValue('$12,400')).toBe(true)
    expect(isNumericValue('17.2623')).toBe(true)
    expect(isNumericValue('—')).toBe(true)
    expect(isNumericValue('-')).toBe(true)
    expect(isNumericValue('12:30')).toBe(true)
    expect(isNumericValue('85%')).toBe(true)
    expect(isNumericValue('')).toBe(true) // empty coerces to mono (no wrap concern)
  })

  it('prose values are NOT numeric', () => {
    expect(isNumericValue('hace 36 días')).toBe(false)
    expect(isNumericValue('Sin cruces aún')).toBe(false)
    expect(isNumericValue('Último cruce')).toBe(false)
    expect(isNumericValue('En proceso')).toBe(false)
    expect(isNumericValue('Entregado')).toBe(false)
  })
})

describe('KPITile font selection', () => {
  function getValueSpan(container: HTMLElement): HTMLElement {
    const span = container.querySelector('[data-value-font]')
    if (!span) throw new Error('value span not found')
    return span as HTMLElement
  }

  it('numeric value → data-value-font="mono"', () => {
    const { container } = render(<KPITile label="Días" value={30} />)
    expect(getValueSpan(container).getAttribute('data-value-font')).toBe('mono')
  })

  it('currency value ("$12,400") → mono', () => {
    const { container } = render(<KPITile label="Ahorro" value="$12,400" />)
    expect(getValueSpan(container).getAttribute('data-value-font')).toBe('mono')
  })

  it('em-dash placeholder → mono', () => {
    const { container } = render(<KPITile label="Pendiente" value="—" />)
    expect(getValueSpan(container).getAttribute('data-value-font')).toBe('mono')
  })

  it('relative-time prose ("hace 36 días") → sans', () => {
    const { container } = render(<KPITile label="Último cruce" value="hace 36 días" />)
    expect(getValueSpan(container).getAttribute('data-value-font')).toBe('sans')
  })

  it('label prose ("Sin cruces aún") → sans', () => {
    const { container } = render(<KPITile label="Último cruce" value="Sin cruces aún" />)
    expect(getValueSpan(container).getAttribute('data-value-font')).toBe('sans')
  })

  it('value span has nowrap + ellipsis so it cannot wrap across lines', () => {
    const { container } = render(<KPITile label="Último cruce" value="hace 36 días" />)
    const span = getValueSpan(container)
    expect(span.style.whiteSpace).toBe('nowrap')
    expect(span.style.textOverflow).toBe('ellipsis')
    expect(span.style.overflow).toBe('hidden')
  })
})
