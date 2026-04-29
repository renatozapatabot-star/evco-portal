/**
 * Last-seen cookie helper — encodes a tiny non-PII summary of the
 * user's previous successful login for display on the next login.
 *
 * What we capture:
 *   - iso_ts:  ISO timestamp of the prior login (UTC)
 *   - city:    coarse location (Vercel geo headers if available)
 *   - ua_brief: "Chrome/macOS" shape — derived from User-Agent
 *
 * Why a separate cookie (not in portal_session): portal_session is
 * 8h-scoped. last_seen is intentionally 1-year-scoped so it survives
 * logouts and lets the user see "Último acceso · 27 abr 2026" on
 * every login, not just within the active session.
 *
 * Trust model: the cookie is HMAC-signed but the *display* doesn't
 * require trust — even a forged cookie only fools the user with a
 * fake last-seen line; no authority is granted by the value. The
 * signature lets us optionally validate server-side if we ever surface
 * this in a security-relevant context (we currently don't).
 */

const ENCODER = new TextEncoder()

function getSecret(): string {
  // Reuse the same secret as portal_session — there's no benefit to
  // a second secret for a non-load-bearing display cookie.
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET must be set')
  return secret
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(payload))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface LastSeenPayload {
  iso_ts: string
  city: string
  ua_brief: string
}

/**
 * Sign a last-seen payload for cookie storage. Returns a cookie value
 * `base64url(json).signature` — verifiable server-side, parseable
 * client-side without verification (display-only).
 */
export async function signLastSeen(payload: LastSeenPayload): Promise<string> {
  const json = JSON.stringify(payload)
  const b64 = base64UrlEncode(json)
  const sig = await hmac(b64)
  return `${b64}.${sig}`
}

/**
 * Verify + parse a last-seen cookie. Returns null on bad shape or
 * signature mismatch. Use server-side only.
 */
export async function verifyLastSeen(cookie: string): Promise<LastSeenPayload | null> {
  if (!cookie || typeof cookie !== 'string') return null
  const dot = cookie.lastIndexOf('.')
  if (dot < 0) return null
  const b64 = cookie.slice(0, dot)
  const sig = cookie.slice(dot + 1)
  const expected = await hmac(b64)
  if (!constantTimeEqual(expected, sig)) return null
  try {
    const json = base64UrlDecode(b64)
    const obj = JSON.parse(json) as Partial<LastSeenPayload>
    if (
      typeof obj?.iso_ts !== 'string' ||
      typeof obj?.city !== 'string' ||
      typeof obj?.ua_brief !== 'string'
    ) {
      return null
    }
    return { iso_ts: obj.iso_ts, city: obj.city, ua_brief: obj.ua_brief }
  } catch {
    return null
  }
}

/**
 * Parse a last-seen cookie WITHOUT signature verification. Suitable
 * for client-side display. Returns null on shape mismatch.
 */
export function parseLastSeenUnsafe(cookie: string): LastSeenPayload | null {
  if (!cookie || typeof cookie !== 'string') return null
  const dot = cookie.lastIndexOf('.')
  const b64 = dot < 0 ? cookie : cookie.slice(0, dot)
  try {
    const json = base64UrlDecode(b64)
    const obj = JSON.parse(json) as Partial<LastSeenPayload>
    if (
      typeof obj?.iso_ts !== 'string' ||
      typeof obj?.city !== 'string' ||
      typeof obj?.ua_brief !== 'string'
    ) {
      return null
    }
    return { iso_ts: obj.iso_ts, city: obj.city, ua_brief: obj.ua_brief }
  } catch {
    return null
  }
}

/**
 * Derive a User-Agent brief like "Chrome/macOS" from a raw UA string.
 * Falls back to "" if the UA shape is unrecognized — the line then
 * collapses to "Último acceso · {date} · {city}" without the device
 * tail.
 */
export function uaBrief(ua: string | null | undefined): string {
  if (!ua) return ''
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\//.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' :
    ''
  // iPhone/iPad UAs include "Mac OS X" — check iOS before macOS, and
  // Android before Linux for the same reason.
  const os =
    /Windows/.test(ua) ? 'Windows' :
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Macintosh|Mac OS X/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' :
    ''
  if (browser && os) return `${browser}/${os}`
  if (browser) return browser
  if (os) return os
  return ''
}

function base64UrlEncode(s: string): string {
  // Browser/Edge runtime: btoa works on binary strings; we ASCII-encode JSON first
  const bytes = ENCODER.encode(s)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  // eslint-disable-next-line no-restricted-globals
  const b64 = (typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64'))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (s.length % 4)) % 4)
  // eslint-disable-next-line no-restricted-globals
  const bin = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary')
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function constantTimeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length)
  let mismatch = a.length ^ b.length
  for (let i = 0; i < max; i++) {
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  }
  return mismatch === 0
}
