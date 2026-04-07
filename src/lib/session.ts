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
export async function verifySession(token: string): Promise<{ companyId: string; role: string; expiresAt: number } | null> {
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

  return { companyId, role, expiresAt }
}
