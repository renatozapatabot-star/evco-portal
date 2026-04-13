'use client'

import { useEffect } from 'react'
import { useTrack } from '@/lib/telemetry/useTrack'

// Spec lists `trafico_opened` in this page's telemetry set. The canonical
// telemetry union uses `page_view`; we emit page_view with an entity_type
// of "trafico" so the analytics surface can filter by it.
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
