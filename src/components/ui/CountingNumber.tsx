'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface CountingNumberProps {
  value: number
  /** Duration in ms (default 1200 — v2 counting token) */
  duration?: number
  /** Format function applied to the animated number */
  format?: (n: number) => string
  /** Additional className */
  className?: string
  /** Inline style */
  style?: React.CSSProperties
  /** Session key — animation fires once per session per key */
  sessionKey?: string
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * v2 CountingNumber: fires ONCE per session (sessionStorage flag).
 * Uses var(--font-mono) + tabular-nums for alignment.
 * Respects prefers-reduced-motion.
 */
export default function CountingNumber({
  value,
  duration = 1200,
  format = (n) => String(Math.round(n)),
  className = '',
  style,
  sessionKey,
}: CountingNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState<string>(format(value))
  const hasAnimated = useRef(false)

  // Check if already animated this session
  const storageKey = sessionKey ? `cruz_counted_${sessionKey}` : null

  const animate = useCallback(() => {
    if (hasAnimated.current) return
    hasAnimated.current = true

    // Check reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(format(value))
      if (storageKey) sessionStorage.setItem(storageKey, '1')
      return
    }

    // Check sessionStorage
    if (storageKey && typeof sessionStorage !== 'undefined') {
      if (sessionStorage.getItem(storageKey)) {
        setDisplay(format(value))
        return
      }
    }

    const start = performance.now()

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(progress)
      const current = value * eased
      setDisplay(format(current))

      if (progress < 1) {
        requestAnimationFrame(tick)
      } else if (storageKey) {
        sessionStorage.setItem(storageKey, '1')
      }
    }

    requestAnimationFrame(tick)
  }, [value, duration, format, storageKey])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (value === 0) {
      setDisplay(format(0))
      hasAnimated.current = true
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          animate()
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [value, animate, format])

  // Update display if value changes after animation
  useEffect(() => {
    if (hasAnimated.current) {
      setDisplay(format(value))
    }
  }, [value, format])

  return (
    <span
      ref={ref}
      className={className}
      style={{
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {display}
    </span>
  )
}
