import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { AguilaCheckbox } from '../AguilaCheckbox'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

describe('AguilaCheckbox', () => {
  it('renders checkbox with inline label', () => {
    const html = renderToStaticMarkup(
      <AguilaCheckbox label="Acepto los términos" />,
    )
    expect(html).toMatch(/type="checkbox"/)
    expect(html).toMatch(/Acepto los términos/)
    expect(html).toMatch(/<label/)
  })

  it('renders hint under label when provided', () => {
    const html = renderToStaticMarkup(
      <AguilaCheckbox
        label="T-MEC elegible"
        hint="Basado en fracción arancelaria"
      />,
    )
    expect(html).toMatch(/Basado en fracción arancelaria/)
  })

  it('wires label htmlFor to checkbox id', () => {
    const html = renderToStaticMarkup(
      <AguilaCheckbox label="Check" id="c1" />,
    )
    expect(html).toMatch(/for="c1"/)
    expect(html).toMatch(/id="c1"/)
  })

  it('auto-generates id when not provided', () => {
    const html = renderToStaticMarkup(<AguilaCheckbox label="X" />)
    const forMatch = html.match(/for="([^"]+)"/)
    const idMatch = html.match(/id="([^"]+)"/)
    expect(forMatch?.[1]).toBe(idMatch?.[1])
  })

  it('respects disabled prop', () => {
    const html = renderToStaticMarkup(
      <AguilaCheckbox label="X" disabled />,
    )
    expect(html).toMatch(/disabled/)
  })

  it('renders checked state', () => {
    const html = renderToStaticMarkup(
      <AguilaCheckbox label="X" defaultChecked />,
    )
    expect(html).toMatch(/checked/)
  })
})
