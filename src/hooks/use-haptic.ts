'use client'

/**
 * Centralized haptic feedback patterns for CRUZ.
 * Each pattern is tuned for its context — confirm is decisive,
 * alert is attention-grabbing, celebrate is festive, micro is subtle.
 *
 * Respects user preference via localStorage 'cruz-haptics' key.
 * Safe to call on any platform — no-ops when vibration unavailable.
 */

function canVibrate(): boolean {
  if (typeof navigator === 'undefined') return false
  if (!('vibrate' in navigator)) return false
  if (typeof localStorage !== 'undefined' && localStorage.getItem('cruz-haptics') === 'off') return false
  return true
}

function vibrate(pattern: number | number[]): void {
  if (canVibrate()) navigator.vibrate(pattern)
}

export const haptic = {
  /** Swipe-to-resolve confirmation — crisp double tap */
  confirm: () => vibrate([20, 40, 20]),

  /** New notification / attention-grabbing */
  notify: () => vibrate([30, 60, 30]),

  /** Crossing celebration — festive triple */
  celebrate: () => vibrate([15, 50, 15]),

  /** Button press / micro-interaction — barely there */
  micro: () => vibrate(10),
} as const
