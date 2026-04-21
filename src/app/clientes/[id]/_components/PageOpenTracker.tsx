'use client'

import { useEffect } from 'react'
import { useTrack } from '@/lib/telemetry/useTrack'

export function PageOpenTracker({ clienteId }: { clienteId: string }) {
  const track = useTrack()
  useEffect(() => {
    track('page_view', {
      entityType: 'cliente',
      entityId: clienteId,
    })
  }, [clienteId, track])
  return null
}
