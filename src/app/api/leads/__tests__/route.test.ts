/**
 * POST /api/leads — integration test.
 *
 * Tests the full validation path (firm_name required, source whitelist),
 * the sanitize layer (max-length truncation), and the {data, error}
 * response shape contract. Supabase insert is mocked — we verify the
 * payload shape the route constructs before it hits the DB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

const insertCalls: any[] = []
let insertShouldFail = false

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({
    from: (_table: string) => ({
      insert: (payload: any) => {
        insertCalls.push(payload)
        return {
          select: () => ({
            single: async () => {
              if (insertShouldFail) {
                return { data: null, error: { message: 'mocked_db_error' } }
              }
              return {
                data: { id: 'mocked-uuid-1234' },
                error: null,
              }
            },
          }),
        }
      },
    }),
  }),
}))

async function invoke(body: unknown): Promise<{ status: number; json: any }> {
  const { POST } = await import('../route')
  const req = new Request('https://portal.local/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  const res = await POST(req)
  const json = await res.json()
  return { status: res.status, json }
}

describe('POST /api/leads', () => {
  beforeEach(() => {
    insertCalls.length = 0
    insertShouldFail = false
  })

  it('rejects invalid JSON with 400 + VALIDATION_ERROR code', async () => {
    const { POST } = await import('../route')
    const req = new Request('https://portal.local/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not valid json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json).toEqual({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'invalid_json' },
    })
  })

  it('rejects missing firm_name with 400 + firm_name_required', async () => {
    const { status, json } = await invoke({ contact_name: 'Juan' })
    expect(status).toBe(400)
    expect(json).toEqual({
      data: null,
      error: { code: 'VALIDATION_ERROR', message: 'firm_name_required' },
    })
    expect(insertCalls.length).toBe(0)
  })

  it('rejects whitespace-only firm_name with 400', async () => {
    const { status } = await invoke({ firm_name: '   \t\n  ' })
    expect(status).toBe(400)
    expect(insertCalls.length).toBe(0)
  })

  it('inserts a minimal valid lead + returns {data: {id}, error: null}', async () => {
    const { status, json } = await invoke({ firm_name: 'Acme SA' })
    expect(status).toBe(200)
    expect(json).toEqual({ data: { id: 'mocked-uuid-1234' }, error: null })
    expect(insertCalls.length).toBe(1)
    expect(insertCalls[0].firm_name).toBe('Acme SA')
    expect(insertCalls[0].stage).toBe('new')
    expect(insertCalls[0].source).toBe('inbound') // default when absent
  })

  it('trims firm_name whitespace', async () => {
    await invoke({ firm_name: '   Acme SA   ' })
    expect(insertCalls[0].firm_name).toBe('Acme SA')
  })

  it('accepts whitelisted source values', async () => {
    await invoke({ firm_name: 'A', source: 'cold-email' })
    await invoke({ firm_name: 'A', source: 'linkedin' })
    await invoke({ firm_name: 'A', source: 'referral' })
    await invoke({ firm_name: 'A', source: 'demo' })
    await invoke({ firm_name: 'A', source: 'inbound' })
    await invoke({ firm_name: 'A', source: 'other' })
    const sources = insertCalls.map((c) => c.source)
    expect(sources).toEqual([
      'cold-email',
      'linkedin',
      'referral',
      'demo',
      'inbound',
      'other',
    ])
  })

  it('silently falls back to "inbound" when source is not whitelisted', async () => {
    await invoke({ firm_name: 'A', source: 'evil-injection' })
    expect(insertCalls[0].source).toBe('inbound')
  })

  it('truncates oversized fields to their max-length caps', async () => {
    const huge = 'X'.repeat(5000)
    await invoke({
      firm_name: huge,
      contact_name: huge,
      contact_email: huge,
      contact_phone: huge,
      rfc: huge,
      notes: huge,
      source_campaign: huge,
      source_url: huge,
    })
    const c = insertCalls[0]
    expect(c.firm_name.length).toBe(200)
    expect(c.contact_name.length).toBe(120)
    expect(c.contact_email.length).toBe(200)
    expect(c.contact_phone.length).toBe(40)
    expect(c.rfc.length).toBe(13)
    expect(c.notes.length).toBe(2000)
    expect(c.source_campaign.length).toBe(120)
    expect(c.source_url.length).toBe(500)
  })

  it('persists null for optional fields that are absent', async () => {
    await invoke({ firm_name: 'Acme' })
    const c = insertCalls[0]
    expect(c.contact_name).toBeNull()
    expect(c.contact_email).toBeNull()
    expect(c.contact_phone).toBeNull()
    expect(c.rfc).toBeNull()
    expect(c.notes).toBeNull()
  })

  it('returns 500 + INTERNAL_ERROR when the DB write fails', async () => {
    insertShouldFail = true
    const { status, json } = await invoke({ firm_name: 'Acme' })
    expect(status).toBe(500)
    expect(json).toEqual({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'insert_failed' },
    })
  })

  it('does not leak DB error details in the error payload', async () => {
    insertShouldFail = true
    const { json } = await invoke({ firm_name: 'Acme' })
    const serialized = JSON.stringify(json)
    expect(serialized).not.toContain('mocked_db_error')
  })

  it('rejects non-string firm_name types (arrays, objects, numbers)', async () => {
    expect((await invoke({ firm_name: ['Acme'] })).status).toBe(400)
    expect((await invoke({ firm_name: { x: 1 } })).status).toBe(400)
    expect((await invoke({ firm_name: 42 })).status).toBe(400)
  })
})
