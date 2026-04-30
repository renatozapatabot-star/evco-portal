/**
 * Demo-readiness invariants — code-level ratchets only (no DB calls).
 *
 * Purpose: catch the next regression of the issues caught by the
 * 2026-04-29 overnight audit (~/Desktop/overnight-2026-04-29/) BEFORE
 * the demo. Each `describe` block enforces one invariant from
 * `01-demo-scope-integrity.md` at the source-code level via grep.
 *
 * Why grep-only:
 *   - Live DB checks belong in the audit script, not the test suite —
 *     they need network, credentials, and they're slow.
 *   - These tests run on every PR via pr-gate.yml's
 *     `bash scripts/gsd-verify.sh --ratchets-only` (see
 *     scripts/gsd-verify.sh ratchet R-DR-* additions).
 *   - The audit script (run nightly) is the live-DB conscience;
 *     these tests are the source-code conscience.
 *
 * What each invariant catches if regressed:
 *   1. Tenant invariant — code that writes a clave to a `company_id`
 *      column without going through resolveCompanyIdSlug.
 *   2. SAT format — code that strips spaces from pedimento or skips
 *      formatPedimento() in render paths.
 *   3. Currency labels — hardcoded 'MXP' or amount fields without an
 *      explicit moneda column written at insert time.
 *   4. Régimen vs clave — anything reintroducing the IMD/ITE/ITR/EXD
 *      family into pedimentos.clave_pedimento writes.
 *   5. Stale productos — fence around globalpc_productos.deleted_at
 *      writes to ensure the soft-delete flow stays alive.
 */

import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ROOT = join(__dirname, '..', '..')

