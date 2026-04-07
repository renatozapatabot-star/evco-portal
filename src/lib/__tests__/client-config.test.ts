import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock document.cookie for testing
function setCookie(name: string, value: string) {
  Object.defineProperty(document, 'cookie', {
    writable: true,
    value: `${name}=${encodeURIComponent(value)}`,
  })
}

function setMultipleCookies(cookies: Record<string, string>) {
  const cookieStr = Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ')
  Object.defineProperty(document, 'cookie', {
    writable: true,
    value: cookieStr,
  })
}

describe('client-config', () => {
  let getCookieValue: typeof import('../client-config').getCookieValue
  let getClientClaveCookie: typeof import('../client-config').getClientClaveCookie
  let getCompanyIdCookie: typeof import('../client-config').getCompanyIdCookie
  let getClientNameCookie: typeof import('../client-config').getClientNameCookie
  let getClientRfcCookie: typeof import('../client-config').getClientRfcCookie

  beforeEach(async () => {
    // Clear cookies
    Object.defineProperty(document, 'cookie', { writable: true, value: '' })
    // Re-import to get fresh module
    const mod = await import('../client-config')
    getCookieValue = mod.getCookieValue
    getClientClaveCookie = mod.getClientClaveCookie
    getCompanyIdCookie = mod.getCompanyIdCookie
    getClientNameCookie = mod.getClientNameCookie
    getClientRfcCookie = mod.getClientRfcCookie
  })

  describe('getCookieValue', () => {
    it('returns cookie value when present', () => {
      setCookie('company_id', 'evco')
      expect(getCookieValue('company_id')).toBe('evco')
    })

    it('returns undefined when cookie not found', () => {
      setCookie('other', 'value')
      expect(getCookieValue('company_id')).toBeUndefined()
    })

    it('decodes URI-encoded values', () => {
      setCookie('company_name', 'EVCO Plastics de México')
      expect(getCookieValue('company_name')).toBe('EVCO Plastics de México')
    })

    it('handles multiple cookies', () => {
      setMultipleCookies({
        company_id: 'evco',
        company_clave: '9254',
        user_role: 'client',
      })
      expect(getCookieValue('company_id')).toBe('evco')
      expect(getCookieValue('company_clave')).toBe('9254')
      expect(getCookieValue('user_role')).toBe('client')
    })

    it('handles empty cookie string', () => {
      Object.defineProperty(document, 'cookie', { writable: true, value: '' })
      expect(getCookieValue('anything')).toBeUndefined()
    })
  })

  describe('typed cookie helpers', () => {
    it('getCompanyIdCookie returns company_id or empty string', () => {
      setCookie('company_id', 'mafesa')
      expect(getCompanyIdCookie()).toBe('mafesa')
    })

    it('getClientClaveCookie returns company_clave or empty string', () => {
      setCookie('company_clave', '9254')
      expect(getClientClaveCookie()).toBe('9254')
    })

    it('getClientNameCookie returns company_name or empty string', () => {
      setCookie('company_name', 'EVCO Plastics')
      expect(getClientNameCookie()).toBe('EVCO Plastics')
    })

    it('getClientRfcCookie returns company_rfc or empty string', () => {
      setCookie('company_rfc', 'EPM001109I74')
      expect(getClientRfcCookie()).toBe('EPM001109I74')
    })

    it('returns empty string when cookie not set', () => {
      Object.defineProperty(document, 'cookie', { writable: true, value: '' })
      expect(getCompanyIdCookie()).toBe('')
      expect(getClientClaveCookie()).toBe('')
      expect(getClientNameCookie()).toBe('')
      expect(getClientRfcCookie()).toBe('')
    })
  })

  describe('multi-tenant isolation', () => {
    it('EVCO cookies return EVCO values', () => {
      setMultipleCookies({
        company_id: 'evco',
        company_clave: '9254',
        company_name: 'EVCO Plastics de México',
        company_rfc: 'EPM001109I74',
        user_role: 'client',
      })
      expect(getCompanyIdCookie()).toBe('evco')
      expect(getClientClaveCookie()).toBe('9254')
      expect(getClientNameCookie()).toBe('EVCO Plastics de México')
    })

    it('MAFESA cookies return MAFESA values', () => {
      setMultipleCookies({
        company_id: 'mafesa',
        company_clave: '4598',
        company_name: 'MAFESA',
        user_role: 'client',
      })
      expect(getCompanyIdCookie()).toBe('mafesa')
      expect(getClientClaveCookie()).toBe('4598')
      expect(getClientNameCookie()).toBe('MAFESA')
    })

    it('broker role sees internal company_id', () => {
      setMultipleCookies({
        company_id: 'internal',
        user_role: 'broker',
      })
      expect(getCompanyIdCookie()).toBe('internal')
      expect(getCookieValue('user_role')).toBe('broker')
    })
  })

  describe('deprecated constants', () => {
    it('deprecated constants are empty strings', async () => {
      const mod = await import('../client-config')
      expect(mod.CLIENT_CLAVE).toBe('')
      expect(mod.CLIENT_NAME).toBe('')
      expect(mod.COMPANY_ID).toBe('')
      expect(mod.CLIENT_RFC).toBe('')
    })
  })
})
