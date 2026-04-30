/**
 * GET + POST /api/leads/[id]/activities — integration tests.
 * Auth fence, kind whitelist, summary validation, occurred_at parsing,
 * lead-not-found handling, error-shape contract.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

let mockSession: { role: string } | null = null
let leadExists = true
const insertCalls: any[] = []
const updateCalls: any[] = []
const listRows: any[] = []

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
      const buildLimit = () => ({
        async then() {
          // For GET path: .limit() resolves to list.
          return { data: listRows, error: null }
        },
        maybeSingle: async () => {
          if (table === 'lead_activities') {
            return insertCalls.length
              ? {
                  data: {
                    id: 'act-1',
                    lead_id: 'lead-1',
                    ...insertCalls[insertCalls.length - 1],
                    created_at: '2026-04-21T16:00:00Z',
                  },
                  error: null,
                }
              : { data: null, error: null }
          }
          return { data: null, error: null }
        },
        // Support awaiting the limit chain directly for GET:
        [Symbol.toPrimitive]: () => null,
      })
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (table === 'leads') {
                return {
                  data: leadExists ? { id: 'lead-1' } : null,
                  error: null,
                }
              }
              return { data: null, error: null }
            },
            order: () => ({
              limit: (_n?: number) => {
                const base = buildLimit()
                return Object.assign(
                  Promise.resolve({ data: listRows, error: null }),
                  base,
                )
              },
            }),
          }),
        }),
        insert: (payload: any) => {
          insertCalls.push(payload)
          return Promise.resolve({ data: null, error: null })
        },
        update: (payload: any) => {
          updateCalls.push(payload)
          return { eq: () => Promise.resolve({ data: null, error: null }) }
        },
      }
    },
  }),
}))

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

async function postReq(body: unknown) {
  const { POST } = await import('../route')
  const req = new Request('https://portal.local/api/leads/lead-1/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const res = await POST(req, makeParams('lead-1'))
  return { status: res.status, json: await res.json() }
}

async function getReq() {
  const { GET } = await import('../route')
  const req = new Request('https://portal.local/api/leads/lead-1/activities')
  const res = await GET(req, makeParams('lead-1'))
  return { status: res.status, json: await res.json() }
}

describe('POST /api/leads/[id]/activities', () => {
  beforeEach(() => {
    mockSession = { role: 'admin' }
    leadExists = true
    insertCalls.length = 0
    updateCalls.length = 0
    listRows.length = 0
  })

  it('401s when there is no session', async () => {
    mockSession = null
    const { status, json } = await postReq({ kind: 'call', summary: 'hola' })
    expect(status).toBe(401)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('401s for client role', async () => {
    mockSession = { role: 'client' }
    const { status, json } = await postReq({ kind: 'call', summary: 'hola' })
    expect(status).toBe(401)
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('401s for operator role', async () => {
    mockSession = { role: 'operator' }
    const { status } = await postReq({ kind: 'call', summary: 'hola' })
    expect(status).toBe(401)
  })

  it('accepts admin + broker roles', async () => {
    mockSession = { role: 'admin' }
    const admin = await postReq({ kind: 'call', summary: 'hola' })
    expect(admin.status).toBe(201)

    insertCalls.length = 0
    mockSession = { role: 'broker' }
    const broker = await postReq({ kind: 'note', summary: 'nota' })
    expect(broker.status).toBe(201)
  })

  it('rejects invalid kind', async () => {
    const { status, json } = await postReq({
      kind: 'stage_change', // system-only, not manual
      summary: 'hola',
    })
    expect(status).toBe(400)
    expect(json.error.message).toBe('invalid_kind')
  })

  it('rejects missing summary', async () => {
    const { status, json } = await postReq({ kind: 'call' })
    expect(status).toBe(400)
    expect(json.error.message).toBe('summary_required')
  })

  it('rejects whitespace-only summary', async () => {
    const { status } = await postReq({ kind: 'call', summary: '   ' })
    expect(status).toBe(400)
  })

  it('rejects invalid occurred_at', async () => {
    const { status, json } = await postReq({
      kind: 'call',
      summary: 'hola',
      occurred_at: 'not-a-date',
    })
    expect(status).toBe(400)
    expect(json.error.message).toBe('invalid_occurred_at')
  })

  it('accepts ISO occurred_at and writes it through', async () => {
    const { status } = await postReq({
      kind: 'meeting',
      summary: 'junta',
      occurred_at: '2026-04-18T15:00:00Z',
    })
    expect(status).toBe(201)
    expect(insertCalls[0].occurred_at).toBe('2026-04-18T15:00:00.000Z')
  })

  it('404s when lead does not exist', async () => {
    leadExists = false
    const { status, json } = await postReq({ kind: 'call', summary: 'hola' })
    expect(status).toBe(404)
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('returns 201 + persists the activity row', async () => {
    const { status } = await postReq({
      kind: 'call',
      summary: 'Primera llamada. Aceptó agendar demo el viernes.',
    })
    expect(status).toBe(201)
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0].kind).toBe('call')
    expect(insertCalls[0].summary).toContain('Primera llamada')
    expect(insertCalls[0].lead_id).toBe('lead-1')
    expect(insertCalls[0].actor_name).toBe('admin')
  })

  it('bumps last_contact_at on touchpoint kinds', async () => {
    await postReq({
      kind: 'call',
      summary: 'hola',
      occurred_at: '2026-04-20T15:00:00Z',
    })
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0].last_contact_at).toBe('2026-04-20T15:00:00.000Z')
  })

  it('does NOT bump last_contact_at on note kind', async () => {
    await postReq({ kind: 'note', summary: 'recordatorio interno' })
    expect(updateCalls).toHaveLength(0)
  })
})

describe('GET /api/leads/[id]/activities', () => {
  beforeEach(() => {
    mockSession = { role: 'admin' }
    leadExists = true
    listRows.length = 0
  })

  it('401s when unauthenticated', async () => {
    mockSession = null
    const { status } = await getReq()
    expect(status).toBe(401)
  })

  it('returns an empty array when no rows exist', async () => {
    const { status, json } = await getReq()
    expect(status).toBe(200)
    expect(json.data).toEqual([])
    expect(json.error).toBeNull()
  })

  it('returns activity rows for the lead', async () => {
    listRows.push(
      {
        id: 'act-1',
        lead_id: 'lead-1',
        kind: 'call',
        summary: 'Primera llamada',
        occurred_at: '2026-04-21T15:00:00Z',
      },
      {
        id: 'act-2',
        lead_id: 'lead-1',
        kind: 'note',
        summary: 'Nota',
        occurred_at: '2026-04-21T14:00:00Z',
      },
    )
    const { status, json } = await getReq()
    expect(status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.data[0].summary).toBe('Primera llamada')
  })
})