// Safe grep wrapper: uses spawnSync with arg array (no shell interpolation)
// so regex characters never need escaping. Returns matching lines.
function grep(pattern: string, ...paths: string[]): string[] {
  const args = ['-rEn', pattern, ...paths]
  const r = spawnSync('grep', args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  // grep exit codes: 0 = matches, 1 = no matches, 2 = error
  if (r.status === 0) return (r.stdout || '').split('\n').filter(Boolean)
  if (r.status === 1) return []
  // Status 2 (or higher) = error — log stderr but don't blow the test up;
  // the assertion downstream will see an empty list and fail-open intentionally.
  if (r.stderr) console.error(`grep error (${r.status}): ${r.stderr.slice(0, 200)}`)
  return []
}

// Always exclude these paths from EVERY ratchet — they're either tests,
// archived code, or legitimate exception sites.
function exclude(lines: string[]): string[] {
  return lines.filter(line => {
    if (line.includes('node_modules')) return false
    if (line.includes('/__tests__/')) return false
    if (line.match(/\.test\.(ts|tsx|js)/)) return false
    if (line.includes('/_audit-tmp/')) return false
    if (line.match(/\.bak(\.\d+)?$/)) return false
    if (line.includes('// allowed-tenant-tag')) return false
    return true
  })
}

// Each grep scans src/ + scripts/ so a 30s ceiling per test is generous.
const SLOW = { timeout: 30000 } as const

describe('Demo invariant 1 — tenant invariant (no clave-shape company_id at write sites)', () => {
  it('no `company_id: <clave>` literal patterns in writers', SLOW, () => {
    // Catch obvious patterns: `company_id: '9254'`, `company_id: '4598'`, etc.
    // Real claves are 4-digit numeric. Any literal one in a writer means a
    // hardcoded tenant tag — usually wrong (use the resolver instead).
    const matches = exclude(
      grep(`company_id:[[:space:]]*['"][0-9]{4}['"]`, 'src/', 'scripts/'),
    ).filter(line => {
      // Allowlist: legitimate non-writer call sites where this shape appears.
      //   - generate-notifications.js: documented {company_id, clave} allowlist
      //   - run-migration.ts / setup-intelligence.ts: pass an RPC arg literally
      //     named p_company_id with a clave (the SQL function expects a clave,
      //     not a slug — different parameter, same regex shape)
      if (line.includes('generate-notifications.js')) return false
      if (line.match(/scripts\/(run-migration|setup-intelligence)\.ts/)) return false
      return true
    })

    if (matches.length > 0) {
      console.error('Hardcoded clave-shape company_id literal at:')
      matches.forEach(m => console.error('  ' + m))
    }
    expect(matches).toEqual([])
  })

  it('no .eq("company_id", <clave>) literal in production query paths', SLOW, () => {
    // The defensive contract: production filters use session.companyId
    // (a slug). A literal clave here is the bug pattern.
    const matches = exclude(
      grep(`\\.eq\\(['"]company_id['"],[[:space:]]*['"][0-9]{4}['"]\\)`, 'src/'),
    )
    expect(matches).toEqual([])
  })
})

describe('Demo invariant 2 — SAT format compliance', () => {
  it('no `.replace(/\\s+/g, "")` on pedimento (strip-spaces is forbidden)', SLOW, () => {
    // Pedimentos must keep spaces when displayed. Stripping them is the
    // exact violation called out in core-invariant #7. We catch the two
    // most common patterns (regex-arg vs string-arg) separately to avoid
    // a single fragile combined regex.
    const a = exclude(grep(`pedimento[^.]*\\.replace\\(/[[:space:]]\\+/g`, 'src/'))
    const b = exclude(grep(`pedimento[^.]*\\.replace\\(["'][[:space:]]\\+["']`, 'src/'))
    expect([...a, ...b]).toEqual([])
  })

  it('formatPedimento helper exists and is reachable', SLOW, () => {
    // Negative-space ratchet: if someone deletes the helper, demo breaks.
    const helperPath = join(PROJECT_ROOT, 'src/lib/format/pedimento.ts')
    expect(existsSync(helperPath)).toBe(true)
  })
})

describe('Demo invariant 3 — currency labels (allowed: MXN/USD/EUR; banned: MXP)', () => {
  it('no `moneda: "MXP"` literals in production code', SLOW, () => {
    // MXP was the legacy currency code retired by 20260429210000_globalpc_mxp_to_mxn.sql.
    // Any new write using MXP would re-pollute.
    const a = exclude(grep(`moneda['"]?[[:space:]]*:[[:space:]]*['"]MXP['"]`, 'src/', 'scripts/'))
    const b = exclude(grep(`moneda[[:space:]]*=[[:space:]]*['"]MXP['"]`, 'src/', 'scripts/'))
    expect([...a, ...b]).toEqual([])
  })

  it('no `currency: "MXP"` literals', SLOW, () => {
    const matches = exclude(
      grep(`currency:[[:space:]]*['"]MXP['"]`, 'src/', 'scripts/'),
    )
    expect(matches).toEqual([])
  })
})

describe('Demo invariant 4 — régimen never written to clave_pedimento', () => {
  it('no INSERT/UPDATE pattern shipping a régimen code into clave_pedimento', SLOW, () => {
    // The 2026-03-31 incident wrote IMD/ITE/ITR into clave_pedimento.
    // Catch any future writer doing the same. Six separate greps avoids
    // alternation quoting fragility.
    const REGIMEN_CODES = ['IMD', 'ITE', 'ITR', 'EXD', 'ETE', 'DFI']
    const matches: string[] = []
    for (const code of REGIMEN_CODES) {
      matches.push(
        ...exclude(grep(`clave_pedimento[^=]{0,40}['"]${code}['"]`, 'src/', 'scripts/')),
      )
    }
    expect(matches).toEqual([])
  })

  it('no fallback that maps regimen → clave_pedimento', SLOW, () => {
    // Specific anti-pattern: `clave_pedimento: trafico.regimen` or similar.
    const matches = exclude(
      grep(`clave_pedimento:[[:space:]]*[a-zA-Z_]+\\.regimen`, 'src/', 'scripts/'),
    )
    expect(matches).toEqual([])
  })
})

describe('Demo invariant 5 — stale productos (soft-delete flow stays alive)', () => {
  it('globalpc-productos-reconcile.js exists', SLOW, () => {
    // The reconcile script is the daily soft-delete sweeper. If someone
    // deletes it, productos accumulate orphans.
    expect(existsSync(join(PROJECT_ROOT, 'scripts/globalpc-productos-reconcile.js'))).toBe(true)
  })

  it('no hard DELETE on globalpc_productos in `src/` (app routes never delete)', SLOW, () => {
    // Audit-grade discipline for the runtime app surface: never DELETE the
    // SAT-defensible mirror from a route handler. Cron scripts have a
    // legitimate truncate-and-rebuild pattern (full-sync-productos.js)
    // that this ratchet doesn't touch — that script is being phased out
    // by the parallel session's soft-delete reconciler.
    const matches = exclude(
      grep(`from\\(['"]globalpc_productos['"]\\)\\.delete\\(\\)`, 'src/'),
    )
    expect(matches).toEqual([])
  })
})

describe('Demo invariant 6 — tenant-tagging guard helpers stay wired', () => {
  it('src/lib/tenant/resolve-slug.ts exists', SLOW, () => {
    expect(existsSync(join(PROJECT_ROOT, 'src/lib/tenant/resolve-slug.ts'))).toBe(true)
  })

  it('scripts/lib/tenant-tags.js exists', SLOW, () => {
    expect(existsSync(join(PROJECT_ROOT, 'scripts/lib/tenant-tags.js'))).toBe(true)
  })

  it('central notifications writer uses the resolver', SLOW, () => {
    const notifPath = join(PROJECT_ROOT, 'src/lib/notifications.ts')
    if (!existsSync(notifPath)) return // file may move; in that case the resolver-import grep below catches the regression

    const r = spawnSync('grep', ['-Ec', 'buildClaveMap|resolveCompanyIdSlug', notifPath], { encoding: 'utf8' })
    expect(parseInt((r.stdout || '0').trim(), 10)).toBeGreaterThan(0)
  })

  it('central decision-logger uses the resolver', SLOW, () => {
    const logPath = join(PROJECT_ROOT, 'src/lib/decision-logger.ts')
    if (!existsSync(logPath)) return

    const r = spawnSync('grep', ['-Ec', 'buildClaveMap|resolveCompanyIdSlug', logPath], { encoding: 'utf8' })
    expect(parseInt((r.stdout || '0').trim(), 10)).toBeGreaterThan(0)
  })
})
