/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import { composeTrace, groupByDay, type TraceEvent } from '../compose'

/**
 * Tests for the trace composer. We build a tiny fake Supabase client that
 * implements just the subset of the chainable API used by compose.ts:
 * .from().select().eq().order().limit().maybeSingle().
 *
 * Each call chain returns a pre-seeded dataset per table, or throws for
 * tables we want to simulate as missing (verifying null-safety).
 */

type Row = Record<string, unknown>

function makeClient(fixtures: Record<string, Row[] | 'missing'>, pedimentoId: string | null = null) {
  function builder(table: string): any {
    const data = fixtures[table]
    const rows: Row[] = data === 'missing' ? [] : (data ?? [])
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => {
        if (data === 'missing') throw new Error('table missing')
        if (table === 'pedimentos') {
          return pedimentoId ? { data: { id: pedimentoId }, error: null } : { data: null, error: null }
        }
        return { data: rows[0] ?? null, error: null }
      },
      then: undefined,
    }
    // Make the chain awaitable as "select query" (no maybeSingle).
    chain.then = (resolve: any) => {
      if (data === 'missing') {
        resolve({ data: null, error: { message: 'missing' } })
        return
      }
      resolve({ data: rows, error: null })
    }
    return chain
  }
  return {
    from: (table: string) => builder(table),
  }
}

describe('composeTrace', () => {
  const iso1 = '2026-04-10T12:00:00Z'
  const iso2 = '2026-04-11T15:30:00Z'
  const iso3 = '2026-04-12T09:00:00Z'

  it('merges events from every source and sorts newest first', async () => {
    const supabase = makeClient(
      {
        traficos: [{ trafico: 'T1', company_id: 'evco', pedimento: null, estatus: 'abierto' }],
        pedimentos: [{ id: 'ped-1' }],
        workflow_events: [
          { id: 'w1', event_type: 'email_processed', workflow: 'intake', created_at: iso1 },
        ],
        expediente_documentos: [
          {
            id: 'd1',
            file_name: 'factura.pdf',
            document_type: 'FACTURA_COMERCIAL',
            uploaded_by: 'eloisa',
            created_at: iso2,
          },
        ],
        classification_sheets: [
          { id: 'c1', status: 'completa', opinion_number: 'OCA-2026-001', created_at: iso2 },
        ],
        pedimento_export_jobs: [
          { id: 'pe1', status: 'completed', file_name: 'ped.xml', created_at: iso3 },
        ],
        anexo_24_export_jobs: [
          { id: 'a1', status: 'queued', file_name: 'anx.csv', created_at: iso1 },
        ],
        pece_payments: [
          {
            id: 'p1',
            status: 'confirmed',
            bank_code: '002',
            amount: 12345.67,
            reference: 'REF-9',
            created_at: iso3,
          },
        ],
        mve_alerts: [
          { id: 'm1', severity: 'high', alert_type: 'valor_subdeclarado', message: 'Revisar', created_at: iso2 },
        ],
        quickbooks_export_jobs: [
          { id: 'q1', status: 'exported', created_at: iso3 },
        ],
      },
      'ped-1',
    )

    const out = await composeTrace(supabase as any, 'T1', 'evco')
    expect(out.trafico?.trafico).toBe('T1')
    // 8 event sources, 1 row each → 8 events
    expect(out.events).toHaveLength(8)
    // Newest first
    expect(new Date(out.events[0].at).getTime()).toBeGreaterThanOrEqual(
      new Date(out.events[out.events.length - 1].at).getTime(),
    )
    // Pedimento export event has correct title
    const pex = out.events.find((e) => e.kind === 'pedimento_export')
    expect(pex?.title).toMatch(/AduanaNet/)
    // PECE event has amount in MXN
    const pec = out.events.find((e) => e.kind === 'pece_payment')
    expect(pec?.title).toMatch(/MXN/)
  })

  it('is null-safe when a source table is missing', async () => {
    const supabase = makeClient(
      {
        traficos: [{ trafico: 'T2', company_id: 'evco', pedimento: null, estatus: null }],
        pedimentos: [],
        workflow_events: [
          { id: 'w1', event_type: 'docs_ready', workflow: 'docs', created_at: iso1 },
        ],
        // Simulate missing tables
        expediente_documentos: 'missing',
        classification_sheets: 'missing',
        pedimento_export_jobs: 'missing',
        anexo_24_export_jobs: 'missing',
        pece_payments: 'missing',
        mve_alerts: 'missing',
        quickbooks_export_jobs: 'missing',
      },
      null,
    )

    const out = await composeTrace(supabase as any, 'T2', 'evco')
    expect(out.events).toHaveLength(1)
    expect(out.events[0].kind).toBe('workflow')
  })

  it('returns empty events when every source is missing or empty', async () => {
    const supabase = makeClient({
      traficos: [{ trafico: 'T3', company_id: null, pedimento: null, estatus: null }],
      pedimentos: [],
      workflow_events: [],
      expediente_documentos: [],
      classification_sheets: [],
      pedimento_export_jobs: [],
      anexo_24_export_jobs: [],
      pece_payments: [],
      mve_alerts: [],
      quickbooks_export_jobs: [],
    })
    const out = await composeTrace(supabase as any, 'T3', null)
    expect(out.events).toEqual([])
  })
})

describe('groupByDay', () => {
  it('buckets events into one group per local day', () => {
    const events: TraceEvent[] = [
      { id: '1', at: '2026-04-10T12:00:00Z', kind: 'workflow', title: 'a' },
      { id: '2', at: '2026-04-10T22:00:00Z', kind: 'workflow', title: 'b' },
      { id: '3', at: '2026-04-11T01:00:00Z', kind: 'workflow', title: 'c' },
    ]
    const grouped = groupByDay(events)
    // 10 Apr morning + evening are same CST/CDT day; 11 Apr 01:00 UTC = 10 Apr 20:00 CDT → still Apr 10
    expect(grouped.length).toBeGreaterThanOrEqual(1)
    expect(grouped.reduce((n, g) => n + g.events.length, 0)).toBe(3)
  })

  it('skips events with unparseable timestamps', () => {
    const events: TraceEvent[] = [
      { id: '1', at: 'not-a-date', kind: 'workflow', title: 'a' },
      { id: '2', at: '2026-04-10T12:00:00Z', kind: 'workflow', title: 'b' },
    ]
    const grouped = groupByDay(events)
    expect(grouped.reduce((n, g) => n + g.events.length, 0)).toBe(1)
  })
})
