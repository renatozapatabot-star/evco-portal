'use client'

import { useEffect, useRef, useState } from 'react'

interface NumberMorphProps {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
  style?: React.CSSProperties
}

/**
 * Smooth number morphing — animates between values with easing.
 * Unlike CountingNumber which counts up from 0, this morphs between any two values.
 */
export function NumberMorph({ value, duration = 600, format, className, style }: NumberMorphProps) {
  const [display, setDisplay] = useState(value)
  const prevValue = useRef(value)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const from = prevValue.current
    const to = value
    prevValue.current = value

    if (from === to) return

    const startTime = performance.now()
    const diff = to - from

    function animate(time: number) {
      const elapsed = time - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + diff * eased))

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }

    // Respect reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(to)
      return
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  const formatted = format ? format(display) : display.toLocaleString('es-MX')

  return (
    <span className={className} style={style}>
      {formatted}
    </span>
  )
}
