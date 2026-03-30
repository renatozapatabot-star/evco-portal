'use client'
import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  format?: (n: number) => string
  duration?: number
}

export function AnimatedNumber({ value, format, duration = 600 }: AnimatedNumberProps) {
  const [displayed, setDisplayed] = useState(0)
  const rafRef = useRef<number>(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const start = performance.now()
    const initial = prevRef.current

    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(initial + (value - initial) * eased)
      setDisplayed(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        prevRef.current = value
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [value, duration])

  return <>{format ? format(displayed) : displayed.toLocaleString('es-MX')}</>
}
