import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ActiveShipmentTimeline } from '../ActiveShipmentTimeline'

// Stub GlassCard so tests don't need aguila CSS tokens
vi.mock('@/components/aguila/GlassCard', () => ({
  GlassCard: ({ children }: { children: React.ReactNode }) => <div data-testid="glass">{children}</div>,
}))

describe('ActiveShipmentTimeline', () => {
  it('renders calm empty state when no shipment', () => {
    const { getByText } = render(<ActiveShipmentTimeline shipment={null} />)
    expect(getByText(/Tu operación está en calma/)).toBeTruthy()
  })

  it('renders 5 steps with the trafico reference and translated estatus', () => {
    const { getByText, container } = render(
      <ActiveShipmentTimeline
        shipment={{
          trafico: '9254-Z1234',
          estatus: 'Pedimento Pagado',
          fechaLlegada: null,
          pedimento: '26 24 3596 1234567',
        }}
      />,
    )
    expect(getByText('9254-Z1234')).toBeTruthy()
    expect(getByText('Pagado')).toBeTruthy()
    // 5 step labels rendered
    expect(getByText('Documentos')).toBeTruthy()
    expect(getByText('Clasificación')).toBeTruthy()
    expect(getByText('Pedimento')).toBeTruthy()
    expect(getByText('Cruce')).toBeTruthy()
    expect(getByText('Entregado')).toBeTruthy()
    // 3 completed checkmarks (steps 1,2,3 before current=4)
    expect(container.querySelectorAll('li').length).toBe(5)
  })

  it('renders the ETA line formatted in es-MX when fecha_llegada present', () => {
    const { getByText } = render(
      <ActiveShipmentTimeline
        shipment={{
          trafico: '9254-Z9999',
          estatus: 'Cruzado',
          fechaLlegada: '2026-05-01T15:30:00Z',
          pedimento: null,
        }}
      />,
    )
    expect(getByText(/Llegada prevista:/)).toBeTruthy()
  })
})
