/**
 * POST /api/leads/[id]/convert — conversion flow tests.
 *
 * Auth fence, slug validation, idempotency, unique-company_id conflict,
 * companies row shape, rollback on lead update failure, activity log
 * emission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

let mockSession: { role: string } | null = null
let lead: any = null
let existingCompany: any = null
let companyInsertErr: any = null
let leadUpdateErr: any = null
const companiesInserts: any[] = []
const companiesDeletes: string[] = []
const activityInserts: any[] = []
const leadUpdates: any[] = []

vi.mock('@/lib/session', () => ({
  verifySession: async () => mockSession,
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => ({ value: 'mocked-session-token' }),
  }),
}))

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({
    from: (table: string) => {
      if (table === 'leads') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: lead, error: null }),
            }),
          }),
          update: (payload: any) => {
            leadUpdates.push(payload)
            if (leadUpdateErr) {
              return {
                eq: () => ({
                  select: () => ({
                    maybeSingle: async () => ({ data: null, error: leadUpdateErr }),
                  }),
                }),
              }
            }
            lead = { ...lead, ...payload }
            return {
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => ({ data: lead, error: null }),
                }),
              }),
            }
          },
        }
      }
      if (table === 'companies') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: existingCompany, error: null }),
            }),
          }),
          insert: (payload: any) => {
            if (companyInsertErr) {
              return Promise.resolve({ data: null, error: companyInsertErr })
            }
            companiesInserts.push(payload)
            return Promise.resolve({ data: null, error: null })
          },
          delete: () => ({
            eq: (_col: string, val: string) => {
              companiesDeletes.push(val)
              return Promise.resolve({ data: null, error: null })
            },
          }),
        }
      }
      if (table === 'lead_activities') {
        return {
          insert: (payload: any) => {
            if (Array.isArray(payload)) activityInserts.push(...payload)
            else activityInserts.push(payload)
            return Promise.resolve({ data: null, error: null })
          },
        }
      }
      return {} as any
    },
  }),
}))

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

async function postReq(body: unknown) {
  const { POST } = await import('../route')
  const req = new Request('https://portal.local/api/leads/lead-1/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const res = await POST(req, makeParams('lead-1'))
  return { status: res.status, json: await res.json() }
}

const baseLead = {
  id: 'lead-1',
  firm_name: 'Acme SA',
  contact_name: 'Juan',
  contact_email: 'juan@acme.mx',
  contact_phone: null,
  rfc: null,
  aduana: null,
  stage: 'won',
  client_code_assigned: null,
  converted_at: null,
}

beforeEach(() => {
  mockSession = { role: 'admin' }
  lead = { ...baseLead }
  existingCompany = null
  companyInsertErr = null
  leadUpdateErr = null
  companiesInserts.length = 0
  companiesDeletes.length = 0
  activityInserts.length = 0
  leadUpdates.length = 0
})

describe('POST /api/leads/[id]/convert', () => {
  it('401s without a session', async () => {
    mockSession = null
    const { status, json } = await postReq({ company_id: 'acme-sa' })
    expect(status).toBe(401)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('401s for client role', async () => {
    mockSession = { role: 'client' }
    const { status } = await postReq({ company_id: 'acme-sa' })
    expect(status).toBe(401)
  })

  it('401s for operator role', async () => {
    mockSession = { role: 'operator' }
    const { status } = await postReq({ company_id: 'acme-sa' })
    expect(status).toBe(401)
  })

  it('accepts admin + broker', async () => {
    const admin = await postReq({ company_id: 'acme-sa' })
    expect(admin.status).toBe(201)

    // Reset state for broker test
    lead = { ...baseLead }
    companiesInserts.length = 0
    mockSession = { role: 'broker' }
    const broker = await postReq({ company_id: 'acme-sa-2' })
    expect(broker.status).toBe(201)
  })

  it('normalizes uppercase slug to lowercase and accepts', async () => {
    const { status } = await postReq({ company_id: 'Acme-SA' })
    expect(status).toBe(201)
    expect(companiesInserts[0].company_id).toBe('acme-sa')
  })

  it('rejects slug with underscores', async () => {
    const { status } = await postReq({ company_id: 'acme_sa' })
    expect(status).toBe(400)
  })

  it('rejects slug with spaces', async () => {
    const { status } = await postReq({ company_id: 'acme sa' })
    expect(status).toBe(400)
  })

  it('rejects slug with consecutive dashes', async () => {
    const { status } = await postReq({ company_id: 'acme--sa' })
    expect(status).toBe(400)
  })

  it('rejects slug with leading dash', async () => {
    const { status } = await postReq({ company_id: '-acme' })
    expect(status).toBe(400)
  })

  it('rejects slug under 3 chars', async () => {
    const { status } = await postReq({ company_id: 'ac' })
    expect(status).toBe(400)
  })

  it('rejects clave_cliente with non-digits', async () => {
    const { status, json } = await postReq({
      company_id: 'acme-sa',
      clave_cliente: '92AB',
    })
    expect(status).toBe(400)
    expect(json.error.message).toBe('invalid_clave_cliente')
  })

  it('404s when the lead does not exist', async () => {
    lead = null
    const { status, json } = await postReq({ company_id: 'acme-sa' })
    expect(status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('refuses to create a duplicate company_id (hijack-prevention)', async () => {
    existingCompany = { company_id: 'acme-sa' }
    const { status, json } = await postReq({ company_id: 'acme-sa' })
    expect(status).toBe(400)
    expect(json.error.code).toBe('CONFLICT')
    expect(companiesInserts).toHaveLength(0)
  })

  it('is idempotent — returns existing tenant when already converted', async () => {
    lead = { ...baseLead, client_code_assigned: 'acme-sa', converted_at: '2026-04-21T00:00:00Z' }
    const { status, json } = await postReq({ company_id: 'whatever' })
    expect(status).toBe(200)
    expect(json.data.already_converted).toBe(true)
    expect(json.data.company_id).toBe('acme-sa')
    expect(companiesInserts).toHaveLength(0)
  })

  it('creates companies row with mapped lead fields on happy path', async () => {
    const { status, json } = await postReq({
      company_id: 'acme-sa',
      clave_cliente: '9254',
      language: 'es',
    })
    expect(status).toBe(201)
    expect(json.data.already_converted).toBe(false)
    expect(json.data.company_id).toBe('acme-sa')
    expect(companiesInserts).toHaveLength(1)
    expect(companiesInserts[0]).toMatchObject({
      company_id: 'acme-sa',
      name: 'Acme SA',
      contact_name: 'Juan',
      contact_email: 'juan@acme.mx',
      clave_cliente: '9254',
      language: 'es',
      active: true,
    })
  })

  it('stamps lead with client_code_assigned + converted_at + stage=won', async () => {
    await postReq({ company_id: 'acme-sa' })
    expect(leadUpdates).toHaveLength(1)
    expect(leadUpdates[0]).toMatchObject({
      client_code_assigned: 'acme-sa',
      stage: 'won',
    })
    expect(leadUpdates[0].converted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('emits a system activity with the right summary', async () => {
    await postReq({ company_id: 'acme-sa', clave_cliente: '9254' })
    expect(activityInserts).toHaveLength(1)
    expect(activityInserts[0].kind).toBe('system')
    expect(activityInserts[0].summary).toContain('Convertido a cliente')
    expect(activityInserts[0].summary).toContain('acme-sa')
    expect(activityInserts[0].summary).toContain('9254')
    expect(activityInserts[0].metadata).toMatchObject({
      company_id: 'acme-sa',
      clave_cliente: '9254',
      language: 'es',
    })
  })

  it('rolls back companies insert when lead update fails', async () => {
    leadUpdateErr = { message: 'update failed' }
    const { status } = await postReq({ company_id: 'acme-sa' })
    expect(status).toBe(500)
    expect(companiesInserts).toHaveLength(1)
    expect(companiesDeletes).toEqual(['acme-sa'])
  })

  it('returns 500 when tenant insert fails (no lead stamp)', async () => {
    companyInsertErr = { message: 'insert failed' }
    const { status, json } = await postReq({ company_id: 'acme-sa' })
    expect(status).toBe(500)
    expect(json.error.message).toBe('tenant_create_failed')
    expect(leadUpdates).toHaveLength(0)
  })

  it('defaults language to es when missing or invalid', async () => {
    await postReq({ company_id: 'acme-sa' })
    expect(companiesInserts[0].language).toBe('es')

    // Reset
    lead = { ...baseLead }
    companiesInserts.length = 0
    await postReq({ company_id: 'acme-sa-2', language: 'fr' })
    expect(companiesInserts[0].language).toBe('es')
  })

  it('accepts language=en', async () => {
    await postReq({ company_id: 'acme-sa', language: 'en' })
    expect(companiesInserts[0].language).toBe('en')
  })
})
