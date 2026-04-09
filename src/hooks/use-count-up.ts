'use client'
import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration = 600, decimals = 0) {
  const scale = Math.pow(10, decimals)
  const [count, setCount] = useState(0)
  const prevTarget = useRef(0)

  useEffect(() => {
    if (target === 0) { setCount(0); return }
    const startVal = prevTarget.current
    const start = performance.now()

    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      const raw = startVal + (target - startVal) * eased
      setCount(Math.round(raw * scale) / scale)
      if (progress < 1) requestAnimationFrame(animate)
      else prevTarget.current = target
    }
    requestAnimationFrame(animate)
  }, [target, duration, scale])

  return count
}
