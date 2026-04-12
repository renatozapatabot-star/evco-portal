import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { track } from '../telemetry/useTrack'

describe('track()', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  const realFetch = globalThis.fetch

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('POSTs to /api/telemetry with the expected payload shape', () => {
    track('page_view', {
      entityType: 'route',
      entityId: '/traficos/26-24-3596-6500441',
      metadata: { path: '/traficos/26-24-3596-6500441' },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/telemetry')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).toMatchObject({
      event: 'page_view',
      entityType: 'route',
      entityId: '/traficos/26-24-3596-6500441',
      metadata: { path: '/traficos/26-24-3596-6500441' },
    })
  })

  it('never throws when fetch rejects', () => {
    fetchMock.mockRejectedValueOnce(new Error('network'))
    expect(() => track('notification_clicked', { entityId: 'abc' })).not.toThrow()
  })
})
