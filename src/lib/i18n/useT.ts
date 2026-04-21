'use client'

import { useI18n } from './provider'

/**
 * Convenience hook. Returns the translator function directly.
 *
 * Usage:
 *   const t = useT()
 *   t('nav.inicio')                  // → "Inicio" / "Home"
 *   t('foo.bar', 'Fallback text')    // → falls back gracefully when key missing
 */
export function useT() {
  const { t } = useI18n()
  return t
}
