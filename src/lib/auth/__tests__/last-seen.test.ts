import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  parseLastSeenUnsafe,
  signLastSeen,
  uaBrief,
  verifyLastSeen,
} from '@/lib/auth/last-seen'

const SAMPLE = {
  iso_ts: '2026-04-27T19:32:00.000Z',
  city: 'Nuevo Laredo',
  ua_brief: 'Chrome/macOS',
}

describe('last-seen cookie helpers', () => {
  const ORIGINAL_SECRET = process.env.SESSION_SECRET
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-secret-do-not-use-in-prod'
  })
  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.SESSION_SECRET
    else process.env.SESSION_SECRET = ORIGINAL_SECRET
  })

  it('round-trips through sign + verify', async () => {
    const cookie = await signLastSeen(SAMPLE)
    expect(cookie).toMatch(/\./) // payload.signature
    const verified = await verifyLastSeen(cookie)
    expect(verified).toEqual(SAMPLE)
  })

  it('rejects a tampered payload', async () => {
    const cookie = await signLastSeen(SAMPLE)
    // Flip the second character of the base64url payload. Random bit
    // flip → almost certainly invalidates the JSON parse OR the
    // signature; either way verifyLastSeen must return null.
    const tampered = cookie[0] + (cookie[1] === 'a' ? 'b' : 'a') + cookie.slice(2)
    const verified = await verifyLastSeen(tampered)
    expect(verified).toBeNull()
  })

  it('rejects a tampered signature', async () => {
    const cookie = await signLastSeen(SAMPLE)
    // Flip a character in the signature half — payload is intact but
    // the HMAC won't validate.
    const dot = cookie.lastIndexOf('.')
    const tampered = cookie.slice(0, dot + 1) + (cookie.charAt(dot + 1) === 'a' ? 'b' : 'a') + cookie.slice(dot + 2)
    expect(await verifyLastSeen(tampered)).toBeNull()
  })

  it('rejects an empty cookie', async () => {
    expect(await verifyLastSeen('')).toBeNull()
    expect(await verifyLastSeen('not-a-cookie')).toBeNull()
  })

  it('parseLastSeenUnsafe reads the payload without verification', async () => {
    const cookie = await signLastSeen(SAMPLE)
    const parsed = parseLastSeenUnsafe(cookie)
    expect(parsed).toEqual(SAMPLE)
  })

  it('parseLastSeenUnsafe returns null on garbage', () => {
    expect(parseLastSeenUnsafe('')).toBeNull()
    expect(parseLastSeenUnsafe('xxx')).toBeNull()
    expect(parseLastSeenUnsafe('not-json.signature')).toBeNull()
  })
})

describe('uaBrief', () => {
  it('detects Chrome on macOS', () => {
    expect(
      uaBrief(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome/macOS')
  })

  it('detects Safari on iOS', () => {
    expect(
      uaBrief(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari/iOS')
  })

  it('detects Firefox on Linux', () => {
    expect(uaBrief('Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0')).toBe('Firefox/Linux')
  })

  it('detects Edge on Windows', () => {
    expect(
      uaBrief(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
      ),
    ).toBe('Edge/Windows')
  })

  it('returns empty string on unrecognized UA', () => {
    expect(uaBrief('curl/8.4.0')).toBe('')
    expect(uaBrief(null)).toBe('')
    expect(uaBrief(undefined)).toBe('')
  })
})
