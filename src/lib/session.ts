/**
 * PortalRole — narrow union of every role the signed session can carry.
 * `signSession` still accepts any string (legacy callers), but `verifySession`
 * rejects any decoded role not in this union.
 */
export type PortalRole =
  | 'client'
  | 'operator'
  | 'admin'
  | 'broker'
  | 'warehouse'
  | 'contabilidad'
  | 'trafico'

const PORTAL_ROLES: readonly PortalRole[] = [
  'client',
  'operator',
  'admin',
  'broker',
  'warehouse',
  'contabilidad',
  'trafico',
] as const

function isPortalRole(value: string): value is PortalRole {
  return (PORTAL_ROLES as readonly string[]).includes(value)
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('CRUZ: SESSION_SECRET must be set. Do NOT fall back to SUPABASE_SERVICE_ROLE_KEY.')
  return secret
}

/**
 * HMAC-SHA256 using Web Crypto API (Edge Runtime compatible).
 */
async function hmacSign(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(getSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacVerify(payload: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(payload)
  // Constant-time comparison (no early exit on length mismatch)
  const maxLen = Math.max(expected.length, signature.length)
  let mismatch = expected.length ^ signature.length
  for (let i = 0; i < maxLen; i++) {
    mismatch |= (expected.charCodeAt(i) || 0) ^ (signature.charCodeAt(i) || 0)
  }
  return mismatch === 0
}

/**
 * Sign a session payload. Returns a token string: `payload.signature`
 * Payload format: `companyId:role:expiresAt`
 */
export async function signSession(companyId: string, role: string, maxAgeSeconds = 28800): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + maxAgeSeconds
  const payload = `${companyId}:${role}:${expiresAt}`
  const sig = await hmacSign(payload)
  return `${payload}.${sig}`
}

/**
 * Verify a session token. Returns parsed session or null if invalid/expired.
 */
export async function verifySession(token: string): Promise<{ companyId: string; role: PortalRole; expiresAt: number } | null> {
  if (!token) return null
  const dotIdx = token.lastIndexOf('.')
  if (dotIdx < 0) return null

  const payload = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)

  const valid = await hmacVerify(payload, sig)
  if (!valid) return null

  const parts = payload.split(':')
  if (parts.length !== 3) return null

  const [companyId, role, expiresStr] = parts
  const expiresAt = parseInt(expiresStr, 10)
  if (isNaN(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null

  // Narrow role to PortalRole — reject any decoded role outside the union
  if (!isPortalRole(role)) return null

  return { companyId, role, expiresAt }
}

/**
 * requireCompanyId — narrow guard for cockpit pages that cannot proceed
 * without a tenant. Throws `no_company` so the caller can surface a 401
 * or notFound() rather than scoping a query to `undefined`.
 */
export function requireCompanyId(session: { companyId?: string | null }): string {
  if (!session?.companyId) throw new Error('no_company')
  return session.companyId
}

// ─────────────────────────────────────────────────────────────────────────────
// Prospect tokens (separate kind from portal sessions)
//
// Used by /prospect/[token] — token-gated public surface that shows a prospect
// their own importer-of-record dashboard. Distinct payload prefix `prospect:`
// so a portal session token can never be confused with a prospect token and
// vice versa, even though both ride the same HMAC primitive.
//
// Format: prospect:{rfc}:{expiresAt}.{signature}
// ─────────────────────────────────────────────────────────────────────────────

const PROSPECT_TOKEN_KIND = 'prospect'

export interface ProspectToken {
  rfc: string
  expiresAt: number
}

export async function signProspectToken(rfc: string, maxAgeSeconds = 60 * 60 * 24 * 7): Promise<string> {
  const cleanRfc = rfc.trim().toUpperCase()
  if (!/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(cleanRfc)) {
    throw new Error('invalid_rfc')
  }
  const expiresAt = Math.floor(Date.now() / 1000) + maxAgeSeconds
  const payload = `${PROSPECT_TOKEN_KIND}:${cleanRfc}:${expiresAt}`
  const sig = await hmacSign(payload)
  return `${payload}.${sig}`
}

export async function verifyProspectToken(token: string): Promise<ProspectToken | null> {
  if (!token) return null
  const dotIdx = token.lastIndexOf('.')
  if (dotIdx < 0) return null

  const payload = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)

  const valid = await hmacVerify(payload, sig)
  if (!valid) return null

  const parts = payload.split(':')
  if (parts.length !== 3) return null

  const [kind, rfc, expiresStr] = parts
  if (kind !== PROSPECT_TOKEN_KIND) return null

  const expiresAt = parseInt(expiresStr, 10)
  if (isNaN(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return null

  if (!/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) return null

  return { rfc, expiresAt }
}

/**
 * Stable hash of a prospect token suitable for storing in the DB so we can
 * (a) revoke per token without storing the token itself and (b) join view-log
 * events back to the issuance that produced them. Not for security — the HMAC
 * already provides that — just for correlation.
 */
export async function hashProspectToken(token: string): Promise<string> {
  const enc = new TextEncoder()
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(token))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
