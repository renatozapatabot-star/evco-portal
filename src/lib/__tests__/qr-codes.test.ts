/**
 * ZAPATA AI · V1.5 F1 — QR entrada code tests.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  generateShortCode,
  parseScanPayload,
  createEntradaQrCode,
  resolveEntradaQrCode,
} from '@/lib/qr/codes'
import { WAREHOUSE_ENTRY_RECEIVED_EVENT } from '@/lib/warehouse-entries'

describe('qr/codes · generateShortCode', () => {
  it('returns a 10-char uppercase alphanumeric code with no confusing glyphs', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateShortCode()
      expect(code).toHaveLength(10)
      expect(code).toMatch(/^[A-Z2-9]+$/)
      expect(code).not.toMatch(/[01IO]/)
    }
  })

  it('produces distinct codes across successive calls', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 100; i++) seen.add(generateShortCode())
    expect(seen.size).toBe(100)
  })
})

describe('qr/codes · parseScanPayload', () => {
  it('returns raw codes untouched (uppercased)', () => {
    expect(parseScanPayload('abcdefghjk')).toBe('ABCDEFGHJK')
  })

  it('extracts code from a URL payload', () => {
    expect(parseScanPayload('https://aguila.example/e/XK9P2QR7MN')).toBe('XK9P2QR7MN')
    expect(parseScanPayload('https://aguila.example/?c=XK9P2QR7MN')).toBe('XK9P2QR7MN')
  })

  it('rejects empty / malformed payloads', () => {
    expect(parseScanPayload('')).toBeNull()
    expect(parseScanPayload('   ')).toBeNull()
    expect(parseScanPayload('not-a-code!')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Supabase fakes — minimal shape matching @supabase/supabase-js client surface
// used by the code under test.
// ---------------------------------------------------------------------------
interface InsertedRow {
  code: string
  trafico_id: string
  company_id: string
  entrada_id: string | null
  generated_by: string | null
}

function makeFakeClient(seed?: {
  existing?: Array<{
    id: string
    code: string
    trafico_id: string
    company_id: string
    entrada_id: string | null
  }>
}) {
  const qrRows: InsertedRow[] = []
  const workflowEvents: Array<Record<string, unknown>> = []
  const updates: Array<{ table: string; patch: Record<string, unknown>; id: string }> = []
  const existing = seed?.existing ?? []

  const client = {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          if (table === 'entrada_qr_codes') {
            qrRows.push(row as unknown as InsertedRow)
          } else if (table === 'workflow_events') {
            workflowEvents.push(row)
          }
          return Promise.resolve({ data: null, error: null })
        },
        select() {
          return {
            eq(_col: string, val: string) {
              return {
                maybeSingle: async () => {
                  const hit = existing.find((r) => r.code === val)
                  return { data: hit ?? null, error: null }
                },
              }
            },
          }
        },
        update(patch: Record<string, unknown>) {
          return {
            eq: (_col: string, id: string) => {
              updates.push({ table, patch, id })
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
      }
    },
  }

  return { client: client as unknown as Parameters<typeof createEntradaQrCode>[0]['client'], qrRows, workflowEvents, updates }
}

describe('qr/codes · createEntradaQrCode', () => {
  it('inserts a row and returns a PNG data URL for the short code', async () => {
    const { client, qrRows } = makeFakeClient()
    const result = await createEntradaQrCode({
      traficoId: 'TRF-001',
      companyId: 'evco',
      entradaId: null,
      generatedBy: 'evco:broker',
      client,
    })
    expect(result.code).toMatch(/^[A-Z2-9]{10}$/)
    expect(result.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true)
    expect(qrRows).toHaveLength(1)
    expect(qrRows[0].trafico_id).toBe('TRF-001')
    expect(qrRows[0].company_id).toBe('evco')
    expect(qrRows[0].generated_by).toBe('evco:broker')
  })
})

describe('qr/codes · resolveEntradaQrCode', () => {
  it('stamps scan metadata and emits warehouse_entry_received on match', async () => {
    const { client, workflowEvents, updates } = makeFakeClient({
      existing: [
        {
          id: 'qr-1',
          code: 'XK9P2QR7MN',
          trafico_id: 'TRF-001',
          company_id: 'evco',
          entrada_id: null,
        },
      ],
    })
    const outcome = await resolveEntradaQrCode({
      code: 'xk9p2qr7mn',
      scannedBy: 'evco:warehouse',
      location: 'warehouse-gate-1',
      companyId: 'evco',
      client,
    })
    expect(outcome.error).toBeNull()
    expect(outcome.data?.traficoId).toBe('TRF-001')
    expect(workflowEvents).toHaveLength(1)
    expect(workflowEvents[0].event_type).toBe(WAREHOUSE_ENTRY_RECEIVED_EVENT)
    expect(workflowEvents[0].trigger_id).toBe('TRF-001')
    expect(updates).toHaveLength(1)
    expect(updates[0].patch).toMatchObject({
      scanned_by: 'evco:warehouse',
      scan_location: 'warehouse-gate-1',
    })
  })

  it('returns FORBIDDEN when the code belongs to another company', async () => {
    const { client, workflowEvents } = makeFakeClient({
      existing: [
        {
          id: 'qr-1',
          code: 'XK9P2QR7MN',
          trafico_id: 'TRF-001',
          company_id: 'mafesa',
          entrada_id: null,
        },
      ],
    })
    const outcome = await resolveEntradaQrCode({
      code: 'XK9P2QR7MN',
      scannedBy: 'evco:warehouse',
      location: 'warehouse-gate-1',
      companyId: 'evco',
      client,
    })
    expect(outcome.data).toBeNull()
    expect(outcome.error?.code).toBe('FORBIDDEN')
    expect(workflowEvents).toHaveLength(0)
  })

  it('returns NOT_FOUND for an unknown code', async () => {
    const { client } = makeFakeClient({ existing: [] })
    const outcome = await resolveEntradaQrCode({
      code: 'MISSINGXYZ',
      scannedBy: 'evco:warehouse',
      location: 'warehouse-gate-1',
      companyId: 'evco',
      client,
    })
    expect(outcome.error?.code).toBe('NOT_FOUND')
  })
})

// Keep vi imported even if not used for spies — future tests may need it.
void vi
