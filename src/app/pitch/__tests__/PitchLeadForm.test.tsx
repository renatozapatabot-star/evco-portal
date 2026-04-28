import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { PitchLeadForm } from '../PitchLeadForm'

type FetchMock = ReturnType<typeof vi.fn>
let fetchMock: FetchMock

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: { id: 'new-lead-1' }, error: null }),
  }))
  global.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PitchLeadForm', () => {
  it('disables submit until firm_name is ≥2 chars', () => {
    const { getByRole, getByLabelText } = render(<PitchLeadForm />)
    const submit = getByRole('button', { name: /Solicitar acceso/i })
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    const firm = getByLabelText(/Nombre de la empresa/i)
    fireEvent.change(firm, { target: { value: 'A' } })
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(firm, { target: { value: 'Acme' } })
    expect((submit as HTMLButtonElement).disabled).toBe(false)
  })

  it('posts to /api/leads with source=demo + source_url=/pitch', async () => {
    const { getByLabelText, getByRole } = render(<PitchLeadForm />)
    fireEvent.change(getByLabelText(/Nombre de la empresa/i), {
      target: { value: 'Acme SA' },
    })
    fireEvent.change(getByLabelText(/Su nombre/i), {
      target: { value: 'Juan García' },
    })
    fireEvent.click(getByRole('button', { name: /Solicitar acceso/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/leads')
    expect((init as RequestInit).method).toBe('POST')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.firm_name).toBe('Acme SA')
    expect(body.contact_name).toBe('Juan García')
    expect(body.source).toBe('demo')
    expect(body.source_url).toBe('/pitch')
  })

  it('shows the success card on 200 response', async () => {
    const { getByLabelText, getByRole, findByText } = render(<PitchLeadForm />)
    fireEvent.change(getByLabelText(/Nombre de la empresa/i), {
      target: { value: 'Acme SA' },
    })
    fireEvent.click(getByRole('button', { name: /Solicitar acceso/i }))
    const confirmation = await findByText(/Solicitud recibida/i)
    expect(confirmation).toBeTruthy()
  })

  it('surfaces a calm error when POST fails', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      json: async () => ({
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'insert_failed' },
      }),
    }))
    const { getByLabelText, getByRole, findByRole } = render(<PitchLeadForm />)
    fireEvent.change(getByLabelText(/Nombre de la empresa/i), {
      target: { value: 'Acme SA' },
    })
    fireEvent.click(getByRole('button', { name: /Solicitar acceso/i }))
    const alert = await findByRole('alert')
    expect(alert.textContent).toContain('No se pudo enviar')
  })

  it('surfaces the firm_name_required error with Spanish copy', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      json: async () => ({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'firm_name_required' },
      }),
    }))
    const { getByLabelText, getByRole, findByRole } = render(<PitchLeadForm />)
    fireEvent.change(getByLabelText(/Nombre de la empresa/i), {
      target: { value: 'AB' },
    })
    fireEvent.click(getByRole('button', { name: /Solicitar acceso/i }))
    const alert = await findByRole('alert')
    expect(alert.textContent).toContain(
      'Por favor ingrese el nombre de la empresa',
    )
  })

  it('trips the honeypot — fakes success without POSTing', async () => {
    const { container, getByLabelText, getByRole, findByText } = render(
      <PitchLeadForm />,
    )
    fireEvent.change(getByLabelText(/Nombre de la empresa/i), {
      target: { value: 'Acme' },
    })
    // Fill the hidden honeypot
    const honeypot = container.querySelector(
      'input[name="apellido_secundario"]',
    ) as HTMLInputElement
    expect(honeypot).toBeTruthy()
    fireEvent.change(honeypot, { target: { value: 'im-a-bot' } })
    fireEvent.click(getByRole('button', { name: /Solicitar acceso/i }))

    // Success state shows but fetch was never called
    await findByText(/Solicitud recibida/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
