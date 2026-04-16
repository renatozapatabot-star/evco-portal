/**
 * CRUZ · V1.5 F9 — Orchestrator unit tests.
 *
 * Five tests exercise the pure helpers + the orchestrator loop against an
 * in-memory Supabase double. Tables the orchestrator writes to are captured
 * as `{ table, op, row }` records so we can assert the lifecycle emits the
 * right events without touching the real DB.
 */
import { describe, it, expect } from 'vitest'
import {
  DEMO_COMPANY_ID,
  buildInitialRun,
  getDemoRun,
  makeTraficoRef,
  runOrchestrator,
} from '../orchestrator'

interface Insert {
  table: string
  row: Record<string, unknown>
}

function makeStubSupabase() {
  const inserts: Insert[] = []
  const selectResults: Record<string, unknown[]> = {}

  function from(table: string) {
    return {
      insert(row: Record<string, unknown>) {
        inserts.push({ table, row })
        return Promise.resolve({ error: null })
      },
      select() {
        return {
          eq() { return this },
          in() { return this },
          maybeSingle() {
            const rows = selectResults[table] ?? []
            return Promise.resolve({ data: rows[0] ?? null })
          },
          limit() {
            return Promise.resolve({ data: selectResults[table] ?? [] })
          },
        }
      },
      delete() {
        return {
          eq() { return Promise.resolve({ count: 0, error: null }) },
          in() { return Promise.resolve({ error: null }) },
        }
      },
    }
  }

  // cast to loose `any` — shape matches only the calls the orchestrator makes
  const sb = { from } as unknown as Parameters<typeof runOrchestrator>[0]
  return { sb, inserts, selectResults }
}

describe('demo/orchestrator', () => {
  it('buildInitialRun seeds 12 pending steps with stable ids', () => {
    const run = buildInitialRun('run-1', 'DEMO-ABC123')
    expect(run.steps).toHaveLength(12)
    expect(run.steps.every((s) => s.status === 'pending')).toBe(true)
    expect(run.steps.map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(run.companyId).toBe(DEMO_COMPANY_ID)
    expect(run.traficoId).toBe('DEMO-ABC123')
  })

  it('makeTraficoRef produces a DEMO- prefixed upper-case short ref', () => {
    const ref = makeTraficoRef()
    expect(ref).toMatch(/^DEMO-[A-Z0-9]{3,6}$/)
  })

  it('runOrchestrator walks every step to done and fires a completion event', async () => {
    const { sb, inserts } = makeStubSupabase()
    const run = buildInitialRun('run-2', 'DEMO-FINISH')
    // Fast-forward: override setTimeout to zero-delay globally for this test.
    const realSetTimeout = global.setTimeout
    // @ts-expect-error — test-only patch
    global.setTimeout = (fn: () => void) => realSetTimeout(fn, 0)
    try {
      await runOrchestrator(sb, run)
    } finally {
      global.setTimeout = realSetTimeout
    }

    expect(run.finishedAt).toBeTruthy()
    expect(run.steps.every((s) => s.status === 'done')).toBe(true)

    const workflowEventTypes = inserts
      .filter((i) => i.table === 'workflow_events')
      .map((i) => i.row.event_type as string)

    expect(workflowEventTypes).toContain('supplier_confirmed')
    expect(workflowEventTypes).toContain('warehouse_received')
    expect(workflowEventTypes).toContain('semaforo_verde')
    expect(workflowEventTypes).toContain('mve_alert_raised')
    expect(workflowEventTypes).toContain('mve_alert_resolved')
    expect(workflowEventTypes).toContain('demo_run_completed')

    // Telemetry fires at start and completion.
    const telemetryEvents = inserts
      .filter((i) => i.table === 'interaction_events')
      .map((i) => i.row.event_name as string)
    expect(telemetryEvents).toContain('demo_run_started')
    expect(telemetryEvents).toContain('demo_run_completed')
  })

  it('runOrchestrator inserts a classification_sheets row, invoices row, and quickbooks_export_jobs row', async () => {
    const { sb, inserts } = makeStubSupabase()
    const run = buildInitialRun('run-3', 'DEMO-FULL')
    const realSetTimeout = global.setTimeout
    // @ts-expect-error — test-only patch
    global.setTimeout = (fn: () => void) => realSetTimeout(fn, 0)
    try {
      await runOrchestrator(sb, run)
    } finally {
      global.setTimeout = realSetTimeout
    }

    const classSheet = inserts.find((i) => i.table === 'classification_sheets')
    expect(classSheet).toBeTruthy()
    expect(classSheet?.row.trafico_id).toBe('DEMO-FULL')
    expect(classSheet?.row.partidas_count).toBe(3)

    const invoice = inserts.find((i) => i.table === 'invoices')
    expect(invoice).toBeTruthy()
    expect(invoice?.row.company_id).toBe(DEMO_COMPANY_ID)
    expect(invoice?.row.currency).toBe('MXN')

    const qb = inserts.find((i) => i.table === 'quickbooks_export_jobs')
    expect(qb).toBeTruthy()
    expect(qb?.row.entity).toBe('invoices')
    expect(qb?.row.status).toBe('ready')
  })

  it('getDemoRun returns the in-memory run while it is active and null for unknown ids', async () => {
    const { sb } = makeStubSupabase()
    const run = buildInitialRun('run-4', 'DEMO-LOOKUP')
    const realSetTimeout = global.setTimeout
    // @ts-expect-error — test-only patch
    global.setTimeout = (fn: () => void) => realSetTimeout(fn, 0)
    try {
      const p = runOrchestrator(sb, run)
      // Runner registers the run synchronously before the first await.
      expect(getDemoRun('run-4')).not.toBeNull()
      await p
    } finally {
      global.setTimeout = realSetTimeout
    }
    expect(getDemoRun('does-not-exist')).toBeNull()
  })
})
