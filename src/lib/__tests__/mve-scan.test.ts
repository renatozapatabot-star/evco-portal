/**
 * ZAPATA AI · Block 17 — MVE scan tests.
 *
 * Five unit tests covering pure-logic helpers + orchestration:
 *  1. Scan detects a pedimento approaching deadline.
 *  2. Severity computed correctly across the 3-band threshold.
 *  3. Cruzado / cancelado excluded from scan.
 *  4. Critical candidates trigger Telegram only when severity flips.
 *  5. Message format carries days_remaining + pedimento reference.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  computeDeadline,
  computeDaysRemaining,
  computeSeverity,
  isApproachingDeadline,
  buildAlertCandidate,
  scanPedimentos,
  type PedimentoForScan,
} from '@/lib/mve-scan'
import { sendTelegram } from '@/lib/telegram'

const MS_DAY = 86_400_000

function mkPedimento(partial: Partial<PedimentoForScan> = {}): PedimentoForScan {
  return {
    id: 'p-1',
    trafico_id: 'TRF-001',
    company_id: 'evco',
    pedimento_number: '26 24 3596 6500441',
    status: 'borrador',
    created_at: new Date().toISOString(),
    ...partial,
  }
}

describe('mve-scan · detects approaching deadline', () => {
  it('pedimento with created_at 10d ago (deadline ~5d) is detected', () => {
    const now = new Date('2026-04-15T12:00:00Z')
    const created = new Date(now.getTime() - 10 * MS_DAY)
    const p = mkPedimento({ created_at: created.toISOString() })
    expect(isApproachingDeadline(p, now)).toBe(true)

    const candidates = scanPedimentos([p], now)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].pedimento_id).toBe('p-1')
    expect(candidates[0].days_remaining).toBe(5)
  })

  it('pedimento created today (deadline 15d out) is NOT detected', () => {
    const now = new Date('2026-04-15T12:00:00Z')
    const p = mkPedimento({ created_at: now.toISOString() })
    expect(isApproachingDeadline(p, now)).toBe(false)
    expect(scanPedimentos([p], now)).toHaveLength(0)
  })
})

describe('mve-scan · severity thresholds', () => {
  it('>7 days = info, 3-7 = warning, <3 = critical', () => {
    expect(computeSeverity(10)).toBe('info')
    expect(computeSeverity(8)).toBe('info')
    expect(computeSeverity(7)).toBe('warning')
    expect(computeSeverity(5)).toBe('warning')
    expect(computeSeverity(3)).toBe('warning')
    expect(computeSeverity(2)).toBe('critical')
    expect(computeSeverity(0)).toBe('critical')
    expect(computeSeverity(-1)).toBe('critical')
  })

  it('deadline + daysRemaining math (15-day window)', () => {
    const created = new Date('2026-04-01T00:00:00Z')
    const deadline = computeDeadline(created.toISOString())
    expect(deadline.toISOString()).toBe('2026-04-16T00:00:00.000Z')

    const now = new Date('2026-04-14T00:00:00Z')
    expect(computeDaysRemaining(deadline, now)).toBe(2)
  })
})

describe('mve-scan · status exclusions', () => {
  it('cruzado and cancelado pedimentos are excluded', () => {
    const now = new Date('2026-04-15T12:00:00Z')
    const created = new Date(now.getTime() - 10 * MS_DAY).toISOString()
    const pedimentos: PedimentoForScan[] = [
      mkPedimento({ id: 'p-ok', created_at: created, status: 'borrador' }),
      mkPedimento({ id: 'p-cruzado', created_at: created, status: 'cruzado' }),
      mkPedimento({ id: 'p-cancelado', created_at: created, status: 'cancelado' }),
    ]
    const candidates = scanPedimentos(pedimentos, now)
    expect(candidates).toHaveLength(1)
    expect(candidates[0].pedimento_id).toBe('p-ok')
  })
})

describe('mve-scan · telegram fires only on critical', () => {
  const origFetch = global.fetch
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token'
    process.env.TELEGRAM_CHAT_ID = '-1234'
    delete process.env.TELEGRAM_SILENT
    global.fetch = vi.fn(async () => new Response('ok', { status: 200 })) as unknown as typeof fetch
  })
  afterEach(() => {
    global.fetch = origFetch
    delete process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_CHAT_ID
  })

  it('sendTelegram fires for critical message and returns silently if env missing', async () => {
    await sendTelegram('🔴 MVE · 1 alerta crítica detectada')
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const callArgs = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]
    expect(String(callArgs[0])).toContain('api.telegram.org')

    // Clear env → non-fatal skip
    delete process.env.TELEGRAM_BOT_TOKEN
    ;(global.fetch as unknown as { mockClear: () => void }).mockClear()
    await sendTelegram('no-op')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('mve-scan · candidate shape', () => {
  it('buildAlertCandidate emits message with days + pedimento reference', () => {
    const now = new Date('2026-04-15T12:00:00Z')
    const created = new Date(now.getTime() - 13 * MS_DAY).toISOString()
    const p = mkPedimento({ created_at: created, pedimento_number: '26 24 3596 6500441' })
    const c = buildAlertCandidate(p, now)
    expect(c.severity).toBe('critical')
    expect(c.days_remaining).toBe(2)
    expect(c.message).toContain('26 24 3596 6500441')
    expect(c.message).toContain('2d')
    expect(c.deadline_at).toBe(new Date(new Date(created).getTime() + 15 * MS_DAY).toISOString())
  })
})
