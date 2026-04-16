import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { TimelineModal } from '../TimelineModal'

// Stub the inner timeline so we can assert modal wiring in isolation
vi.mock('../ActiveShipmentTimeline', () => ({
  ActiveShipmentTimeline: ({ shipment }: { shipment: unknown }) => (
    <div data-testid="timeline">
      {shipment ? 'has-shipment' : 'empty-calm'}
    </div>
  ),
}))

describe('TimelineModal', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('{}'))) as unknown as typeof fetch
  })

  afterEach(() => {
    cleanup()
    global.fetch = originalFetch
    document.body.style.overflow = ''
  })

  it('renders nothing when open=false', () => {
    const { container } = render(
      <TimelineModal open={false} onClose={() => {}} shipment={null} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the Próximo embarque title and inner timeline when open', () => {
    const { getByText, getByTestId, getByRole } = render(
      <TimelineModal
        open
        onClose={() => {}}
        shipment={{
          trafico: '9254-Y9999',
          estatus: 'Pedimento Pagado',
          fechaLlegada: '2026-05-01T15:00:00Z',
          pedimento: null,
        }}
      />,
    )
    expect(getByText('Próximo embarque')).toBeTruthy()
    expect(getByTestId('timeline').textContent).toBe('has-shipment')
    expect(getByRole('button', { name: 'Cerrar' })).toBeTruthy()
  })

  it('shows calm empty state when shipment is null', () => {
    const { getByTestId } = render(
      <TimelineModal open onClose={() => {}} shipment={null} />,
    )
    expect(getByTestId('timeline').textContent).toBe('empty-calm')
  })

  it('fires audit POST to /api/audit on open', async () => {
    render(
      <TimelineModal
        open
        onClose={() => {}}
        shipment={{ trafico: '9254-Z1', estatus: 'Cruzado', fechaLlegada: null, pedimento: null }}
      />,
    )
    // useEffect runs synchronously after mount in RTL
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/audit',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.event_type).toBe('timeline_modal_opened')
    expect(body.metadata.trafico_ref).toBe('9254-Z1')
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    const { getByRole } = render(
      <TimelineModal open onClose={onClose} shipment={null} />,
    )
    fireEvent.click(getByRole('button', { name: 'Cerrar' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <TimelineModal open onClose={onClose} shipment={null} />,
    )
    const backdrop = container.querySelector('[role="presentation"]') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('locks body scroll while open and restores on unmount', () => {
    const { unmount } = render(
      <TimelineModal open onClose={() => {}} shipment={null} />,
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
