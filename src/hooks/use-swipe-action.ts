'use client'

import { useState, useCallback, useRef } from 'react'
import {
  useMotionValue,
  useTransform,
  useReducedMotion,
  type MotionValue,
  type PanInfo,
} from 'framer-motion'
import { haptic } from './use-haptic'

interface UseSwipeActionOptions {
  /** Minimum horizontal distance to confirm (px). Default 120 for gloved hands. */
  threshold?: number
  /** Called when swipe crosses threshold and finger lifts */
  onConfirm: () => void
}

interface SwipeActionReturn {
  /** Spread onto motion.div: onPan, onPanEnd, style with x transform */
  dragProps: {
    style: { x: MotionValue<number> }
    onPan: (_e: Event, info: PanInfo) => void
    onPanEnd: () => void
    drag: 'x'
    dragConstraints: { left: number; right: number }
    dragElastic: number
    dragSnapToOrigin: boolean
  }
  /** Raw horizontal offset — use for reveal layer opacity */
  offsetX: MotionValue<number>
  /** Progress 0→1 toward threshold — use for reveal strip width/opacity */
  progress: MotionValue<number>
  /** True while user is actively dragging */
  isDragging: boolean
  /** True when drag exceeded threshold (before release) */
  isReady: boolean
}

export function useSwipeAction({
  threshold = 120,
  onConfirm,
}: UseSwipeActionOptions): SwipeActionReturn {
  const x = useMotionValue(0)
  const progress = useTransform(x, [0, threshold], [0, 1], { clamp: true }) as MotionValue<number>
  const prefersReduced = useReducedMotion()

  const [isDragging, setIsDragging] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const confirmedRef = useRef(false)

  const onPan = useCallback((_e: Event, info: PanInfo) => {
    // Only allow right swipe
    const dx = Math.max(0, info.offset.x)
    x.set(dx)
    setIsDragging(true)

    const ready = dx >= threshold
    setIsReady(ready)

    // Haptic at threshold crossing
    if (ready && !confirmedRef.current) {
      confirmedRef.current = true
      haptic.micro()
    } else if (!ready) {
      confirmedRef.current = false
    }
  }, [threshold, x])

  const onPanEnd = useCallback(() => {
    setIsDragging(false)
    if (isReady) {
      haptic.confirm()
      onConfirm()
    }
    // Reset
    if (!prefersReduced) {
      // framer-motion dragSnapToOrigin handles the spring-back
    }
    x.set(0)
    setIsReady(false)
    confirmedRef.current = false
  }, [isReady, onConfirm, prefersReduced, x])

  return {
    dragProps: {
      style: { x },
      onPan,
      onPanEnd,
      drag: 'x',
      dragConstraints: { left: 0, right: threshold * 1.2 },
      dragElastic: 0.1,
      dragSnapToOrigin: true,
    },
    offsetX: x,
    progress,
    isDragging,
    isReady,
  }
}
