/**
 * Authorization contract for /mi-cuenta (client A/R surface).
 *
 * Extracted from page.tsx so the gating logic is unit-testable.
 * See .claude/rules/client-accounting-ethics.md §7 — this module
 * underwrites the three invariants the ethics contract names:
 *
 *   1. EVCO session sees only EVCO rows       (scopedCompanyId = session.companyId)
 *   2. Non-EVCO session sees zero rows        (scopedCompanyId = session.companyId → empty result via aging primitive)
 *   3. Admin/broker session sees aggregate    (scopedCompanyId = null → no clave filter)
 *
 * Plus the feature-gate:
 *   4. Client role blocked when NEXT_PUBLIC_MI_CUENTA_ENABLED !== 'true'
 *   5. Unknown roles (no session, malformed) sent to /login
 */

export type MiCuentaSession = {
  role: string
  companyId: string
}

export type AccessDecision =
  | { decision: 'redirect'; to: '/login' | '/inicio'; reason: string }
  | {
      decision: 'render'
      isClient: boolean
      isInternal: boolean
      scopedCompanyId: string | null
      companyId: string
    }

const INTERNAL_ROLES = new Set(['admin', 'broker', 'operator', 'contabilidad', 'owner'])

/**
 * Pure, synchronous resolver — given a session (or null) and the feature
 * flag state, decide whether to render, redirect to /login (no session or
 * unknown role), or redirect to /inicio (client role while feature flag
 * is off).
 *
 * @param session          null = no session (unauthenticated or expired)
 * @param featureFlagOn    process.env.NEXT_PUBLIC_MI_CUENTA_ENABLED === 'true'
 */
export function resolveMiCuentaAccess(
  session: MiCuentaSession | null,
  featureFlagOn: boolean,
): AccessDecision {
  if (!session) {
    return { decision: 'redirect', to: '/login', reason: 'no-session' }
  }

  const role = session.role
  const isClient = role === 'client'
  const isInternal = INTERNAL_ROLES.has(role)

  // Unknown role (not client, not internal) — malformed session → login.
  if (!isClient && !isInternal) {
    return { decision: 'redirect', to: '/login', reason: 'unknown-role' }
  }

  // Feature flag only applies to client role. Internal roles always pass
  // through so admin/broker can QA the surface before it ships to clients.
  if (isClient && !featureFlagOn) {
    return { decision: 'redirect', to: '/inicio', reason: 'feature-flag-off' }
  }

  // Scope: client → their own companyId; internal → null (broker aggregate).
  const scopedCompanyId = isClient ? session.companyId : null

  return {
    decision: 'render',
    isClient,
    isInternal,
    scopedCompanyId,
    companyId: session.companyId,
  }
}
