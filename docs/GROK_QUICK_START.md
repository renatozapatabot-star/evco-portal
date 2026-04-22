# Grok Build — Quick Start Guide

Top-of-stack primer. Read this before your first edit. Points into the
full handbook (`docs/grok-build-handbook.md`) for depth.

**Read time:** 4-5 minutes. Reference bookmarks: §36-§40 of the handbook.

---

## 1. Three questions before any edit

```
1. Which surface am I touching?
     Client (/inicio · /catalogo · /mi-cuenta · /anexo-24 · /embarques ·
             /mensajeria · /cruz)
     Operator (/operador/* · /admin/eagle · /bodega/*)
     Admin-only (/admin/*)
     API route
     Shared lib (src/lib/*)
     Cron script (scripts/*)

2. Does a primitive for this already exist?
     grep -rn "functionName" src/
     Check §37 Core Primitives Reference
     Second copy = extract. Don't reinvent.

3. Am I about to introduce a phantom column?
     Check §28.2 real-schema cheat sheet
     Use col()/cols() from src/lib/schema-contracts.ts
     PHANTOM_BASELINE=0 — any regression blocks ship
```

See handbook §36.1.

## 2. Session ritual

```bash
cd ~/evco-portal
git status                      # uncommitted work?
git branch --show-current       # which branch?
npx tsc --noEmit                # type state baseline

# If the task touches intelligence or financial calculations:
npx vitest run src/lib/intelligence src/lib/financial

# Before the first commit:
bash scripts/gsd-verify.sh --ratchets-only
```

Never skip `--noEmit` before editing. Never skip `gsd-verify` before
committing.

See handbook §36.2.

## 3. Primitive index (reach for these, don't reinvent)

| Need | Primitive | Module |
|---|---|---|
| Render pedimento as `DD AD PPPP SSSSSSS` | `formatPedimento` | `src/lib/format/pedimento.ts` |
| Render fracción as `XXXX.XX.XX` | `formatFraccion` | `src/lib/format/fraccion.ts` |
| Clean company display name | `cleanCompanyDisplayName` | `src/lib/format/company-name.ts` |
| Compile-time phantom guard | `col` / `cols` | `src/lib/schema-contracts.ts` |
| Tenant-scoped single-table query | `getScopedFrom` | `src/lib/queries/tenant-scoped.ts` |
| Assert admin scope-mode override | `assertScopeMode` | same |
| Partida → trafico join (2-hop) | `resolvePartidaLinks` | `src/lib/queries/partidas-trafico-link.ts` |
| Trafico → partidas join (3-hop) | `partidasByTrafico` | `src/lib/queries/partidas-by-trafico.ts` |
| DTA · IGI · IVA (cascading) | `calculateDTA` · `calculateIGI` · `calculateIVA` · `calculatePedimento` | `src/lib/financial/calculations.ts` |
| Rates from system_config | `getDTARates` · `getIVARate` · `getExchangeRate` | `src/lib/rates.ts` |
| Crossing intelligence signals | `computePartStreaks` · `computeProveedorHealth` · `computeFraccionHealth` · `computeVolumeSummary` · `predictVerdeProbability` · `detectAnomalies` | `src/lib/intelligence/crossing-insights.ts` |
| Crossing stream composer | `buildCrossingStream` + projection helpers | `src/lib/intelligence/crossing-stream.ts` |
| Predict verde by ID | `getVerdeProbabilityForSku` · `getVerdeProbabilityForTrafico` | `src/lib/intelligence/predict-by-id.ts` |
| Explain a prediction | `explainVerdePrediction` + `...OneLine` + `...PlainText` | `src/lib/intelligence/explain.ts` |
| API response helpers | `ok` · `notFound` · `validationError` · `conflict` · `rateLimited` · `internalError` · `fail` | `src/lib/api/response.ts` |
| Auth guards | `requireAdminSession` · `requireClientSession` · `requireAnySession` · `requireOneOf` | `src/lib/auth/session-guards.ts` |
| Request-body Zod parser | `parseRequestBody` · `safeJsonParse` · `validateWithSchema` | `src/lib/validation/request-body.ts` |
| Cockpit soft-wrapped queries | `softCount` · `softData` · `softFirst` | `src/lib/cockpit/safe-query.ts` |
| Decision / operator audit logs | `logDecision` · `logOperatorAction` | `src/lib/decision-logger.ts` · `src/lib/operator-actions.ts` |

