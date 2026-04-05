'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Pull-to-refresh for mobile. Shows a visual indicator when user
 * pulls down at the top of the page, then triggers a full reload.
 * Only activates when scrollY === 0 and touch distance > threshold.
 */
export function usePullToRefresh(threshold = 80) {
  const [pulling, setPulling] = useState(false)
  const [distance, setDistance] = useState(0)
  const startY = useRef(0)
  const active = useRef(false)

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY
      active.current = true
    }
  }, [])

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!active.current) return
    const dy = e.touches[0].clientY - startY.current
    if (dy > 0) {
      setDistance(Math.min(dy, threshold * 1.5))
      setPulling(dy > threshold)
    } else {
      active.current = false
      setDistance(0)
      setPulling(false)
    }
  }, [threshold])

  const onTouchEnd = useCallback(() => {
    if (pulling) {
      window.location.reload()
    }
    active.current = false
    setDistance(0)
    setPulling(false)
  }, [pulling])

  useEffect(() => {
    // Only on touch devices
    if (!('ontouchstart' in window)) return

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [onTouchStart, onTouchMove, onTouchEnd])

  return { pulling, distance }
}
