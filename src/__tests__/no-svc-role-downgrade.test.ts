/**
 * Service-role downgrade guard — P0-A4 regression check.
 *
 * Closes audit finding V5 (MEDIUM — silent SERVICE_ROLE → ANON
 * downgrade in 11+ routes) from
 * ~/Desktop/audit-tenant-isolation-2026-04-28.md.
 *
 * Pre-fix pattern (12 sites):
 *
 *   const supabase = createClient(
 *     process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *     process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
 *   )
 *
 * If SERVICE_ROLE_KEY is missing (env misconfig, key rotation race,
 * preview-deploy with incomplete env), the createClient call silently
 * downgraded to the anon role. Pre-anon-revoke that masked failure;
 * post-anon-revoke (P0-A1) the queries return empty arrays — also
 * masking the failure as "no data" rather than an env bug.
 *
 * Post-fix every call site explicitly checks SUPABASE_SERVICE_ROLE_KEY
 * is present and throws on miss. This test is the regression fence —
 * grep across all source for the disallowed fallback pattern. Any
 * future code that re-introduces it fails CI.
 */

import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

describe('no silent SERVICE_ROLE → ANON downgrade in src/', () => {
  it('grep for the disallowed fallback pattern returns zero matches', () => {
    let stdout = ''
    let exitCode = 0
    try {
      stdout = execSync(
        `grep -rln "SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY" src/ 2>/dev/null | grep -v __tests__ | grep -v ".test." || true`,
        { encoding: 'utf8', cwd: process.cwd() },
      )
    } catch (e: unknown) {
      exitCode = (e as { status?: number }).status ?? 1
    }
    const matches = stdout.split('\n').filter(Boolean)
    expect(
      matches.length,
      `Found silent service-role downgrade in: ${matches.join(', ')}. Each site must check process.env.SUPABASE_SERVICE_ROLE_KEY explicitly and throw on miss. See P0-A4 commit message for the canonical pattern.`,
    ).toBe(0)
    expect(exitCode).toBe(0)
  })
})
