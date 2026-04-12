'use client'

interface TelemetryEvent {
  event_type: string
  event_name?: string
  page_path: string
  session_id?: string
  payload?: Record<string, unknown>
  viewport?: string
  timestamp: string
}

let buffer: TelemetryEvent[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let sessionId: string | null = null

const FLUSH_INTERVAL = 5_000
const MAX_BUFFER = 20
const ENDPOINT = '/api/telemetry'

function getSessionId(): string {
  if (sessionId) return sessionId
  try {
    sessionId = sessionStorage.getItem('_tid') || crypto.randomUUID()
    sessionStorage.setItem('_tid', sessionId)
  } catch {
    sessionId = crypto.randomUUID()
  }
  return sessionId
}

function getViewport(): string {
  if (typeof window === 'undefined') return ''
  return `${window.innerWidth}x${window.innerHeight}`
}

function flush(): void {
  if (buffer.length === 0) return
  const events = [...buffer]
  buffer = []

  try {
    const body = JSON.stringify({ events })

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const sent = navigator.sendBeacon(
        ENDPOINT,
        new Blob([body], { type: 'application/json' })
      )
      if (sent) return
    }

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'include',
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Silent — telemetry never breaks the app
  }
}

/**
 * Track any interaction event.
 *
 * Standard event_type values:
 *   page_view, click, search, filter, export,
 *   ai_query, form_submit, error, scroll_depth
 */
export function trackEvent(
  eventType: string,
  eventName?: string,
  payload?: Record<string, unknown>
): void {
  try {
    if (typeof window === 'undefined') return

    buffer.push({
      event_type: eventType,
      event_name: eventName,
      page_path: window.location.pathname,
      session_id: getSessionId(),
      payload,
      viewport: getViewport(),
      timestamp: new Date().toISOString(),
    })

    if (buffer.length >= MAX_BUFFER) flush()
  } catch {
    // Silent
  }
}

export function trackPageView(path?: string): void {
  trackEvent('page_view', undefined, {
    referrer: typeof document !== 'undefined' ? document.referrer : undefined,
    path: path || (typeof window !== 'undefined' ? window.location.pathname : '/'),
  })
}

export function trackClick(
  eventName: string,
  payload?: Record<string, unknown>
): void {
  trackEvent('click', eventName, payload)
}

export function trackSearch(query: string, resultCount?: number): void {
  trackEvent('search', 'search_submit', {
    query_length: query.length,
    result_count: resultCount,
  })
}

export function trackAIQuery(payload?: Record<string, unknown>): void {
  trackEvent('ai_query', 'cruz_chat', payload)
}

export function initTelemetry(): void {
  try {
    if (typeof window === 'undefined') return
    if (flushTimer) return

    flushTimer = setInterval(flush, FLUSH_INTERVAL)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
    window.addEventListener('pagehide', flush)
  } catch {
    // Silent
  }
}

export function destroyTelemetry(): void {
  try {
    if (flushTimer) {
      clearInterval(flushTimer)
      flushTimer = null
    }
    flush()
  } catch {
    // Silent
  }
}
