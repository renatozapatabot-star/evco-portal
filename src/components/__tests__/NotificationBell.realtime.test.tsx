import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import React from 'react'

/**
 * Slice B1 smoke test — asserts NotificationBell establishes a Supabase
 * Realtime subscription on mount with a `company_id=eq.{companyId}` filter
 * on the `notifications` table, and tears it down on unmount.
 */

const onMock = vi.fn()
const subscribeMock = vi.fn((cb?: (status: string) => void) => {
  // Simulate a successful SUBSCRIBED status.
  cb?.('SUBSCRIBED')
  return channelApi
})
const removeChannelMock = vi.fn()

const channelApi = {
  on: (...args: unknown[]) => {
    onMock(...args)
    return channelApi
  },
  subscribe: subscribeMock,
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    channel: (_name: string) => channelApi,
    removeChannel: removeChannelMock,
  }),
}))

vi.mock('@/lib/client-config', () => ({
  getCompanyIdCookie: () => 'evco',
  getCookieValue: () => undefined,
}))

// Ensure fetch exists in jsdom and returns a harmless empty list.
beforeEach(() => {
  onMock.mockClear()
  subscribeMock.mockClear()
  removeChannelMock.mockClear()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test'
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ data: { notifications: [], unread: 0 }, error: null }), { status: 200 })
  ) as unknown as typeof fetch
})

describe('<NotificationBell /> Realtime', () => {
  it('subscribes to notifications filtered by company_id and unsubscribes on unmount', async () => {
    const { default: NotificationBell } = await import('../NotificationBell')
    const { unmount } = render(React.createElement(NotificationBell))

    // Wait a tick for the mount effect to run.
    await new Promise(r => setTimeout(r, 0))

    expect(subscribeMock).toHaveBeenCalledTimes(1)
    expect(onMock).toHaveBeenCalledTimes(1)

    const [eventName, config] = onMock.mock.calls[0] as [string, Record<string, unknown>]
    expect(eventName).toBe('postgres_changes')
    expect(config).toMatchObject({
      schema: 'public',
      table: 'notifications',
      filter: 'company_id=eq.evco',
    })

    unmount()
    expect(removeChannelMock).toHaveBeenCalledTimes(1)

    cleanup()
  })
})
