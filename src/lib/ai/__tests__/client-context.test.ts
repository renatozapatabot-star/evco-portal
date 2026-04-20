/* eslint-disable @typescript-eslint/no-explicit-any -- this test stubs
   the Supabase chainable query-builder, whose terminal-method dispatch
   is inherently dynamic; typing the mock faithfully would require
   reproducing `PostgrestQueryBuilder` which adds no test value. */
import { describe, it, expect } from 'vitest'
import { buildClientAIContext, formatClientAIContextPreamble } from '../client-context'

// Minimal Supabase-v2 query-builder stub that returns whatever rows the
// test wires in. Matches the chainable-API shape used by the real client
// (eq / not / order / limit / maybeSingle / is). Each call returns
// `this` so chaining works; terminal methods resolve to `{ data }`.
function stubClient(overrides: {
  company?: unknown
  active?: unknown[]
  pedimentos?: unknown[]
  expedientes?: unknown[]
}) {
  return {
    from(table: string) {
      const builder: any = {
        data:
          table === 'companies' ? overrides.company :
          table === 'traficos' ? undefined : // resolved per-chain below
          table === 'expediente_documentos' ? overrides.expedientes :
          null,
        select() { return this },
        eq(col: string, val: unknown) {
          // traficos has two branches (active vs recent-pedimentos).
          // We disambiguate on the filter chain later.
          this._col = col; this._val = val
          return this
        },
        not() { return this },
        is() { return this },
        order() { return this },
        limit() { return this },
        maybeSingle() { return Promise.resolve({ data: overrides.company ?? null }) },
        then(onF: any, onR: any) {
          // Active shipments branch is reached by .not('estatus', 'in', ...)
          // followed by .order('fecha_llegada'). Recent pedimentos is
          // reached by .not('pedimento', 'is', null). Expedientes uses
          // `.is('file_url', null)`. We pick the right dataset via the
          // internal flags set by the chain.
          let data: unknown[] = []
          if (table === 'traficos') {
            data = this._pedimentos ? (overrides.pedimentos ?? []) : (overrides.active ?? [])
          } else if (table === 'expediente_documentos') {
            data = overrides.expedientes ?? []
          }
          return Promise.resolve({ data }).then(onF, onR)
        },
        catch(onR: any) { return Promise.resolve({ data: null }).catch(onR) },
      }
      // Decorate `.not` to flag pedimentos branch when the filter
      // argument is "pedimento"
      const originalNot = builder.not.bind(builder)
      builder.not = function (col: string) {
        if (col === 'pedimento') builder._pedimentos = true
        return originalNot(col)
      }
      return builder
    },
  } as any
}

describe('buildClientAIContext', () => {
  it('returns a typed ClientAIContext with company + shipment data', async () => {
    const stub = stubClient({
      company: { name: 'EVCO PLASTICS', rfc: 'ERB9503136F5', portal_company_name: null },
      active: [{ trafico: '9254-X1', fecha_llegada: '2026-04-20T00:00:00Z', estatus: 'Pedimento Pagado' }],
      pedimentos: [{ trafico: '9254-X0', pedimento: '26 24 3596 6500441', fecha_pago: '2026-04-10' }],
      expedientes: [{ trafico_id: '9254-X2' }, { trafico_id: '9254-X3' }],
    })
    const ctx = await buildClientAIContext(stub, 'evco')
    expect(ctx.company_name).toBe('EVCO PLASTICS')
    expect(ctx.rfc).toBe('ERB9503136F5')
    expect(ctx.active_shipments_count).toBe(1)
    expect(ctx.next_crossing_eta).toBe('2026-04-20T00:00:00Z')
    expect(ctx.recent_pedimentos[0]?.pedimento).toBe('26 24 3596 6500441')
    expect(ctx.incomplete_expedientes).toBe(2)
    expect(ctx.locale).toBe('es-MX')
  })

  it('prefers portal_company_name over raw name', async () => {
    const stub = stubClient({
      company: { name: 'EVCO PLASTICS DE MEXICO,S.DE R.L.DE C.V.', rfc: null, portal_company_name: 'EVCO' },
      active: [], pedimentos: [], expedientes: [],
    })
    const ctx = await buildClientAIContext(stub, 'evco')
    expect(ctx.company_name).toBe('EVCO')
  })

  it('falls back to "cliente" when company row is missing', async () => {
    const stub = stubClient({ company: null, active: [], pedimentos: [], expedientes: [] })
    const ctx = await buildClientAIContext(stub, 'unknown-company')
    expect(ctx.company_name).toBe('cliente')
  })
})

describe('formatClientAIContextPreamble', () => {
  it('lists all present fields and the additional client-safe rules', () => {
    const preamble = formatClientAIContextPreamble({
      company_name: 'EVCO',
      rfc: 'ERB9503136F5',
      active_shipments_count: 2,
      next_crossing_eta: '2026-04-20T00:00:00Z',
      recent_pedimentos: [
        { ref: 'X1', pedimento: '26 24 3596 6500441', fecha: '2026-04-10' },
      ],
      incomplete_expedientes: 3,
      locale: 'es-MX',
    })
    expect(preamble).toMatch(/EVCO/)
    expect(preamble).toMatch(/ERB9503136F5/)
    expect(preamble).toMatch(/Embarques activos ahora: 2/)
    expect(preamble).toMatch(/Próxima llegada prevista:/)
    expect(preamble).toMatch(/26 24 3596 6500441/)
    expect(preamble).toMatch(/Expedientes con documentos faltantes: 3/)
    // Client-safe rules embedded:
    expect(preamble).toMatch(/Nunca muestres datos de otros clientes/)
    expect(preamble).toMatch(/contacte a su agente aduanal/)
  })

  it('omits optional fields cleanly when unavailable', () => {
    const preamble = formatClientAIContextPreamble({
      company_name: 'X',
      rfc: null,
      active_shipments_count: 0,
      next_crossing_eta: null,
      recent_pedimentos: [],
      incomplete_expedientes: 0,
      locale: 'es-MX',
    })
    expect(preamble).not.toMatch(/RFC/)
    expect(preamble).not.toMatch(/Próxima llegada/)
    expect(preamble).not.toMatch(/Pedimentos recientes/)
    expect(preamble).not.toMatch(/Expedientes con/)
  })
})
