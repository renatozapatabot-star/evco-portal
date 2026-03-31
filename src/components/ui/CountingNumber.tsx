'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface CountingNumberProps {
  value: number
  /** Duration in ms (default 800) */
  duration?: number
  /** Format function applied to the animated number */
  format?: (n: number) => string
  /** Additional className */
  className?: string
  /** Inline style */
  style?: React.CSSProperties
}

/** Ease-out cubic: decelerates toward the end */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * Animated counting number using IntersectionObserver.
 * Fires once when the element scrolls into view.
 * Uses var(--font-mono) for tabular-nums alignment.
 */
export default function CountingNumber({
  value,
  duration = 800,
  format = (n) => String(Math.round(n)),
  className = '',
  style,
}: CountingNumberProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState<string>(format(0))
  const hasAnimated = useRef(false)

  const animate = useCallback(() => {
    if (hasAnimated.current) return
    hasAnimated.current = true

    const start = performance.now()
    const from = 0
    const to = value

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(progress)
      const current = from + (to - from) * eased
      setDisplay(format(current))

      if (progress < 1) {
        requestAnimationFrame(tick)
      }
    }

    requestAnimationFrame(tick)
  }, [value, duration, format])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // If value is 0 just show it immediately
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
