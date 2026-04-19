import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { AguilaInput } from '../AguilaInput'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

describe('AguilaInput', () => {
  it('renders label above input', () => {
    const html = renderToStaticMarkup(
      <AguilaInput label="Pedimento" name="pedimento" />,
    )
    expect(html).toMatch(/Pedimento/)
    expect(html).toMatch(/<label/)
    expect(html).toMatch(/<input/)
  })

  it('wires label htmlFor to input id', () => {
    const html = renderToStaticMarkup(
      <AguilaInput label="Fracción" id="frac-1" />,
    )
    expect(html).toMatch(/for="frac-1"/)
    expect(html).toMatch(/id="frac-1"/)
  })

  it('auto-generates id when not provided (label still paired)', () => {
    const html = renderToStaticMarkup(<AguilaInput label="X" />)
    // useId generates an id; both for= and id= should point at it
    const forMatch = html.match(/for="([^"]+)"/)
    const idMatch = html.match(/id="([^"]+)"/)
    expect(forMatch?.[1]).toBe(idMatch?.[1])
  })

  it('shows required indicator when required', () => {
    const html = renderToStaticMarkup(
      <AguilaInput label="Campo" required />,
    )
    expect(html).toMatch(/\*/)
    expect(html).toMatch(/required/)
  })

  it('renders hint under input when error absent', () => {
    const html = renderToStaticMarkup(
      <AguilaInput label="Campo" hint="Formato XXXX.XX.XX" />,
    )
    expect(html).toMatch(/Formato XXXX\.XX\.XX/)
  })

  it('renders error and aria-invalid when error present (replaces hint)', () => {
    const html = renderToStaticMarkup(
      <AguilaInput
        label="Campo"
        hint="Would not render"
        error="Inválido"
      />,
    )
    expect(html).toMatch(/Inválido/)
    expect(html).not.toMatch(/Would not render/)
    expect(html).toMatch(/aria-invalid="true"/)
    expect(html).toMatch(/role="alert"/)
  })

  it('applies portal-num class when mono=true', () => {
    const html = renderToStaticMarkup(
      <AguilaInput label="Pedimento" mono value="26 24 3596 6500441" readOnly />,
    )
    expect(html).toMatch(/portal-num/)
  })
})
