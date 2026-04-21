import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { MorningBriefing } from '../MorningBriefing'

describe('MorningBriefing', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as unknown as typeof fetch
  })
  afterEach(() => {
    cleanup()
    global.fetch = originalFetch
  })

  it('renders nothing when briefing is null', () => {
    const { container } = render(<MorningBriefing briefing={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders greeting + briefing text', () => {
    const { getByText } = render(
      <MorningBriefing
        briefing={{
          id: 'brief-1',
          briefing_text: 'EVCO tiene 2 embarques activos esta semana. El ahorro T-MEC YTD suma $12,500 USD. No se requiere acción por ahora.',
          action_item: null,
          action_url: null,
          greeting_name: 'Ursula',
        }}
      />,
    )
    expect(getByText(/Buenos días, Ursula/)).toBeTruthy()
    expect(getByText(/EVCO tiene 2 embarques activos esta semana/)).toBeTruthy()
  })

  it('renders action button as <a> when action_item + action_url present', () => {
    const { getByRole } = render(
      <MorningBriefing
        briefing={{
          id: 'brief-2',
          briefing_text: 'Hay 3 expedientes incompletos para embarques que cruzan esta semana. Revisa Expedientes para completar. Tu próximo cruce es el viernes.',
          action_item: 'Revisar expedientes pendientes',
          action_url: '/expedientes',
          greeting_name: 'EVCO',
        }}
      />,
    )
    const link = getByRole('link', { name: /Revisar expedientes/ })
    expect(link.getAttribute('href')).toBe('/expedientes')
  })

  it('dismiss button hides the briefing + POSTs to the dismiss endpoint', () => {
    const { getByRole, queryByText } = render(
      <MorningBriefing
        briefing={{
          id: 'brief-3',
          briefing_text: 'Todo en calma. Sin actividad pendiente. Disfruta tu día.',
          action_item: null,
          action_url: null,
          greeting_name: 'Tito',
        }}
      />,
    )
    expect(queryByText(/Todo en calma/)).toBeTruthy()
    fireEvent.click(getByRole('button', { name: /Descartar briefing/ }))
    expect(queryByText(/Todo en calma/)).toBeNull()
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/briefings/brief-3/dismiss',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('tap target on dismiss button is ≥60px', () => {
    const { getByRole } = render(
      <MorningBriefing
        briefing={{
          id: 'x',
          briefing_text: 'x. x. x.',
          action_item: null,
          action_url: null,
          greeting_name: 'X',
        }}
      />,
    )
    const dismiss = getByRole('button', { name: /Descartar briefing/ }) as HTMLElement
    expect(dismiss.style.width).toBe('60px')
    expect(dismiss.style.height).toBe('60px')
  })
})
