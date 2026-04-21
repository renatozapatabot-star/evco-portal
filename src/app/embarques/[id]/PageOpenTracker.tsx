'use client'

import { useEffect } from 'react'
import { useTrack } from '@/lib/telemetry/useTrack'

/**
 * Fires `trafico_opened` on mount. Uses the canonical `page_view`
 * telemetry type with a custom `metadata.event` tag — the
 * TelemetryEvent union is locked to 15 values, so we extend via
 * metadata rather than add new types.
 */
export function PageOpenTracker({ traficoId }: { traficoId: string }) {
  const track = useTrack()
  useEffect(() => {
    track('page_view', {
      entityType: 'trafico',
      entityId: traficoId,
      metadata: { event: 'trafico_opened' },
    })
  }, [traficoId, track])
  return null
}
