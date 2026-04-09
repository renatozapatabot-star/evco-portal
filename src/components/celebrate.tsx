'use client'

import { useEffect, useCallback } from 'react'
import { haptic } from '@/hooks/use-haptic'

/**
 * Fire confetti from both sides — used when a trafico crosses.
 * Lightweight wrapper around canvas-confetti.
 */
export function useConfetti() {
  const fire = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic import, no types available
      const confetti = (await import('canvas-confetti' as any)).default
      const gold = 'var(--gold)'
      const white = 'var(--bg-main)'

      // Left burst
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors: [gold, white, 'var(--success)'],
        gravity: 1.2,
        scalar: 0.9,
      })

      // Right burst
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors: [gold, white, 'var(--success)'],
        gravity: 1.2,
        scalar: 0.9,
      })

      // Haptic
      haptic.celebrate()
    } catch (e) { console.error('[celebrate] confetti failed:', (e as Error).message) }
  }, [])

  return fire
}

/**
 * Auto-fires confetti when `trigger` changes to true.
 * Uses sessionStorage guard so it only fires once per session per id.
 */
export function Celebrate({ trigger, id = 'default' }: { trigger: boolean; id?: string }) {
  const fire = useConfetti()

  useEffect(() => {
    if (!trigger) return
    const key = `cruz_celebrated_${id}`
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1')
    fire()
  }, [trigger, fire, id])

  return null
}
