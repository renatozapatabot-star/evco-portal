import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { softCount, softData, softFirst, createQuerySignals } from '../safe-query'

type PgResult<T> = { data: T | null; error: unknown; count?: number | null }

function okCount(count: number): Promise<PgResult<unknown>> {
  return Promise.resolve({ data: [], error: null, count })
}
function errCount(message: string): Promise<PgResult<unknown>> {
  return Promise.resolve({ data: null, error: { message }, count: null })
}
function okData<T>(rows: T[]): Promise<PgResult<T[]>> {
  return Promise.resolve({ data: rows, error: null })
}
function errData<T>(message: string): Promise<PgResult<T[]>> {
  return Promise.resolve({ data: null, error: { message } })
}

describe('safe-query signals', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('softCount returns count on success and does not touch signals', async () => {
    const signals = createQuerySignals()
    const n = await softCount(okCount(42), { label: 'traficos.activos', signals })
    expect(n).toBe(42)
    expect(signals.failureCount).toBe(0)
    expect(signals.failedLabels).toEqual([])
  })

  it('softCount returns 0 + records signal + warns on error', async () => {
    const signals = createQuerySignals()
    const n = await softCount(errCount('column foo does not exist'), { label: 'traficos.activos', signals })
    expect(n).toBe(0)
    expect(signals.failureCount).toBe(1)
    expect(signals.failedLabels).toEqual(['traficos.activos'])
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  it('signals deduplicate labels on repeated failures', async () => {
    const signals = createQuerySignals()
    await softCount(errCount('e1'), { label: 'traficos.activos', signals })
    await softCount(errCount('e2'), { label: 'traficos.activos', signals })
    await softCount(errCount('e3'), { label: 'entradas.semana', signals })
    expect(signals.failureCount).toBe(3)
    expect(signals.failedLabels).toEqual(['traficos.activos', 'entradas.semana'])
  })

  it('softData returns rows on success and empty + signal on error', async () => {
    const signals = createQuerySignals()
    const good = await softData<{ id: number }>(okData([{ id: 1 }, { id: 2 }]), { label: 'ok', signals })
    expect(good).toHaveLength(2)
    const bad = await softData<{ id: number }>(errData('boom'), { label: 'broken', signals })
    expect(bad).toEqual([])
    expect(signals.failedLabels).toEqual(['broken'])
  })

  it('softFirst returns first row or null + signal on error', async () => {
    const signals = createQuerySignals()
    const first = await softFirst<{ id: number }>(okData([{ id: 7 }]), { label: 'ok', signals })
    expect(first).toEqual({ id: 7 })
    const missing = await softFirst<{ id: number }>(okData([]), { label: 'empty', signals })
    expect(missing).toBeNull()
    expect(signals.failureCount).toBe(0)
    const failed = await softFirst<{ id: number }>(errData('rls'), { label: 'rls-denied', signals })
    expect(failed).toBeNull()
    expect(signals.failedLabels).toEqual(['rls-denied'])
  })

  it('backward-compat: numeric second arg still means timeoutMs', async () => {
    // Number form continues to work without signals.
    const n = await softCount(okCount(5), 2000)
    expect(n).toBe(5)
  })

  it('timeout is recorded as a separate kind', async () => {
    const signals = createQuerySignals()
    const slow: Promise<PgResult<unknown>> = new Promise((resolve) => setTimeout(() => resolve({ data: [], error: null, count: 99 }), 500))
    const n = await softCount(slow, { label: 'slow.query', signals, timeoutMs: 20 })
    expect(n).toBe(0)
    expect(signals.failureCount).toBe(1)
    expect(signals.failedLabels).toEqual(['slow.query'])
    // warn message includes 'timeout'
    const calls = warnSpy.mock.calls.map((c: unknown[]) => String(c[0]))
    expect(calls.some((c: string) => c.includes('timeout'))).toBe(true)
  })
})
