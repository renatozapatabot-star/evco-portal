import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { AguilaDataTable } from '../AguilaDataTable'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

interface Row extends Record<string, unknown> {
  id: string
  pedimento: string
  fraccion: string
  valor: number | null
  semaforo: 0 | 1 | 2 | null
  estado: string | null
}

const rows: Row[] = [
  {
    id: 'a',
    pedimento: '26 24 3596 6500441',
    fraccion: '3901.20.01',
    valor: 15420.0,
    semaforo: 0,
    estado: 'cruzado',
  },
  {
    id: 'b',
    pedimento: 'not-valid',
    fraccion: '39012002',
    valor: null,
    semaforo: null,
    estado: null,
  },
]

describe('AguilaDataTable', () => {
  it('preserves pedimento spaces through the pedimento column type', () => {
    const html = renderToStaticMarkup(
      <AguilaDataTable<Row>
        columns={[{ key: 'pedimento', label: 'Pedimento', type: 'pedimento' }]}
        rows={rows}
      />,
    )
    expect(html).toMatch(/26 24 3596 6500441/)
  })

  it('preserves fracción dots and NICO variants', () => {
    const html = renderToStaticMarkup(
      <AguilaDataTable<Row>
        columns={[{ key: 'fraccion', label: 'Fracción', type: 'fraccion' }]}
        rows={rows}
      />,
    )
    expect(html).toMatch(/3901\.20\.01/)
    expect(html).toMatch(/3901\.20\.02/) // bare 8-digit was formatted
  })

  it('formats currency with MXN and falls back to em-dash on null', () => {
    const html = renderToStaticMarkup(
      <AguilaDataTable<Row>
        columns={[
          { key: 'valor', label: 'Valor', type: 'currency', currency: 'MXN' },
        ]}
        rows={rows}
      />,
    )
    expect(html).toMatch(/\$15,420/)
    expect(html).toMatch(/—/) // em-dash from renderNull
  })

  it('right-aligns currency columns by default', () => {
    const html = renderToStaticMarkup(
      <AguilaDataTable<Row>
        columns={[
          { key: 'valor', label: 'Valor', type: 'currency', currency: 'MXN' },
        ]}
        rows={rows}
      />,
    )
    expect(html).toMatch(/<td class="num"/)
  })

  it('renders SemaforoPill for semaforo column', () => {
    const html = renderToStaticMarkup(
      <AguilaDataTable<Row>
        columns={[{ key: 'semaforo', label: 'Semáforo', type: 'semaforo' }]}
        rows={rows}
      />,
    )
    expect(html).toMatch(/aria-label="Semáforo: Verde"/)
    expect(html).toMatch(/aria-label="Semáforo: Sin revisión"/)
  })

  it('renders StatusBadge for status column', () => {
    const html = renderToStaticMarkup(
      <AguilaDataTable<Row>
        columns={[{ key: 'estado', label: 'Estado', type: 'status' }]}
        rows={rows}
      />,
    )
    expect(html).toMatch(/Cruzado/) // StatusBadge label for 'cruzado'
    expect(html).toMatch(/—/) // null row falls through to renderNull
  })

  it('shows default empty state when rows is empty', () => {
    const html = renderToStaticMarkup(
      <AguilaDataTable<Row>
        columns={[{ key: 'pedimento', label: 'Pedimento', type: 'pedimento' }]}
        rows={[]}
      />,
    )
    expect(html).toMatch(/Sin resultados/)
    expect(html).not.toMatch(/<table/)
  })

  it('supports custom renderers via type="custom"', () => {
    const html = renderToStaticMarkup(
      <AguilaDataTable<Row>
        columns={[
          {
            key: 'id',
            label: 'ID',
            type: 'custom',
            render: (row) => <span>{`custom:${row.id}`}</span>,
          },
        ]}
        rows={rows}
      />,
    )
    expect(html).toMatch(/custom:a/)
    expect(html).toMatch(/custom:b/)
  })
})
