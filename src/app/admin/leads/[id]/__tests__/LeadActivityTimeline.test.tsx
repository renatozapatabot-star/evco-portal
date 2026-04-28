import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor, act } from '@testing-library/react'
import { LeadActivityTimeline } from '../LeadActivityTimeline'
import type { LeadActivityRow } from '@/lib/leads/types'

type FetchMock = ReturnType<typeof vi.fn>
let fetchMock: FetchMock
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

const sample: LeadActivityRow[] = [
  {
    id: 'a1',
    lead_id: 'lead-1',
    kind: 'stage_change',
    summary: 'Etapa: Nuevo → Contactado',
    metadata: { from: 'new', to: 'contacted' },
    actor_user_id: null,
    actor_name: 'admin',
    occurred_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'a2',
    lead_id: 'lead-1',
    kind: 'call',
    summary: 'Llamada de intro — 15 min',
    metadata: null,
    actor_user_id: null,
    actor_name: 'admin',
    occurred_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  },
]

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 201,
    json: async () => ({
      data: {
        id: 'a-new',
        lead_id: 'lead-1',
        kind: 'note',
        summary: 'Nota nueva',
        metadata: null,
        actor_user_id: null,
        actor_name: 'admin',
        occurred_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
      error: null,
    }),
  }))
  global.fetch = fetchMock as unknown as typeof fetch
  refreshMock.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LeadActivityTimeline', () => {
  it('renders existing activities grouped with humanized day labels', () => {
    const { getByText } = render(
      <LeadActivityTimeline leadId="lead-1" initialActivities={sample} />,
    )
    expect(getByText('Etapa: Nuevo → Contactado')).toBeTruthy()
    expect(getByText('Llamada de intro — 15 min')).toBeTruthy()
    expect(getByText('Hoy')).toBeTruthy()
  })

  it('renders the empty state when there is no activity', () => {
    const { getByText } = render(
      <LeadActivityTimeline leadId="lead-1" initialActivities={[]} />,
    )
    expect(getByText(/Aún sin actividad/i)).toBeTruthy()
  })

  it('opens the entry form when "Registrar actividad" is clicked', () => {
    const { getByRole, queryByRole } = render(
      <LeadActivityTimeline leadId="lead-1" initialActivities={sample} />,
    )
    expect(queryByRole('button', { name: /Guardar/ })).toBeNull()
    fireEvent.click(getByRole('button', { name: /Registrar actividad/ }))
    expect(getByRole('button', { name: /Guardar/ })).toBeTruthy()
  })

  it('rejects empty summary without calling fetch', () => {
    const { getByRole, getByText } = render(
      <LeadActivityTimeline leadId="lead-1" initialActivities={sample} />,
    )
    fireEvent.click(getByRole('button', { name: /Registrar actividad/ }))
    fireEvent.click(getByRole('button', { name: /Guardar/ }))
    expect(getByText(/Escribe un resumen breve/i)).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs to /api/leads/:id/activities with kind + summary', async () => {
    const { getByRole, getByLabelText } = render(
      <LeadActivityTimeline leadId="lead-1" initialActivities={sample} />,
    )
    fireEvent.click(getByRole('button', { name: /Registrar actividad/ }))

    const kindSelect = getByLabelText(/Tipo/i) as HTMLSelectElement
    fireEvent.change(kindSelect, { target: { value: 'note' } })

    const summary = getByLabelText(/Resumen/i) as HTMLTextAreaElement
    fireEvent.change(summary, { target: { value: 'Nota nueva' } })

    await act(async () => {
      fireEvent.click(getByRole('button', { name: /^Guardar$/ }))
      await Promise.resolve()
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/leads/lead-1/activities')
    expect((init as RequestInit).method).toBe('POST')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.kind).toBe('note')
    expect(body.summary).toBe('Nota nueva')
  })

  it('prepends the new activity and flashes "Registrado" on success', async () => {
    const { getByRole, getByLabelText, findByText } = render(
      <LeadActivityTimeline leadId="lead-1" initialActivities={sample} />,
    )
    fireEvent.click(getByRole('button', { name: /Registrar actividad/ }))
    fireEvent.change(getByLabelText(/Resumen/i), {
      target: { value: 'Nota nueva' },
    })
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /^Guardar$/ }))
      await Promise.resolve()
      await Promise.resolve()
    })

    const fresh = await findByText('Nota nueva')
    expect(fresh).toBeTruthy()
    expect(refreshMock).toHaveBeenCalled()
  })

  it('surfaces the API error when POST fails', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'save_failed' },
      }),
    }))
    const { getByRole, getByLabelText, findByText } = render(
      <LeadActivityTimeline leadId="lead-1" initialActivities={sample} />,
    )
    fireEvent.click(getByRole('button', { name: /Registrar actividad/ }))
    fireEvent.change(getByLabelText(/Resumen/i), {
      target: { value: 'Nota nueva' },
    })
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /^Guardar$/ }))
      await Promise.resolve()
    })
    const err = await findByText(/save_failed/)
    expect(err).toBeTruthy()
    expect(refreshMock).not.toHaveBeenCalled()
  })
})
