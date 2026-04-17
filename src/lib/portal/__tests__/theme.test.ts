import { describe, expect, it } from 'vitest'
import {
  PORTAL_THEME_DEFAULTS,
  parsePortalTheme,
  serializePortalTheme,
} from '@/lib/portal/theme'

describe('parsePortalTheme', () => {
  it('returns defaults when cookie is missing', () => {
    expect(parsePortalTheme(undefined)).toEqual(PORTAL_THEME_DEFAULTS)
    expect(parsePortalTheme(null)).toEqual(PORTAL_THEME_DEFAULTS)
    expect(parsePortalTheme('')).toEqual(PORTAL_THEME_DEFAULTS)
  })

  it('returns defaults when cookie is malformed JSON', () => {
    expect(parsePortalTheme('not-json')).toEqual(PORTAL_THEME_DEFAULTS)
    expect(parsePortalTheme('%7B%22accent%22%3A')).toEqual(PORTAL_THEME_DEFAULTS)
  })

  it('picks only allowed values and falls back to defaults per field', () => {
    const raw = serializePortalTheme({
      accent: 'teal',
      bg: 'near',
      density: 'compact',
      type: 'grotesque',
      motion: 'off',
    })
    expect(parsePortalTheme(raw)).toEqual({
      accent: 'teal',
      bg: 'near',
      density: 'compact',
      type: 'grotesque',
      motion: 'off',
    })
  })

  it('rejects out-of-scale values per field without throwing', () => {
    const raw = encodeURIComponent(
      JSON.stringify({ accent: 'magenta', bg: 'void', density: 'nuclear' }),
    )
    const parsed = parsePortalTheme(raw)
    expect(parsed.accent).toBe(PORTAL_THEME_DEFAULTS.accent)
    expect(parsed.bg).toBe('void')
    expect(parsed.density).toBe(PORTAL_THEME_DEFAULTS.density)
  })

  it('round-trips through serializePortalTheme', () => {
    const theme = {
      accent: 'lime' as const,
      bg: 'blueprint' as const,
      density: 'spacious' as const,
      type: 'mono-all' as const,
      motion: 'off' as const,
    }
    expect(parsePortalTheme(serializePortalTheme(theme))).toEqual(theme)
  })
})
