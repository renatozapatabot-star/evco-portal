import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor, act } from '@testing-library/react'
import { LeadConvertCard } from '../LeadConvertCard'
import type { LeadRow } from '@/lib/leads/types'

type FetchMock = ReturnType<typeof vi.fn>
let fetchMock: FetchMock
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

const baseLead: LeadRow = {
  id: 'lead-1',
  firm_name: 'Acme SA de CV',
  contact_name: 'Juan García',
  contact_title: null,
  contact_email: 'juan@acme.mx',
  contact_phone: null,
  rfc: null,
  source: 'cold-email',
  source_campaign: null,
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
  client_code_assigned: null,
  converted_at: null,
}

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 201,
    json: async () => ({
      data: {
        lead: {
          ...baseLead,
          stage: 'won',
          client_code_assigned: 'acme-sa-de-cv',
          converted_at: '2026-04-21T16:00:00Z',
        },
        company_id: 'acme-sa-de-cv',
        already_converted: false,
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

describe('LeadConvertCard', () => {
  it('does not render when lead is not won + not converted', () => {
    const { container } = render(<LeadConvertCard lead={baseLead} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the conversion form when stage=won + not converted', () => {
    const lead: LeadRow = { ...baseLead, stage: 'won' }
    const { getByLabelText, getByRole } = render(<LeadConvertCard lead={lead} />)
    expect(getByLabelText(/company_id/i)).toBeTruthy()
    expect(getByLabelText(/Clave GlobalPC/i)).toBeTruthy()
    expect(getByRole('button', { name: /Crear tenant/ })).toBeTruthy()
  })

  it('auto-slugifies firm_name into company_id', () => {
    const lead: LeadRow = { ...baseLead, stage: 'won' }
    const { getByLabelText } = render(<LeadConvertCard lead={lead} />)
    const slug = getByLabelText(/company_id/i) as HTMLInputElement
    expect(slug.value).toBe('acme-sa-de-cv')
  })

  it('POSTs to /convert with the form values', async () => {
    const lead: LeadRow = { ...baseLead, stage: 'won' }
    const { getByLabelText, getByRole } = render(<LeadConvertCard lead={lead} />)

    fireEvent.change(getByLabelText(/Clave GlobalPC/i), {
      target: { value: '9254' },
    })

    await act(async () => {
      fireEvent.click(getByRole('button', { name: /Crear tenant/ }))
      await Promise.resolve()
    })

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/leads/lead-1/convert')
    expect((init as RequestInit).method).toBe('POST')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.company_id).toBe('acme-sa-de-cv')
    expect(body.clave_cliente).toBe('9254')
    expect(body.language).toBe('es')
  })

  it('strips non-digits from clave_cliente input', () => {
    const lead: LeadRow = { ...baseLead, stage: 'won' }
    const { getByLabelText } = render(<LeadConvertCard lead={lead} />)
    const clave = getByLabelText(/Clave GlobalPC/i) as HTMLInputElement
    fireEvent.change(clave, { target: { value: '92ab54' } })
    expect(clave.value).toBe('9254')
  })

  it('shows the success banner when the lead is already converted', () => {
    const lead: LeadRow = {
      ...baseLead,
      stage: 'won',
      client_code_assigned: 'acme-sa',
      converted_at: '2026-04-21T16:00:00Z',
    }
    const { getByText } = render(<LeadConvertCard lead={lead} />)
    expect(getByText(/Cliente activo/i)).toBeTruthy()
    expect(getByText('acme-sa')).toBeTruthy()
    expect(getByText(/Ver en monitor/i)).toBeTruthy()
  })

  it('surfaces a calm API error on conversion failure', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        data: null,
        error: { code: 'CONFLICT', message: 'company_id_already_exists' },
      }),
    }))
    const lead: LeadRow = { ...baseLead, stage: 'won' }
    const { getByRole, findByText } = render(<LeadConvertCard lead={lead} />)
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /Crear tenant/ }))
      await Promise.resolve()
    })
    const err = await findByText(/company_id_already_exists/)
    expect(err).toBeTruthy()
  })

  it('warns on invalid slug without hitting the server', () => {
    const lead: LeadRow = { ...baseLead, stage: 'won' }
    const { getByLabelText, getByText, getByRole } = render(
      <LeadConvertCard lead={lead} />,
    )
    fireEvent.change(getByLabelText(/company_id/i), {
      target: { value: 'ab' }, // too short
    })
    expect(getByText(/debe tener 3–40 caracteres/i)).toBeTruthy()
    const btn = getByRole('button', { name: /Crear tenant/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
