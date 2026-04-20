# MAFESA Onboarding Runbook — client #2 white-label activation

> Executable checklist for onboarding the first non-EVCO tenant (MAFESA
> per CLAUDE.md "next client"). Every step has a verification command.
> If you can't verify, don't proceed — back up and investigate.

**Status:** Blocked on Tito for MAFESA RFC + GlobalPC clave_cliente.
Everything below is cockpit-ready the moment those arrive.

**Why this exists:** CLAUDE.md §MULTI-TENANT says "every feature must
answer 'how does this work for a non-EVCO client?'" Without a codified
runbook, the second-client onboarding is ad-hoc and regression-prone.
This file is the one-page answer.

---

## Prerequisites (before starting)

| Item | Owner | Status |
|---|---|---|
| MAFESA RFC | Tito | pending |
| MAFESA GlobalPC `cve_cliente` (4-digit clave) | Tito | pending |
| MAFESA portal credentials (desired username + initial password) | Tito | pending |
| Subdomain decision (`mafesa.portal.renatozapata.com`?) | Tito + Renato IV | pending |
| Anthropic credit topup | external | pending (CLAUDE.md flag) |

Do NOT proceed until the first 3 are supplied. Hardcoding a placeholder
clave or RFC invites regression.

---

## Step 1 — branch + pre-flight (5 min)

```bash
cd ~/evco-portal
git checkout main
git pull
git checkout -b feat/mafesa-onboarding-$(date +%Y-%m-%d)
bash scripts/ship.sh --skip-deploy      # confirm green floor
```

Gate 1 must be 🟢 end-to-end. The alert-coverage gate (28/29 baseline),
R11/R12/R13 ratchets, and 817+ tests must all pass.

---

## Step 2 — white-label audit (15 min)

CLAUDE.md §MULTI-TENANT defines this. Must return zero production
matches before any MAFESA data is written:

```bash
grep -rn "9254\|EVCO\|evco" src/ --include="*.ts" --include="*.tsx" \
  | grep -v __tests__ | grep -v '\.test\.' | grep -v 'components/aguila/AguilaEagle'
```

Test fixtures (`'evco'` as test tenant slug) are acceptable.
Rendered UI text ("Evco Plastics de México" as displayed company name)
is acceptable — the name comes from `companies.name`, not a literal.
Production data-fetching code with `'9254'` is NOT acceptable.

Current state verified 2026-04-19: **0 production matches.** If this
regresses, do not onboard until clean.

---

## Step 3 — seed the `companies` row (2 min, via SQL)

**Before** any sync runs. Block EE contract (tenant-isolation.md
Step 1 — "companies row FIRST").

```sql
INSERT INTO companies (company_id, clave_cliente, name, active, rfc)
VALUES (
  'mafesa',              -- canonical slug · MUST be lowercase · MUST be unique
  '<4-digit-clave>',     -- from Tito (GlobalPC cve_cliente)
  'MAFESA',              -- legal-form preservation handled by cleanCompanyDisplayName
  true,                  -- set false during setup if you want to stage
  '<RFC>'                -- from Tito
);
```

**One slug per clave.** Do NOT create `mafesa-s-a-de-c-v` + `mafesa`
duplicates — the Block EE retag archived 48 of these as SEV-2
contamination.

Verify:

```sql
SELECT company_id, clave_cliente, name, active FROM companies
WHERE company_id = 'mafesa';
-- expect exactly 1 row
```

---

## Step 4 — apply pending migrations (5 min)

```bash
# Queue defined in supabase/MIGRATION_QUEUE.md
npx supabase db push
npx supabase gen types typescript --linked > types/supabase.ts
```

As of 2026-04-20 the queue has:
- `20260420_fx_savings_heuristic.sql`
- `20260420_perf_indexes.sql`

These are not MAFESA-specific but should be applied before a new
tenant's data floods the hot-path tables.

---

## Step 5 — dry-run the tenant-reassign (5 min)

Even on a clean database, run this. It's the canary for mapping gaps.

```bash
node scripts/tenant-reassign-company-id.js --dry-run
```

Expected output: **zero unexpected plans.** If the script proposes
reassigning rows you didn't expect, investigate before proceeding.
Don't drop `--dry-run` unless plans read "0 rows" or "only legacy
slug → clean slug."

---

## Step 6 — create the portal auth user (2 min)

HMAC session model — NOT Supabase auth. Create via the activate-client
script (or insert directly per the pattern in activate-client.js):

```bash
node scripts/activate-client.js --company-id mafesa --username '<username>' --password '<initial>'
```

Verify the session signs + verifies:

```bash
node -e "
  const { signSession, verifySession } = require('./src/lib/session')
  (async () => {
    const t = await signSession({companyId:'mafesa', role:'client'})
    console.log('verified:', await verifySession(t))
  })()
"
# expect: verified: { companyId: 'mafesa', role: 'client', expiresAt: <future> }
```

