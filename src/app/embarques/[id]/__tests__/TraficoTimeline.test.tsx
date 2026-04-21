/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { TraficoTimeline } from '../TraficoTimeline'
import { computeMilestones, type TimelineInput } from '../timeline-logic'

afterEach(cleanup)

function fixture(overrides: Partial<TimelineInput> = {}): TimelineInput {
  return {
    trafico_id: '6500441',
    created_at: '2026-04-01T12:00:00Z',
    fecha_llegada: '2026-04-03T08:00:00Z',
    fecha_cruce: null,
    pedimento_number: '26 24 3596 6500441',
    estatus: 'Pedimento Pagado',
    semaforo: null,
    entradas: [
      { fecha_ingreso: '2026-04-02T09:00:00Z', fecha_llegada_mercancia: '2026-04-03T14:00:00Z' },
    ],
    docs_count: 3,
    required_docs_count: 3,
    uploaded_required_count: 3,
    facturas: [{ fecha_pago: '2026-04-12T10:00:00Z' }],
    ...overrides,
  }
}

describe('TraficoTimeline (horizontal) — contract tests', () => {
  it('renders all 7 milestones as buttons in a single horizontal rail', () => {
    const { container } = render(<TraficoTimeline input={fixture()} />)
    const rail = container.querySelector('[data-testid="trafico-timeline-horizontal"]')
    expect(rail).not.toBeNull()
    const buttons = container.querySelectorAll('button[aria-label*="—"]')
    expect(buttons.length).toBe(7)
  })

  it('marks the active milestone with aria-current="step"', () => {
    render(<TraficoTimeline input={fixture()} />)
    const active = screen.getAllByRole('button').filter(b => b.getAttribute('aria-current') === 'step')
    // Fixture: docs complete, pedimento paid, no fecha_cruce → "cross" is active.
    expect(active).toHaveLength(1)
    expect(active[0].getAttribute('aria-label')).toContain('Cruce de frontera')
  })

  it('tapping a node opens the detail drawer with the milestone label', () => {
    render(<TraficoTimeline input={fixture()} />)
    const crucePedimento = screen.getByRole('button', { name: /Pedimento pagado/i })
    fireEvent.click(crucePedimento)
    // Drawer appears as a dialog
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-label')).toContain('Pedimento pagado')
  })

  it('blocked status renders when semaforo=2 and pedimento paid but no cruce', () => {
    const input = fixture({ semaforo: 2 })
    const milestones = computeMilestones(input)
    const cross = milestones.find(m => m.key === 'cross')
    expect(cross?.status).toBe('blocked')
  })

  it('renders abbreviated labels on narrow viewports', () => {
    render(<TraficoTimeline input={fixture()} />)
    // labelShort values come through — e.g. "Pedim." instead of "Pedimento pagado"
    expect(screen.getByText('Pedim.')).toBeTruthy()
    expect(screen.getByText('Creado')).toBeTruthy()
    expect(screen.getByText('Cruce')).toBeTruthy()
  })

  it('rail container has no horizontal overflow-inducing styles', () => {
    const { container } = render(<TraficoTimeline input={fixture()} />)
    const rail = container.querySelector('.trafico-timeline-rail') as HTMLElement
    expect(rail).toBeTruthy()
    const style = rail.getAttribute('style') ?? ''
    // Must use space-between or ensure flexbox fits in viewport
    expect(style).toMatch(/justify-content:\s*space-between/)
    expect(style).toMatch(/width:\s*100%/)
  })
})

describe('computeMilestones (shared logic contract)', () => {
  it('always returns exactly 7 milestones', () => {
    const out = computeMilestones(fixture())
    expect(out).toHaveLength(7)
    expect(out.map(m => m.key)).toEqual([
      'created', 'route', 'warehouse', 'docs', 'pedimento', 'cross', 'invoice',
    ])
  })

  it('pending milestones never expose href (navigation is completed/active only)', () => {
    const out = computeMilestones(fixture({ fecha_cruce: null, facturas: [], pedimento_number: null }))
    const pending = out.filter(m => m.status === 'pending')
    for (const m of pending) expect(m.href).toBeUndefined()
  })
})
