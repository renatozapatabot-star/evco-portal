'use client'

import { useEffect } from 'react'
import { useTrack } from '@/lib/telemetry/useTrack'

/**
 * Fires `trace_view_opened` on mount via the canonical `page_view`
 * telemetry type — the TelemetryEvent union is locked to 15 values,
 * so new surfaces differentiate through metadata.event.
 */
export function PageOpenTracker({ traficoId }: { traficoId: string }) {
  const track = useTrack()
  useEffect(() => {
    track('page_view', {
      entityType: 'trafico',
      entityId: traficoId,
      metadata: { event: 'trace_view_opened' },
    })
  }, [traficoId, track])
  return null
}
