/**
 * PATCH /api/leads/[id] — auto-logger regression fence.
 *
 * Verifies that a successful PATCH emits the expected lead_activities
 * insert payloads: a stage_change row on stage move, field_update
 * rows per whitelisted field change, and nothing on no-op patches.
 *
 * The existing route.test.ts doesn't cover insert calls (its mock
 * silently swallows them via writeActivities' try/catch). This file
 * wires a mock that tracks inserts explicitly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

let mockSession: { role: string } | null = null
const insertCalls: any[] = []

const baseLead = {
  id: 'lead-1',
  firm_name: 'Acme SA',
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
}

let mockRow: any = { ...baseLead }

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
      if (table === 'lead_activities') {
        return {
          insert: (payload: any) => {
            if (Array.isArray(payload)) insertCalls.push(...payload)
            else insertCalls.push(payload)
            return Promise.resolve({ data: null, error: null })
          },
        }
      }
      // leads table
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: mockRow, error: null }),
          }),
        }),
        update: (payload: any) => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => {
                mockRow = { ...mockRow, ...payload }
                return { data: mockRow, error: null }
              },
            }),
          }),
        }),
      }
    },
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
    body: JSON.stringify(body),
  })
  const res = await PATCH(req, makeParams('lead-1'))
  return { status: res.status, json: await res.json() }
}

describe('PATCH /api/leads/[id] auto-logger', () => {
  beforeEach(() => {
    mockSession = { role: 'admin' }
    insertCalls.length = 0
    mockRow = { ...baseLead }
  })

  it('emits a stage_change activity on stage move', async () => {
    const { status } = await patchReq({ stage: 'contacted' })
    expect(status).toBe(200)
    const stageLogs = insertCalls.filter((c) => c.kind === 'stage_change')
    expect(stageLogs).toHaveLength(1)
    expect(stageLogs[0].summary).toBe('Etapa: Nuevo → Contactado')
    expect(stageLogs[0].metadata).toEqual({ from: 'new', to: 'contacted' })
  })

  it('emits a field_update activity on contact_name edit', async () => {
    const { status } = await patchReq({ contact_name: 'María Pérez' })
    expect(status).toBe(200)
    const fieldLogs = insertCalls.filter((c) => c.kind === 'field_update')
    expect(fieldLogs).toHaveLength(1)
    expect(fieldLogs[0].summary).toContain('Nombre del contacto')
    expect(fieldLogs[0].summary).toContain('María Pérez')
  })

  it('emits stage_change + field_update when both move', async () => {
    const { status } = await patchReq({
      stage: 'demo-viewed',
      value_monthly_mxn: 25000,
    })
    expect(status).toBe(200)
    const kinds = insertCalls.map((c) => c.kind).sort()
    expect(kinds).toEqual(['field_update', 'stage_change'])
  })

  it('tags the actor with the session role', async () => {
    await patchReq({ stage: 'contacted' })
    expect(insertCalls[0].actor_name).toBe('admin')
    expect(insertCalls[0].actor_user_id).toBeNull()

    insertCalls.length = 0
    mockRow = { ...baseLead }
    mockSession = { role: 'broker' }
    await patchReq({ stage: 'contacted' })
    expect(insertCalls[0].actor_name).toBe('broker')
  })

  it('does not emit activities when nothing changed', async () => {
    // PATCH requires at least one updatable field, so we send the SAME
    // value — the diff should come up clean.
    mockRow = { ...baseLead, contact_name: 'Juan García' }
    const { status } = await patchReq({ contact_name: 'Juan García' })
    expect(status).toBe(200)
    expect(insertCalls).toHaveLength(0)
  })
})
