'use client'

/**
 * Lightweight i18n provider for AGUILA.
 *
 * WHY custom (not next-intl): keeps blast radius contained, zero new deps,
 * no server-boundary plumbing. Authenticated shell is fully client-rendered
 * so cookie + localStorage hydration is enough for MVP.
 *
 * Missing keys fall back to the provided fallback string (or the key itself),
 * so partial translation never crashes a page.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import esMX from './messages/es-MX.json'
import enUS from './messages/en-US.json'

export type Locale = 'es-MX' | 'en-US'

const DICTIONARIES: Record<Locale, Record<string, string>> = {
  'es-MX': esMX as Record<string, string>,
  'en-US': enUS as Record<string, string>,
}

const LOCALE_COOKIE = 'aguila_locale'
const LOCALE_STORAGE_KEY = 'aguila:locale'
const DEFAULT_LOCALE: Locale = 'es-MX'

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, fallback?: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return m ? decodeURIComponent(m[2]) : null
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return
  const maxAge = 60 * 60 * 24 * 365 // 1 year
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`
}

function normalize(raw: string | null | undefined): Locale {
  return raw === 'en-US' ? 'en-US' : 'es-MX'
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Start with default to avoid SSR/client mismatch — hydrate from storage in effect.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    try {
      const fromStorage = typeof window !== 'undefined' ? window.localStorage.getItem(LOCALE_STORAGE_KEY) : null
      const fromCookie = readCookie(LOCALE_COOKIE)
      const resolved = normalize(fromStorage ?? fromCookie)
      if (resolved !== locale) setLocaleState(resolved)
    } catch {
      /* ignore — fall back to default */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(LOCALE_STORAGE_KEY, next)
      writeCookie(LOCALE_COOKIE, next)
    } catch { /* storage may be unavailable — cookie still works */ }

    // Fire-and-forget server persistence; never block the UI on it.
    try {
      fetch('/api/settings/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      }).catch(() => { /* ignore — localStorage is source of truth client-side */ })
    } catch { /* ignore */ }
  }, [])

  const t = useCallback((key: string, fallback?: string): string => {
    const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE]
    return dict[key] ?? fallback ?? key
  }, [locale])

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (ctx) return ctx
  // Safe fallback: if provider isn't mounted (e.g., a test harness), act as passthrough.
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => { /* noop */ },
    t: (_k: string, fallback?: string) => fallback ?? _k,
  }
}
