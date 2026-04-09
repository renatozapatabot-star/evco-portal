'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { haptic } from './use-haptic'

interface UsePullRefreshOptions {
  /** Async function to call on refresh — replaces window.location.reload() */
  onRefresh: () => Promise<void>
  /** Pull distance threshold in px. Default 80. */
  threshold?: number
}

interface PullRefreshReturn {
  /** Current pull distance (0 when not pulling) */
  pullDistance: number
  /** True while onRefresh is executing */
  isRefreshing: boolean
  /** True when pull has crossed threshold (ready to release) */
  isReady: boolean
  /** Progress 0→1 toward threshold — use for indicator opacity/rotation */
  progress: number
}

/**
 * Pull-to-refresh v2: accepts async callback instead of reloading.
 * Returns reactive values for driving indicator animations.
 * Only activates on touch devices when scrollY === 0.
 */
export function usePullRefreshV2({
  onRefresh,
  threshold = 80,
}: UsePullRefreshOptions): PullRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)
  const active = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  const isReady = pullDistance >= threshold
  const progress = Math.min(pullDistance / threshold, 1)

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (isRefreshing) return
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY
      active.current = true
    }
  }, [isRefreshing])

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!active.current || isRefreshing) return
    const dy = e.touches[0].clientY - startY.current
    if (dy > 0) {
      // Rubber-band: diminishing returns past threshold
      const capped = dy > threshold
        ? threshold + (dy - threshold) * 0.3
        : dy
      setPullDistance(capped)
    } else {
      active.current = false
      setPullDistance(0)
    }
  }, [threshold, isRefreshing])

  const onTouchEnd = useCallback(async () => {
    if (!active.current) return
    active.current = false

    if (pullDistance >= threshold && !isRefreshing) {
      haptic.micro()
      setIsRefreshing(true)
      setPullDistance(threshold * 0.6) // Hold at indicator position during refresh
      try {
        await onRefreshRef.current()
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, threshold, isRefreshing])

  useEffect(() => {
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [onTouchStart, onTouchMove, onTouchEnd])

  return { pullDistance, isRefreshing, isReady, progress }
}
