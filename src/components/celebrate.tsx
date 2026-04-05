'use client'

import { useEffect, useCallback } from 'react'

/**
 * Fire confetti from both sides — used when a trafico crosses.
 * Lightweight wrapper around canvas-confetti.
 */
export function useConfetti() {
  const fire = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic import, no types available
      const confetti = (await import('canvas-confetti' as any)).default
      const gold = '#C4963C'
      const white = '#FAFAF8'

      // Left burst
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors: [gold, white, '#16A34A'],
        gravity: 1.2,
        scalar: 0.9,
      })

      // Right burst
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors: [gold, white, '#16A34A'],
        gravity: 1.2,
        scalar: 0.9,
      })

      // Haptic
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([15, 50, 15])
      }
    } catch {}
  }, [])

  return fire
}

/**
 * Auto-fires confetti when `trigger` changes to true.
 */
export function Celebrate({ trigger }: { trigger: boolean }) {
  const fire = useConfetti()

  useEffect(() => {
    if (trigger) fire()
  }, [trigger, fire])

  return null
}
