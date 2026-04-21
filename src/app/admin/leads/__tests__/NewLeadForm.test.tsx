import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { NewLeadForm } from '../NewLeadForm'

type FetchMock = ReturnType<typeof vi.fn>
let fetchMock: FetchMock
const refreshMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ data: { id: 'new-lead' }, error: null }),
  }))
  global.fetch = fetchMock as unknown as typeof fetch
  refreshMock.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NewLeadForm', () => {
  it('starts collapsed and renders the "Nuevo lead" trigger', () => {
    const { getByRole, queryByLabelText } = render(<NewLeadForm />)
    const trigger = getByRole('button', { name: /Nuevo lead/i })
    expect(trigger).toBeTruthy()
    expect(queryByLabelText(/Firma/i)).toBeNull()
  })

  it('expands on trigger click, reveals Firma input', () => {
    const { getByRole, getByLabelText } = render(<NewLeadForm />)
    fireEvent.click(getByRole('button', { name: /Nuevo lead/i }))
    expect(getByLabelText(/Firma/i)).toBeTruthy()
  })

  it('disables save until firm name has ≥2 chars', () => {
    const { getByRole, getByLabelText, getAllByRole } = render(<NewLeadForm />)
    fireEvent.click(getByRole('button', { name: /Nuevo lead/i }))
    const saveBtns = getAllByRole('button', { name: /Guardar lead/i })
    const saveBtn = saveBtns[0] as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)

    fireEvent.change(getByLabelText(/Firma/i), { target: { value: 'A' } })
    expect(saveBtn.disabled).toBe(true)

    fireEvent.change(getByLabelText(/Firma/i), { target: { value: 'Acme' } })
    expect(saveBtn.disabled).toBe(false)
  })

  it('posts with source=referral + source_campaign=manual-admin-entry on submit', async () => {
    const { getByRole, getByLabelText } = render(<NewLeadForm />)
    fireEvent.click(getByRole('button', { name: /Nuevo lead/i }))
    fireEvent.change(getByLabelText(/Firma/i), { target: { value: 'Acme SA' } })
    fireEvent.change(getByLabelText(/Contacto/i), {
      target: { value: 'Ursula' },
    })
    fireEvent.click(getByRole('button', { name: /Guardar lead/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/leads')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.firm_name).toBe('Acme SA')
    expect(body.source).toBe('referral')
    expect(body.source_campaign).toBe('manual-admin-entry')
  })

  it('calls router.refresh after successful submit', async () => {
    const { getByRole, getByLabelText } = render(<NewLeadForm />)
    fireEvent.click(getByRole('button', { name: /Nuevo lead/i }))
    fireEvent.change(getByLabelText(/Firma/i), { target: { value: 'Acme SA' } })
    fireEvent.click(getByRole('button', { name: /Guardar lead/i }))

    await waitFor(() => expect(refreshMock).toHaveBeenCalled())
  })

  it('keeps form open and shows error on POST failure', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      json: async () => ({
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'insert_failed' },
      }),
    }))
    const { getByRole, getByLabelText, findByRole } = render(<NewLeadForm />)
    fireEvent.click(getByRole('button', { name: /Nuevo lead/i }))
    fireEvent.change(getByLabelText(/Firma/i), { target: { value: 'Acme SA' } })
    fireEvent.click(getByRole('button', { name: /Guardar lead/i }))

    const alert = await findByRole('alert')
    expect(alert.textContent).toContain('No se pudo guardar')
    // Form still open
    expect(getByLabelText(/Firma/i)).toBeTruthy()
  })

  it('surfaces firm_name_required with Spanish copy', async () => {
    fetchMock.mockImplementationOnce(async () => ({
      ok: false,
      json: async () => ({
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'firm_name_required' },
      }),
    }))
    const { getByRole, getByLabelText, findByRole } = render(<NewLeadForm />)
    fireEvent.click(getByRole('button', { name: /Nuevo lead/i }))
    fireEvent.change(getByLabelText(/Firma/i), { target: { value: 'Acme' } })
    fireEvent.click(getByRole('button', { name: /Guardar lead/i }))
    const alert = await findByRole('alert')
    expect(alert.textContent).toContain('El nombre de la firma es requerido')
  })

  it('collapses the form after cancel click', () => {
    const { getByRole, queryByLabelText } = render(<NewLeadForm />)
    fireEvent.click(getByRole('button', { name: /Nuevo lead/i }))
    expect(queryByLabelText(/Firma/i)).toBeTruthy()
    fireEvent.click(getByRole('button', { name: /Cancelar/i }))
    expect(queryByLabelText(/Firma/i)).toBeNull()
  })

  it('uppercases the RFC input automatically', () => {
    const { getByRole, getByLabelText } = render(<NewLeadForm />)
    fireEvent.click(getByRole('button', { name: /Nuevo lead/i }))
    const rfc = getByLabelText(/^RFC$/) as HTMLInputElement
    fireEvent.change(rfc, { target: { value: 'aaa010101aaa' } })
    expect(rfc.value).toBe('AAA010101AAA')
  })
})
