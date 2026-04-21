import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { AguilaSelect } from '../AguilaSelect'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

describe('AguilaSelect', () => {
  it('renders flat options list', () => {
    const html = renderToStaticMarkup(
      <AguilaSelect
        label="Cliente"
        options={[
          { value: 'evco', label: 'EVCO' },
          { value: 'mafesa', label: 'MAFESA' },
        ]}
      />,
    )
    expect(html).toMatch(/<select/)
    expect(html).toMatch(/<option value="evco">EVCO<\/option>/)
    expect(html).toMatch(/<option value="mafesa">MAFESA<\/option>/)
  })

  it('renders placeholder as disabled first option when value unset', () => {
    const html = renderToStaticMarkup(
      <AguilaSelect
        label="Cliente"
        placeholder="Selecciona un cliente"
        options={[{ value: 'evco', label: 'EVCO' }]}
      />,
    )
    expect(html).toMatch(/Selecciona un cliente/)
    expect(html).toMatch(/<option value="" disabled/)
  })

  it('suppresses placeholder when a value is supplied', () => {
    const html = renderToStaticMarkup(
      <AguilaSelect
        label="Cliente"
        placeholder="Selecciona"
        value="evco"
        onChange={() => {}}
        options={[{ value: 'evco', label: 'EVCO' }]}
      />,
    )
    // Placeholder still in DOM as value is on select; placeholder omitted
    expect(html).not.toMatch(/<option value="" disabled/)
  })

  it('renders grouped options via <optgroup>', () => {
    const html = renderToStaticMarkup(
      <AguilaSelect
        label="Régimen"
        groups={[
          {
            label: 'Definitiva',
            options: [
              { value: 'A1', label: 'A1 — Definitiva' },
              { value: 'IN', label: 'IN — Franquicia' },
            ],
          },
          {
            label: 'Temporal',
            options: [{ value: 'IT', label: 'IT — Temporal' }],
          },
        ]}
      />,
    )
    expect(html).toMatch(/<optgroup label="Definitiva">/)
    expect(html).toMatch(/<optgroup label="Temporal">/)
    expect(html).toMatch(/A1 — Definitiva/)
  })

  it('shows error in aria-invalid + role alert', () => {
    const html = renderToStaticMarkup(
      <AguilaSelect
        label="Cliente"
        error="Requerido"
        options={[{ value: 'evco', label: 'EVCO' }]}
      />,
    )
    expect(html).toMatch(/aria-invalid="true"/)
    expect(html).toMatch(/role="alert"/)
    expect(html).toMatch(/Requerido/)
  })
})
