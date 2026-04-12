'use client'

import { useEffect } from 'react'
import { useTrack } from '@/lib/telemetry/useTrack'

export function PageOpenTracker() {
  const track = useTrack()
  useEffect(() => {
    track('page_view', { entityType: 'shadow' })
  }, [track])
  return null
}