---

## Step 7 — run the isolation red-team (10 min)

Use the tests we built to prove MAFESA can't see EVCO and vice-versa.

```bash
# Primitive-level: aging math scoped to mafesa clave
# (runs in normal vitest suite — confirms no regression)
npx vitest run src/lib/contabilidad/__tests__/aging.test.ts
npx vitest run src/app/mi-cuenta/__tests__/isolation.test.ts
npx vitest run "src/app/api/catalogo/partes/[cveProducto]/__tests__/tenant-isolation.test.ts"

# API-level: use the tenant-isolation test file as the template —
# parameterize for mafesa instead of evco, verify same invariants
# hold. This step is the go/no-go for client #2 activation.
```

**Manual red-team (browser + dev tools):**

1. Log in as MAFESA user
2. Attempt to request `/api/catalogo/partes/[SOME_EVCO_SKU]` by pasting
   an EVCO cve_producto into the URL.
3. Assert response is `404 NOT_FOUND`, not `200` and not `403 FORBIDDEN`.
4. Attempt to override via `?company_id=evco` query param.
5. Assert response is still `404`.
6. Check Browser DevTools Network tab: response body reveals no EVCO
   data, no EVCO identifiers, no "try a different tenant" hint.

Step 7.6 failing is **SEV-1** — halt. Do not activate MAFESA until
isolation is verified.

---

## Step 8 — first sync + coverage check (15 min)

```bash
# Nightly syncs write globalpc_* rows for the new tenant
node scripts/globalpc-sync.js --company-id mafesa

# Block EE contract — every row MUST have company_id='mafesa'
# (never null, never fallback to 'evco')
```

Verify via SQL:

```sql
SELECT company_id, COUNT(*) FROM globalpc_productos
WHERE company_id IN ('mafesa', null)
GROUP BY 1;
-- expect: only 'mafesa' rows, COUNT > 0
-- if any null rows appear: stop, run tenant-reassign-company-id.js
```

Then hit:

```bash
curl https://portal.renatozapata.com/api/health/data-integrity?tenant=mafesa
# expect verdict: green OR amber (amber OK while initial sync populates)
```

---

## Step 9 — spot-check cockpit + /mi-cuenta (10 min)

With `NEXT_PUBLIC_MI_CUENTA_ENABLED=true` on Vercel (or `false` if
feature-gating client role until Tito walks through MAFESA too):

- `/inicio` under MAFESA session → shows MAFESA data only
- `/mi-cuenta` under MAFESA session → shows MAFESA A/R only
- `/catalogo` under MAFESA session → shows MAFESA parts only, no
  EVCO bleed

Run Claude-in-Chrome `/audit 1` prompt against the MAFESA portal URL.

---

## Step 10 — ship + announce (5 min)

```bash
git add .
git commit -m "feat(mafesa): onboard client #2 · patente 3596"
git push origin feat/mafesa-onboarding-<date>

# After PR review + Tito sign-off:
gh pr merge
bash scripts/ship.sh       # full 6 gates including Vercel deploy
# then on Throne:
pm2 save                   # ensure cron processes hold
```

Tito sends MAFESA the login URL + credentials via Mensajería (not
Telegram per CLAUDE.md — Telegram is infra-only).

---

## What this runbook closes

Before this session, MAFESA onboarding was:
- CLAUDE.md fragment on white-label checklist
- tenant-isolation.md fragment on the data-side invariants
- No test fence on the API boundary
- No one-page runbook

After this session, it's:
- 10-step runbook (this file)
- `/api/catalogo/partes/[cveProducto]` tenant-isolation.test.ts (8
  assertions proving cross-tenant → 404, not 403)
- `/mi-cuenta/isolation.test.ts` (20 assertions proving the auth
  contract)
- `aging.test.ts` (8 assertions proving clave_cliente scoping)
- `alert-coverage-audit.js` enforcing 28/29 scripts signal failure
- `system-config-expiry-watch.js` protecting rate-staleness

Any regression in any of those puts MAFESA in jeopardy → ship.sh
gate fails → do not deploy.

---

## Known blockers (as of 2026-04-20)

- Tito: RFC + clave_cliente for MAFESA
- Tito: portal credentials
- Tito: subdomain decision (subfolder vs subdomain vs Vercel alias)
- Subdomain DNS (if going that route) needs CNAME to evco-portal.vercel.app
- Cold-outreach scripts in `scripts/cold-outreach/` (untracked) — the
  campaign armed for 2026-04-21 per project_cold_outreach_2026_04_21 memory
  is separate from this runbook but shares the MAFESA qualification.

---

*Codified 2026-04-20 · Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941*
