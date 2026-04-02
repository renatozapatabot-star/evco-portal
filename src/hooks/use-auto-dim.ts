'use client'

import { useEffect } from 'react'

/**
 * Auto-dim: toggles html[data-autodim="night"] between 10 PM and 6 AM.
 * CSS custom properties in globals.css handle the visual shift.
 */
export function useAutoDim() {
  useEffect(() => {
    function update() {
      const h = new Date().getHours()
      const isNight = h >= 22 || h < 6
      document.documentElement.setAttribute(
        'data-autodim',
        isNight ? 'night' : 'day'
      )
    }
    update()
    const interval = setInterval(update, 60_000) // check every minute
    return () => clearInterval(interval)
  }, [])
}
