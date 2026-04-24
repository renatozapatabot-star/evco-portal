/**
 * Which tenants run in shadow mode today?
 *
 * Hardcoded allowlist matches the 30-day north star: Ursula (EVCO) and
 * MAFESA get the 3 Killer Workflows wired into their dashboard.
 * Everyone else keeps the current cockpit until the shadow run has
 * produced enough feedback to promote each rule.
 *
 * Kept as a constant rather than a companies.features flag so a
 * runtime config typo cannot accidentally enable live-action paths
 * on a third tenant. New tenants join by editing this list plus a
 * tested PR — matching the HARD-invariant posture around tenant
 * isolation.
 */

export const SHADOW_MODE_COMPANIES: readonly string[] = ['evco', 'mafesa'] as const

export function isShadowModeCompany(companyId: string | null | undefined): boolean {
  if (!companyId) return false
  return SHADOW_MODE_COMPANIES.includes(companyId.toLowerCase())
}
