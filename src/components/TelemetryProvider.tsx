'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { initTelemetry, destroyTelemetry, trackPageView } from '@/lib/telemetry'

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initTelemetry()
      initialized.current = true
    }
    return () => {
      destroyTelemetry()
      initialized.current = false
    }
  }, [])

  useEffect(() => {
    trackPageView(pathname)
  }, [pathname])

  return <>{children}</>
}
