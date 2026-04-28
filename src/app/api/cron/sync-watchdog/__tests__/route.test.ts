/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Three behavioral checks for /api/cron/sync-watchdog:
 *   1. 401 when neither x-cron-secret nor Bearer matches.
 *   2. 200 + alerted:false when last success < 30 min.
 *   3. 503 + alerted:true when last success > 30 min.
 *
 * Supabase + Telegram fetch are mocked. Tests run in isolation.
 */

let mockLastSuccess: string | null = null
const telegramCalls: Array<{ url: string; body: string }> = []

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: () => ({
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: string) => ({
          eq: (_col2: string, _val2: string) => ({
            order: (_c: string, _o: any) => ({
              limit: (_n: number) => ({
                maybeSingle: async () => ({
                  data: mockLastSuccess
                    ? { completed_at: mockLastSuccess, status: 'success' }
                    : null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  }),
}))

const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }

beforeEach(() => {
  mockLastSuccess = null
  telegramCalls.length = 0
  process.env = {
    ...originalEnv,
    CRON_SECRET: 'test-secret-ABC',
    TELEGRAM_BOT_TOKEN: 'test-bot-token',
    TELEGRAM_CHAT_ID: '-100',
    TELEGRAM_SILENT: 'false',
    SYNC_WATCHDOG_STALE_MIN: '30',
  }
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    telegramCalls.push({
      url: String(url),
      body: init?.body ?? '',
    })
    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  }) as any
})

afterEach(() => {
  globalThis.fetch = originalFetch
  process.env = originalEnv
})

function makeReq(headers: Record<string, string> = {}): NextRequest {
  const url = 'https://portal.local/api/cron/sync-watchdog'
  return new NextRequest(url, { method: 'GET', headers })
}

describe('GET /api/cron/sync-watchdog', () => {
  it('returns 401 when neither x-cron-secret nor Bearer matches', async () => {
    const { GET } = await import('../route')
    const res = await GET(makeReq({}))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(telegramCalls).toHaveLength(0)
  })

  it('returns 200 + alerted:false when last globalpc_delta success is recent', async () => {
    mockLastSuccess = new Date(Date.now() - 5 * 60_000).toISOString()
    const { GET } = await import('../route')
    const res = await GET(makeReq({ 'x-cron-secret': 'test-secret-ABC' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.verdict).toBe('green')
    expect(body.data.alerted).toBe(false)
    expect(body.data.minutes_ago).toBeLessThanOrEqual(5)
    expect(telegramCalls).toHaveLength(0)
  })

  it('returns 503 + alerted:true when last success is older than threshold', async () => {
    mockLastSuccess = new Date(Date.now() - 90 * 60_000).toISOString()
    const { GET } = await import('../route')
    const res = await GET(makeReq({ 'x-cron-secret': 'test-secret-ABC' }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.data.verdict).toBe('red')
    expect(body.data.alerted).toBe(true)
    expect(body.data.minutes_ago).toBeGreaterThanOrEqual(89)
    expect(telegramCalls).toHaveLength(1)
    expect(telegramCalls[0].url).toContain('api.telegram.org')
    expect(telegramCalls[0].body).toContain('globalpc_delta')
  })

  it('honors TELEGRAM_SILENT=true even when stale', async () => {
    process.env.TELEGRAM_SILENT = 'true'
    mockLastSuccess = new Date(Date.now() - 200 * 60_000).toISOString()
    const { GET } = await import('../route')
    const res = await GET(makeReq({ 'x-cron-secret': 'test-secret-ABC' }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.data.verdict).toBe('red')
    expect(body.data.alerted).toBe(false)
    expect(telegramCalls).toHaveLength(0)
  })

  it('accepts authorization: Bearer header (Vercel native cron pattern)', async () => {
    mockLastSuccess = new Date(Date.now() - 5 * 60_000).toISOString()
    const { GET } = await import('../route')
    const res = await GET(makeReq({ authorization: 'Bearer test-secret-ABC' }))
    expect(res.status).toBe(200)
  })
})
