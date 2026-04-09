'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { haptic } from './use-haptic'

interface NetworkStatus {
  isOnline: boolean
  lastOnlineAt: Date | null
  /** True briefly after reconnection — auto-resets after 3s */
  wasOffline: boolean
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true)
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null)
  const [wasOffline, setWasOffline] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const goOffline = useCallback(() => {
    setIsOnline(false)
    setLastOnlineAt(new Date())
  }, [])

  const goOnline = useCallback(() => {
    setIsOnline(prev => {
      if (!prev) {
        // Was offline, now reconnected
        setWasOffline(true)
        haptic.notify()
        if (resetTimer.current) clearTimeout(resetTimer.current)
        resetTimer.current = setTimeout(() => setWasOffline(false), 3000)
      }
      return true
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsOnline(navigator.onLine)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [goOnline, goOffline])

  return { isOnline, lastOnlineAt, wasOffline }
}
