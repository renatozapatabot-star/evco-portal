import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor, act } from '@testing-library/react'
import { LeadDetailClient } from '../LeadDetailClient'
import type { LeadRow } from '@/lib/leads/types'

type FetchMock = ReturnType<typeof vi.fn>
let fetchMock: FetchMock
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

const baseLead: LeadRow = {
  id: 'lead-1',
  firm_name: 'Acme SA',
  contact_name: 'Juan García',
  contact_title: null,
  contact_email: 'juan@acme.mx',
  contact_phone: null,
  rfc: null,
  source: 'cold-email',
  source_campaign: 'tuesday-2026-04-21',
  source_url: null,
  stage: 'new',
  stage_changed_at: '2026-04-21T00:00:00Z',
  priority: 'normal',
  value_monthly_mxn: null,
  last_contact_at: null,
  next_action_at: null,
  next_action_note: null,
  industry: null,
  aduana: null,
  volume_note: null,
  notes: null,
  owner_user_id: null,
  created_at: '2026-04-21T00:00:00Z',
  updated_at: '2026-04-21T00:00:00Z',
}

beforeEach(() => {
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {}
    return {
      ok: true,
      json: async () => ({
        data: { ...baseLead, ...body },
        error: null,
      }),
    }
  })
  global.fetch = fetchMock as unknown as typeof fetch
  refreshMock.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LeadDetailClient', () => {
  it('renders the current stage pill as active (primary variant)', () => {
    const { getByRole } = render(<LeadDetailClient initialLead={baseLead} />)
    const newPill = getByRole('button', { name: /^Nuevo$/ })
    expect(newPill.className).toMatch(/portal-btn--primary/)

    const contactedPill = getByRole('button', { name: /^Contactado$/ })
    expect(contactedPill.className).toMatch(/portal-btn--ghost/)
  })

  it('patches the stage when a pill is clicked', async () => {
    const { getByRole } = render(<LeadDetailClient initialLead={baseLead} />)
    fireEvent.click(getByRole('button', { name: /Demo visto/ }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/leads/lead-1')
    expect((init as RequestInit).method).toBe('PATCH')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({ stage: 'demo-viewed' })
  })

  it('autosaves contact_name on blur', async () => {
    const { getByLabelText } = render(<LeadDetailClient initialLead={baseLead} />)
    const field = getByLabelText(/Nombre del contacto/i)
    fireEvent.change(field, { target: { value: 'María Pérez' } })
    fireEvent.blur(field)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(body).toEqual({ contact_name: 'María Pérez' })
  })

  it('coerces value_monthly_mxn to Number on blur', async () => {
    const { getByLabelText } = render(<LeadDetailClient initialLead={baseLead} />)
    const field = getByLabelText(/Valor mensual estimado/i)
    fireEvent.change(field, { target: { value: '42000' } })
    fireEvent.blur(field)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(body).toEqual({ value_monthly_mxn: 42000 })
  })

  it('sends null for cleared value_monthly_mxn', async () => {
    const leadWithValue: LeadRow = { ...baseLead, value_monthly_mxn: 15000 }
    const { getByLabelText } = render(<LeadDetailClient initialLead={leadWithValue} />)
    const field = getByLabelText(/Valor mensual estimado/i)
    fireEvent.change(field, { target: { value: '' } })
    fireEvent.blur(field)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    )
    expect(body).toEqual({ value_monthly_mxn: null })
  })

  it('uppercases RFC input on change', () => {
    const { getByLabelText } = render(<LeadDetailClient initialLead={baseLead} />)
    const rfc = getByLabelText(/^RFC$/) as HTMLInputElement
    fireEvent.change(rfc, { target: { value: 'aaa010101abc' } })
    expect(rfc.value).toBe('AAA010101ABC')
  })

  it('shows calm red error banner on PATCH failure', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      json: async () => ({
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'update_failed' },
      }),
    }))
    const { getByRole, findByText } = render(<LeadDetailClient initialLead={baseLead} />)
    fireEvent.click(getByRole('button', { name: /Demo visto/ }))
    const err = await findByText(/Error: update_failed/)
    expect(err).toBeTruthy()
  })

  it('calls router.refresh after successful PATCH', async () => {
    const { getByRole } = render(<LeadDetailClient initialLead={baseLead} />)
    fireEvent.click(getByRole('button', { name: /Demo visto/ }))
    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('flashes "Guardado" badge after successful save, fades after 1.4s', async () => {
    vi.useFakeTimers()
    const { getByLabelText, queryByText } = render(
      <LeadDetailClient initialLead={baseLead} />,
    )
    const field = getByLabelText(/Nombre del contacto/i)
    fireEvent.change(field, { target: { value: 'X' } })

    await act(async () => {
      fireEvent.blur(field)
      // Drain the fetch + setState microtasks
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(queryByText('Guardado')).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(queryByText('Guardado')).toBeNull()
    vi.useRealTimers()
  })
})
