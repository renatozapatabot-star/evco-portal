/**
 * PATCH /api/leads/[id] + GET /api/leads/[id] — integration tests.
 *
 * Auth fence (admin/broker only · 401 otherwise), stage/priority
 * whitelists, field sanitization, error-shape contract, DB failure
 * handling. Supabase chain is mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

let mockSession: { role: string } | null = null
const updateCalls: any[] = []
let mockRow: any = null
let updateShouldFail = false

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
    from: (_table: string) => ({
      select: () => ({
        eq: (_col: string, _val: string) => ({
          maybeSingle: async () => {
            if (updateShouldFail) {
              return { data: null, error: { message: 'db_error' } }
            }
            return { data: mockRow, error: null }
          },
        }),
      }),
      update: (payload: any) => {
        updateCalls.push(payload)
        return {
          eq: (_col: string, _val: string) => ({
            select: () => ({
              maybeSingle: async () => {
                if (updateShouldFail) {
                  return { data: null, error: { message: 'update_error' } }
                }
                mockRow = { ...mockRow, ...payload, id: 'lead-1' }
                return { data: mockRow, error: null }
              },
            }),
          }),
        }
      },
    }),
  }),
}))

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

async function patchReq(body: unknown) {
  const { PATCH } = await import('../route')
  const req = new Request('https://portal.local/api/leads/lead-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const res = await PATCH(req, makeParams('lead-1'))
  return { status: res.status, json: await res.json() }
}

async function getReq() {
  const { GET } = await import('../route')
  const req = new Request('https://portal.local/api/leads/lead-1')
  const res = await GET(req, makeParams('lead-1'))
  return { status: res.status, json: await res.json() }
}

describe('PATCH /api/leads/[id]', () => {
  beforeEach(() => {
    mockSession = { role: 'admin' }
    updateCalls.length = 0
    updateShouldFail = false
    mockRow = {
      id: 'lead-1',
      firm_name: 'Acme SA',
      stage: 'new',
      priority: 'normal',
      source: 'cold-email',
      created_at: '2026-04-21T00:00:00Z',
    }
  })

  it('401s when there is no session', async () => {
    mockSession = null
    const { status, json } = await patchReq({ stage: 'contacted' })
    expect(status).toBe(401)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('401s for client role', async () => {
    mockSession = { role: 'client' }
    const { status, json } = await patchReq({ stage: 'contacted' })
    expect(status).toBe(401)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('401s for operator role', async () => {
    mockSession = { role: 'operator' }
    const { status, json } = await patchReq({ stage: 'contacted' })
    expect(status).toBe(401)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('accepts admin role', async () => {
    mockSession = { role: 'admin' }
    const { status } = await patchReq({ stage: 'contacted' })
    expect(status).toBe(200)
  })

  it('accepts broker role', async () => {
    mockSession = { role: 'broker' }
    const { status } = await patchReq({ stage: 'demo-viewed' })
    expect(status).toBe(200)
  })

  it('rejects invalid JSON with 400', async () => {
    const { PATCH } = await import('../route')
    const req = new Request('https://portal.local/api/leads/lead-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await PATCH(req, makeParams('lead-1'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error.message).toBe('invalid_json')
  })

  it('rejects empty payload with 400 + no_updatable_fields', async () => {
    const { status, json } = await patchReq({})
    expect(status).toBe(400)
    expect(json.error.message).toBe('no_updatable_fields')
  })

  it('rejects invalid stage values', async () => {
    const { status, json } = await patchReq({ stage: 'evil' })
    expect(status).toBe(400)
    expect(json.error.message).toBe('invalid_stage')
  })

  it('rejects invalid priority values', async () => {
    const { status, json } = await patchReq({ priority: 'mega' })
    expect(status).toBe(400)
    expect(json.error.message).toBe('invalid_priority')
  })

  it('accepts a valid stage update and returns the row', async () => {
    const { status, json } = await patchReq({ stage: 'demo-viewed' })
    expect(status).toBe(200)
    expect(json.data.stage).toBe('demo-viewed')
    expect(json.error).toBeNull()
    expect(updateCalls[0].stage).toBe('demo-viewed')
  })

  it('trims and truncates string fields', async () => {
    await patchReq({
      contact_name: '   Juan   ',
      notes: 'x'.repeat(5000),
    })
    expect(updateCalls[0].contact_name).toBe('Juan')
    expect(updateCalls[0].notes.length).toBe(4000)
  })

  it('accepts null to clear a nullable field', async () => {
    await patchReq({ contact_email: null })
    expect(updateCalls[0].contact_email).toBeNull()
  })

  it('coerces value_monthly_mxn from string to number', async () => {
    await patchReq({ value_monthly_mxn: '42000' })
    expect(updateCalls[0].value_monthly_mxn).toBe(42000)
  })

  it('coerces next_action_at from YYYY-MM-DD to ISO timestamp', async () => {
    await patchReq({ next_action_at: '2026-05-15' })
    expect(typeof updateCalls[0].next_action_at).toBe('string')
    expect(updateCalls[0].next_action_at).toMatch(/^2026-05-15/)
  })

  it('returns 500 + INTERNAL_ERROR when DB update fails', async () => {
    updateShouldFail = true
    const { status, json } = await patchReq({ stage: 'contacted' })
    expect(status).toBe(500)
    expect(json.error.code).toBe('INTERNAL_ERROR')
  })
})

describe('GET /api/leads/[id]', () => {
  beforeEach(() => {
    mockSession = { role: 'admin' }
    updateShouldFail = false
    mockRow = { id: 'lead-1', firm_name: 'Acme SA' }
  })

  it('401s without admin session', async () => {
    mockSession = null
    const { status } = await getReq()
    expect(status).toBe(401)
  })

  it('returns the row for admin', async () => {
    const { status, json } = await getReq()
    expect(status).toBe(200)
    expect(json.data.firm_name).toBe('Acme SA')
  })

  it('404s when lead is missing', async () => {
    mockRow = null
    const { status, json } = await getReq()
    expect(status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })
})
