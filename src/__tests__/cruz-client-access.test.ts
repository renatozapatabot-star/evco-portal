/**
 * Regression fence — `/cruz` MUST be reachable for client role.
 *
 * Origin: founder-override 2026-05-05 "Lift /cruz client gate (rescind
 * 2026-04-24 V1 AI strip)" in `.claude/rules/founder-overrides.md`.
 * The gate was lifted after three pre-conditions met:
 *   1. Cross-tenant fence (PR #34) — resolveTenantScope hard-403s any
 *      client request that probes a foreign tenant; cross_tenant_attempt
 *      audit-log row written.
 *   2. /api/cruz-chat session-scoped via the same resolveTenantScope
 *      helper /api/data uses; 23 tools all .eq('company_id', companyId).
 *   3. UX promise was already advertised — palette renders "El asistente
 *      responde con tus datos reales"; the gate silently broke that.
 *
 * If a future commit re-adds `'/cruz'` to `ADMIN_ONLY_ROUTES` without
 * a fresh dated founder-override entry, this test fails — surfaces the
 * regression at PR time before middleware bounces clients to
 * `/?unavailable=1`.
 *
 * Sibling tests (not duplicated here):
 *   · `src/app/api/cruz-chat/__tests__/cookie-fence.test.ts` —
 *     cookie-forged company_id cannot cross-tenant read at the chat API.
 *   · `src/app/api/cruz-ai/actions/__tests__/tenant-isolation.test.ts`
 *     — action executor stays tenant-scoped.
 */

import { describe, expect, it } from 'vitest'
import { ADMIN_ONLY_ROUTES, CLIENT_ROUTES } from '@/components/nav/nav-config'

describe('/cruz — client gate lifted (founder-override 2026-05-05)', () => {
  it('is NOT in ADMIN_ONLY_ROUTES', () => {
    // The middleware bounce path (`src/middleware.ts:101-108`) walks
    // ADMIN_ONLY_ROUTES with `pathname === route || pathname.startsWith(route + '/')`.
    // Both shapes must miss for client role to reach /cruz.
    const adminList = ADMIN_ONLY_ROUTES as readonly string[]
    expect(adminList).not.toContain('/cruz')

    // Defense-in-depth — assert no entry would match `/cruz/<sub>` either.
    // Subroute lookups also walk this list, so a stray `/cruz` parent
    // would gate `/cruz/some-thread` even after this entry was removed.
    const wouldMatch = adminList.some(r =>
      r === '/cruz' || '/cruz'.startsWith(r + '/'),
    )
    expect(wouldMatch).toBe(false)
  })

  it('is in CLIENT_ROUTES (allowlist parity with the lift)', () => {
    // The role allowlist is the readability gate — it tells future
    // sessions the route is intentionally client-reachable, not a leak.
    expect(CLIENT_ROUTES as readonly string[]).toContain('/cruz')
  })

  it('lift is scoped to /cruz only — sibling AI surfaces stay gated', () => {
    // V1 Clean Visibility (2026-04-24) gated MULTIPLE AI surfaces.
    // The 2026-05-05 founder-override scope is explicit: /cruz only.
    // /asistente, /anomalias, /analytics, /monitor, /inteligencia,
    // /contabilidad, /mi-cuenta, /reportes, /kpis stay gated.
    // If any of these slips out of ADMIN_ONLY_ROUTES alongside /cruz,
    // it needs its OWN founder-override entry — not coattail-riding.
    const adminList = ADMIN_ONLY_ROUTES as readonly string[]
    const stillGated = [
      '/asistente',
      '/anomalias',
      '/analytics',
      '/monitor',
      '/inteligencia',
      '/contabilidad',
      '/mi-cuenta',
      '/reportes',
      '/kpis',
    ]
    for (const route of stillGated) {
      expect(adminList, `${route} must remain gated`).toContain(route)
    }
  })
})
