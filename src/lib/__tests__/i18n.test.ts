/**
 * V1.5 F13 — i18n dictionary + fallback behavior.
 */
import { describe, it, expect } from 'vitest'
import esMX from '../i18n/messages/es-MX.json'
import enUS from '../i18n/messages/en-US.json'

describe('i18n dictionaries', () => {
  it('en-US and es-MX share the same key set', () => {
    const esKeys = Object.keys(esMX).sort()
    const enKeys = Object.keys(enUS).sort()
    expect(enKeys).toEqual(esKeys)
  })

  it('translates core nav keys differently between locales', () => {
    const es = esMX as Record<string, string>
    const en = enUS as Record<string, string>
    expect(es['nav.inicio']).toBe('Inicio')
    expect(en['nav.inicio']).toBe('Home')
    expect(es['common.save']).toBe('Guardar')
    expect(en['common.save']).toBe('Save')
  })

  it('covers the required MVP key namespaces', () => {
    const es = esMX as Record<string, string>
    const requiredPrefixes = ['nav.', 'common.', 'header.', 'status.', 'cockpit.', 'eagle.']
    for (const prefix of requiredPrefixes) {
      const hit = Object.keys(es).some(k => k.startsWith(prefix))
      expect(hit, `missing namespace ${prefix}`).toBe(true)
    }
  })
})
