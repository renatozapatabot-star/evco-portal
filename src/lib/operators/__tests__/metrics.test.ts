/**
 * AGUILA · V1.5 F10 — Operator metrics unit tests.
 *
 * In-memory Supabase double serves table rows per-call. We assert the pure
 * reducer math (cycle avg, error rate, MVE compliance, classification accuracy,
 * last active) against known fixtures.
 */
import { describe, it, expect } from 'vitest'
import { computeOperatorMetrics, formatHours, formatPct } from '../metrics'

interface TableData {
  operators?: Record<string, unknown>[]
  operator_actions?: Record<string, unknown>[]
  workflow_events?: Record<string, unknown>[]
  traficos?: Record<string, unknown>[]
  mve_alerts?: Record<string, unknown>[]
  document_classifications?: Record<string, unknown>[]
}

function makeStub(data: TableData) {
  function chain(rows: Record<string, unknown>[] | undefined) {
    const out = {
      data: rows ?? [],
      error: null as unknown,
      eq() { return out },
      in() { return out },
      gte() { return out },
      lte() { return out },
      order() { return out },
      limit() { return Promise.resolve(out) },
      then(resolve: (v: { data: unknown; error: unknown }) => void) {
        resolve({ data: rows ?? [], error: null })
      },
    }
    return out
  }
  function from(table: string) {
    return {
      select() {
        return chain(data[table as keyof TableData])
      },
    }
  }
  return { from }
}

const RANGE = { from: '2026-04-01T00:00:00Z', to: '2026-04-30T23:59:59Z' }

describe('operators/metrics', () => {
  it('returns empty array when no operators exist for company', async () => {
    const sb = makeStub({ operators: [] })
    const rows = await computeOperatorMetrics(sb, 'evco', RANGE)
    expect(rows).toEqual([])
  })

  it('computes traficosHandled, errorRate, lastActiveAt from operator_actions', async () => {
    const sb = makeStub({
      operators: [
        { id: 'op1', full_name: 'Eloisa', role: 'operator', company_id: 'evco', active: true },
      ],
      operator_actions: [
        { operator_id: 'op1', action_type: 'open_trafico', target_table: 'traficos', target_id: 't1', created_at: '2026-04-05T10:00:00Z' },
        { operator_id: 'op1', action_type: 'edit_trafico', target_table: 'traficos', target_id: 't1', created_at: '2026-04-06T10:00:00Z' },
        { operator_id: 'op1', action_type: 'open_trafico', target_table: 'traficos', target_id: 't2', created_at: '2026-04-07T10:00:00Z' },
        { operator_id: 'op1', action_type: 'classification_error', target_table: 'classifications', target_id: 'c1', created_at: '2026-04-08T10:00:00Z' },
      ],
    })
    const [row] = await computeOperatorMetrics(sb, 'evco', RANGE)
    expect(row.traficosHandled).toBe(2)
    expect(row.errorRate).toBeCloseTo(0.25, 5)
    expect(row.lastActiveAt).toBe('2026-04-08T10:00:00Z')
    expect(row.classificationAccuracy).toBeNull()
  })

  it('computes avgCycleHours from workflow_events for assigned tráficos', async () => {
    const sb = makeStub({
      operators: [
        { id: 'op1', full_name: 'Claudia', role: 'operator', company_id: 'evco', active: true },
      ],
      traficos: [
        { trafico: 't1', assigned_to_operator_id: 'op1' },
        { trafico: 't2', assigned_to_operator_id: 'op1' },
      ],
      workflow_events: [
        { event_type: 'supplier_confirmed', trigger_id: 't1', created_at: '2026-04-01T00:00:00Z' },
        { event_type: 'semaforo_verde',     trigger_id: 't1', created_at: '2026-04-02T00:00:00Z' },
        { event_type: 'entrada_received',   trigger_id: 't2', created_at: '2026-04-10T00:00:00Z' },
        { event_type: 'semaforo_verde',     trigger_id: 't2', created_at: '2026-04-12T00:00:00Z' },
      ],
    })
    const [row] = await computeOperatorMetrics(sb, 'evco', RANGE)
    // t1 = 24h, t2 = 48h, avg = 36h
    expect(row.avgCycleHours).toBeCloseTo(36, 3)
  })

  it('computes mveComplianceRate and classificationAccuracy', async () => {
    const sb = makeStub({
      operators: [
        { id: 'op1', full_name: 'Anabel', role: 'operator', company_id: 'evco', active: true },
      ],
      traficos: [
        { trafico: 't1', assigned_to_operator_id: 'op1' },
        { trafico: 't2', assigned_to_operator_id: 'op1' },
        { trafico: 't3', assigned_to_operator_id: 'op1' },
        { trafico: 't4', assigned_to_operator_id: 'op1' },
      ],
      mve_alerts: [{ trafico_id: 't1' }],
      document_classifications: [
        { confirmed_by: 'op1', confirmed_match: true },
        { confirmed_by: 'op1', confirmed_match: true },
        { confirmed_by: 'op1', confirmed_match: false },
      ],
    })
    const [row] = await computeOperatorMetrics(sb, 'evco', RANGE)
    expect(row.mveComplianceRate).toBeCloseTo(0.75, 5) // 3 of 4 clean
    expect(row.classificationAccuracy).toBeCloseTo(2 / 3, 5)
  })

  it('formatPct and formatHours handle nulls + units', () => {
    expect(formatPct(null)).toBe('—')
    expect(formatPct(0.1234, 1)).toBe('12.3%')
    expect(formatHours(null)).toBe('—')
    expect(formatHours(0.5)).toBe('30 min')
    expect(formatHours(24.5)).toBe('24.5 h')
  })
})
