'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@/lib/telemetry/useTrack'

/**
 * V1 Polish Pack · Block 0 — page_view emitter.
 * Mounted once inside DashboardShellClient. Fires a `page_view` event
 * every time the pathname changes. Deduped per path to avoid double
 * firing on fast remounts.
 */
export default function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || pathname === lastPath.current) return
    lastPath.current = pathname
    track('page_view', { metadata: { path: pathname }, entityType: 'route', entityId: pathname })
  }, [pathname])

  return <>{children}</>
}