Full signatures + examples in handbook §37.

## 4. Handbook map — where to read for depth

| Task | Read |
|---|---|
| Understanding a table schema | §28.2 real-schema cheat sheet |
| Joining tables correctly | §31 cross-link recipes |
| Data-flow invariants | §29 |
| Adding a new anomaly rule | §34.3 + §40 (end-to-end) |
| Adding a new insight card | §35 + §40 (end-to-end) |
| Agent workflow + commit discipline | §36 |
| Primitives reference | §37 |
| Pattern: do / don't with real examples | §38 |
| Error handling + safety rules | §39 |
| Anomaly patterns catalog | §32 |
| Guard-rail inventory (5-layer defense) | §33 |

## 5. API route template

```ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAdminSession } from '@/lib/auth/session-guards'
import { parseRequestBody } from '@/lib/validation/request-body'
import { ok, notFound, internalError } from '@/lib/api/response'
import { createServerClient } from '@/lib/supabase-server'

const Body = z.object({
  cve_producto: z.string().min(1),
  window_days: z.number().int().min(7).max(365).optional(),
})

export async function POST(req: NextRequest) {
  // 1. Auth
  const { session, error: authError } = await requireAdminSession()
  if (authError) return authError

  // 2. Validate body
  const parsed = await parseRequestBody(req, Body, { prefix: 'predict' })
  if (parsed.error) return parsed.error

  // 3. Business logic (from src/lib/*)
  const sb = createServerClient()
  try {
    // ... call primitives, never hand-roll joins
    return ok({ result: '...' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return internalError(msg)
  }
}
```

## 6. Anti-patterns that will be reverted

- Inline glass styles (not via `<GlassCard>`)
- Raw hex colors (`#xxxxxx`) outside `src/components/aguila/`
- `.select('*')` on tenant-scoped tables without `.eq('company_id', ...)`
- `any` without a linked issue + comment
- `console.log` in production code (`.claude/hooks/pre-commit.sh` catches this)
- Flat IVA: `value * 0.16`. Always use `calculatePedimento` (cascading base)
- Stripping spaces from pedimento numbers or dots from fracciones
- Hardcoded `'9254'` / `'EVCO'` in data-fetching code

See handbook §36.7 + §38.

## 7. Definition of done (8-item checklist)

Before reporting a task complete:

- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx vitest run` — all green
- [ ] `bash scripts/gsd-verify.sh --ratchets-only` — 0 failures
- [ ] Pre-commit hook passes
- [ ] Scope honored (only surfaces you were asked to touch changed)
- [ ] New primitives documented (§37 or inline JSDoc)
- [ ] Tests added for new pure functions (≥3 each: happy + edge + regression)
- [ ] Commit message: `type(scope): what` title + WHY body

See handbook §39.7.

## 8. When in doubt

1. **Read more context** — `CLAUDE.md`, `.claude/rules/*.md`, handbook
   §28-§40 cover ~95% of cases. The answer is documented.

2. **Ask once, specifically** — if stuck on a destructive/irreversible
   action (schema migration, rate change, client-facing send), ask the
   single question that unblocks you.

3. **Smallest safe thing** — when ambiguous and no-one's available,
   ship the smallest version that works + add a
   `// TODO: [ambiguous] what would need to change for the larger version`
   comment.

4. **Default is loud** — fail visibly with a specific error. Silent
   failures are worse than loud ones. See §39.11.

## 9. Quick links

- Full handbook: `docs/grok-build-handbook.md`
- Core invariants: `.claude/rules/core-invariants.md`
- Tenant isolation rules: `.claude/rules/tenant-isolation.md`
- V1 design system: `.claude/rules/portal-design-system.md` + `.claude/rules/design-system.md`
- Session-start boot ritual: run `/boot` in Claude Code
- Phantom scanner: `node scripts/audit-phantom-columns.mjs`
- Cross-link integrity probe: `node --env-file=.env.local scripts/_m16-crosslink-audit.mjs`
- Demo-critical stress test: `node --env-file=.env.local scripts/_m16-stress-test.mjs`

---

*Last updated Day 3 of the Grok Build readiness sprint. Handbook at
3,624 lines; 11 primitives in `src/lib/` with 1,367 tests green;
PHANTOM_BASELINE=0 held.*
