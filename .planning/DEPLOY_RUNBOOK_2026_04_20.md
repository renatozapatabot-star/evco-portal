# Deploy Runbook — 2026-04-20 session · 38 commits

## Why this file exists

The all-week 10/10 push has reached the deploy boundary, and Claude
cannot push from its environment:

- **No git remote** configured on this local repo (`.git/config`
  has no origin — the branch exists only in the working tree reflog)
- **Vercel CLI not installed** globally, no npx cache, not
  authenticated
- **Supabase migration state diverged** — `supabase db push
  --dry-run` reports remote migrations not present locally, needs
  reconciliation before pushing 3 pending ones
- **No SSH access to Throne** from Claude's shell — `pm2 reload`
  must happen from your box

The branch is in a genuine deploy-ready state. All the local
verification is green. The steps below are what Renato IV
(or Tito) executes from a properly-authed terminal.

---

## State at handoff

```
Branch:       fix/pdf-react-pdf-literal-colors-2026-04-19 (local only)
HEAD:         79b9301 fix(security): restore admin view-as · shared resolveTenantScope helper
Commits:      38 this session
Prior base:   c78f44a fix(ratchet): exempt @react-pdf files from fontSize ratchet
Production:   3ef4dca (2026-04-17 Block EE ship) — NOT touched by this session
```

Verification just before this runbook was written:

```
typecheck   → 0 errors
lint        → 0 errors · 369 warnings (non-blocking)
tests       → 904 passing · 108 files
build       → clean · 204 routes
gsd-verify  → 0 failures · 19 warnings (at baseline)
block-audit → ✅
data-integrity probe → all checks pass
alert-coverage → 28 of 29 scripts ≥ 3/4 (baseline 28)
rollback bundle → /Users/renatozapataandcompany/cruz-branch-backups/ship-79b9301-20260420-1215.bundle
```

---

## Step 0 · Pre-flight (1 min)

From the local repo:

```bash
cd ~/evco-portal
git log --oneline -5              # confirm HEAD = 79b9301
bash scripts/ship.sh --skip-deploy  # gates 1-3 must stay green
```

If anything fails, stop. Do not proceed.

---

## Step 1 · Configure git remote + push branch (5 min)

This is the piece that's currently missing.

```bash
cd ~/evco-portal
git remote add origin <github-repo-url>   # or the Vercel Git URL
git push -u origin fix/pdf-react-pdf-literal-colors-2026-04-19
```

Vercel's GitHub integration (if configured on the evco-portal
project) should auto-build a preview URL. Check at:
https://vercel.com/renato-zapatas-projects/evco-portal/deployments

The preview URL will look like:
`evco-portal-git-fix-pdf-react-pdf-literal-...vercel.app`

---

## Step 2 · Reconcile Supabase migration state (10 min · HIGH-ATTENTION)

The 3 pending migrations I wrote are:
- `20260420_fx_savings_heuristic.sql` — seeds one config row
- `20260420_perf_indexes.sql` — 4 CREATE INDEX IF NOT EXISTS
- `20260420_inicio_hot_path_indexes.sql` — 3 CREATE INDEX IF NOT EXISTS

All idempotent. None drop anything. Safe in isolation.

BUT `supabase db push --linked --dry-run` reports:

```
Remote migration versions not found in local migrations directory.
Make sure your local git repo is up-to-date.
```

So the remote Supabase has migration history the local tree doesn't
know about. Two safe paths:

### Path A · Pull first, push after (recommended)

```bash
cd ~/evco-portal
npx supabase db pull --linked    # writes local migration files
                                 # matching the remote state
git status                       # see what pull created
git diff                         # inspect the pulled migrations
# If the pulled files look legit (historical migrations that
# were applied directly on prod without a local record):
git add supabase/migrations/
git commit -m "chore(migrations): pull remote history into local tree"
# Now the tree + remote agree
npx supabase db push --linked --dry-run   # expect: only the 3
                                          # 2026-04-20 migrations queued
```

If dry-run shows only those 3, proceed:

```bash
npx supabase db push --linked
```

### Path B · Apply migrations manually via SQL Editor

If `db pull` surfaces something unexpected, open Supabase Studio
and paste each migration directly:

1. https://supabase.com/dashboard/project/jkhpafacchjxawnscplf/sql/new
2. Paste `supabase/migrations/20260420_fx_savings_heuristic.sql` · Run
3. Paste `supabase/migrations/20260420_perf_indexes.sql` · Run
4. Paste `supabase/migrations/20260420_inicio_hot_path_indexes.sql` · Run

Verify each worked with the queries in `supabase/MIGRATION_QUEUE.md`.

---

## Step 3 · Regenerate types (2 min)

```bash
cd ~/evco-portal
npx supabase gen types typescript --linked > types/supabase.ts
git add types/supabase.ts
git commit -m "chore(types): regen after 2026-04-20 migrations"
git push
```

If `tsc --noEmit` fails after regen, there's real schema drift the
generated types surface — investigate before deploying.

---

## Step 4 · Manual smoke on preview URL (15 min · CRITICAL)

The branch introduces security changes (10 API routes now use
`resolveTenantScope`) plus the restored admin view-as. Smoke-test
both before touching production.

From the Vercel preview URL from Step 1:

1. **Log in as admin**
2. **Click "view as EVCO"** (from the nav dropdown that calls
   `/api/auth/view-as` POST with `company_id=evco`)
3. **Verify `/inicio` shows EVCO data** — this is the key regression
   test for the Option-1 patch. If you see admin-context empty data
   here, the helper is not honoring the cookie somewhere.
4. **Open `/launchpad`** — should show EVCO actions.
5. **Open `/mi-cuenta`** (only if `NEXT_PUBLIC_MI_CUENTA_ENABLED=true`
   on Vercel env) — should show EVCO A/R.
6. **Exit view-as** (DELETE `/api/auth/view-as`) → admin dashboard
   should restore to aggregate view.

If any step fails, halt. The fix may need more work than the
tests revealed.

7. **Log in as Ursula (client role, EVCO)** on the preview
8. **Try to read MAFESA data by URL manipulation** — e.g., open
   `/api/intelligence-feed?company_id=mafesa`. Response should
   return EVCO-scoped data (session wins; the cookie/param are
   ignored for client role).
9. **DevTools: set `company_id=mafesa` cookie, reload `/inicio`** —
   should still show EVCO data.

All 9 manual checks green → proceed to Step 5.

---

## Step 5 · Tito walkthrough gate (15 min)

Per CLAUDE.md §APPROVAL GATE: "Nothing reaches clients without
Tito or Renato IV sign-off." Share the preview URL with Tito,
have him walk `/inicio` + `/catalogo` + `/mi-cuenta` as an EVCO
client. Get his "está bien."

If Tito wants a change, halt and iterate. Otherwise proceed.

---

## Step 6 · Production deploy (10 min)

From the local repo:

```bash
cd ~/evco-portal
npm install -g vercel            # if CLI is missing
vercel login                     # follow browser auth
vercel link                      # confirm linked to evco-portal project
npm run ship                     # full 6-gate ship (not --skip-deploy)
```

`npm run ship` runs all 6 gates in ship.sh, including `vercel --prod`
at Gate 4 and live smoke at Gate 5. It writes
`baseline-2026-04-20-live.md` on success.

If Gate 5 reports `verdict: red`:

```bash
vercel rollback                  # roll back the prod alias
# File SEV-2 incident in LEARNINGS.md
```

---

## Step 7 · Throne (PM2) (2 min · from Throne SSH)

```bash
ssh throne
cd ~/evco-portal
git pull
pm2 reload ecosystem.config.js --only system-config-expiry-watch
pm2 save
pm2 status                       # confirm all 29 processes green
```

The new `system-config-expiry-watch` cron needs to register on Throne
or the 2026-04-28 warning for the 2026-05-05 rate expiry won't fire.

---

## Step 8 · Optional — flip /mi-cuenta feature flag (after Tito OK)

On Vercel dashboard → evco-portal → Environment Variables:

```
NEXT_PUBLIC_MI_CUENTA_ENABLED = true
```

Redeploy (Vercel will auto-rebuild). Verify `/mi-cuenta` now
reachable by client role.

---

## Step 9 · Post-deploy audit (10 min)

1. `/audit 1` in Claude-in-Chrome at portal.renatozapata.com
2. Check Telegram — no SEV-1/2 alerts from any cron
3. Hit `/api/health/data-integrity?tenant=evco` → verdict green
4. Update `.claude/rules/baseline-2026-04-20.md` → write
   `baseline-2026-04-20-live.md` that records the deployed commit
   and live integrity probe output

---

## What to do if any step goes wrong

### Migration push fails

```bash
# If db push errors mid-way, state is:
# - some 2026-04-20 migrations may have applied, others not
# - idempotency means re-running push is safe
npx supabase migration list --linked   # see what's applied
# Pick the ones that failed, re-run the specific SQL via Studio
```

### Vercel deploy produces the wrong build

```bash
vercel rollback                  # immediate rollback to prior prod alias
# Investigate in preview before the next push
```

### Admin view-as broken in preview

This is the regression the Option-1 patch was meant to fix. If
preview shows empty data for admin-in-view-as mode:

1. Open DevTools → Application → Cookies on the preview domain
2. Verify `company_id` cookie is set to the impersonated tenant
3. Hit `/api/data?table=traficos&limit=5` directly in the browser
4. If response is empty + no error, `resolveTenantScope` isn't
   reading the cookie. Check the deployed bundle at
   `.next/server/app/api/data/route.js` has the helper call.
5. Worst case: revert commits `ac85a26..HEAD` on a hotfix branch,
   ship just the R11/R12/R13 ratchet + test work. The view-as code
   will revert to pre-session behavior.

---

## Recommended order: don't batch everything

Ship in two waves if conservative:

**Wave 1** (safe, no behavior change): perf indexes + fx_savings
heuristic + docs + tests. These are NEW additions; migration rollback
is `DROP INDEX`. No route-handler changes.

```bash
# Would require branching off the current HEAD and cherry-picking
# the non-security commits. Ask first if you want this approach.
```

**Wave 2** (behavior-change): the security sweep (ac85a26 + 79b9301
patch). Deploy only after Wave 1 bakes for 24h.

Batched as one ship is also fine — tests cover both waves. Just
know which rollback you'd need.

---

## Commits in this session (for reference)

```
c78f44a (base)   · fix(ratchet): exempt @react-pdf files from fontSize ratchet
5b109c4          · chore(lint): clear 24 errors to green ship gate 1
673c772          · test(contabilidad): lock AR aging tenant-isolation contract
d6746db          · docs(handoff): Sunday 2026-04-19 night · pre-Ursula stress pass
64af0b7          · chore(ratchet): add 2 pre-Ursula anti-drift ratchets (R11, R12)
66ee925          · docs(cron): enumerate 28 PM2 processes in CRON_MANIFEST.md
9fa236c          · chore(ratchet): add R13 scripts/ silent-catch ratchet
91c0c18          · chore(ship): add npm run lint to gate 1
74b67db          · fix(rates): remove 4 hardcoded rate fallbacks · R11 baseline 4 → 0
bb2e6ca          · fix(scripts): silent-catch sweep on 3 cron-critical scripts
d951251          · perf(indexes): 4 missing indexes on hot-path tables
83cc75f          · feat(ops): system_config expiry-watch cron (Tier 3.3)
9afa4a1          · feat(ops): expiry-watch adds unguarded + verbose diagnostic
3b7f9d9          · test(mi-cuenta): isolation.test.ts · ethics contract SEV-2 fence
8cc7a67          · docs(migrations): MIGRATION_QUEUE.md for pending supabase db push
db28c89          · chore(lint): dead-code sweep · 392 → 387 warnings
94a19de          · chore(lint): clean trailing whitespace from eslint --fix
599f4e7          · docs(handoff): Monday 2026-04-20 · all-week 10/10 push
2018027          · feat(ops): alert-coverage-audit · heuristic gap finder
65d7d67          · fix(ops): close 2 real alert-coverage gaps
f74ffb4          · feat(ops): close last alert gap + enhance audit heuristic
5c390fd          · chore(ship): wire alert-coverage-audit into gate 1
6b93c81          · test(rates): contract tests for refuse-to-calculate invariants
ec03114          · test(api): tenant-isolation fence for /api/catalogo/partes/[cveProducto]
e5b0e47          · docs(mafesa): one-page onboarding runbook for client #2
7d3ab3b          · docs(handoff): append session log for commits 18-24
2320738          · perf(indexes): 3 more hot-path indexes from /inicio SSR query audit
ada96c9          · fix(safe-write): remove redundant .catch(() => {}) on sendTelegram
23c7d1b          · test(api): tenant-isolation fence for /api/catalogo/partes (list)
9bebccd          · test(api): tenant-isolation fence for /api/data (primary resolver)
33e9d18          · chore(lint): honor _foo convention + drop self-regression · 395 → 369
414a428          · chore(gitignore): capture cron runtime state + archive v2c reports
ac85a26          · fix(security): eliminate 13 forgeable-cookie patterns across 10 API routes
ad7fb87          · test(api): role-fence regression test for /api/broker/data
3d5a04a          · test(api): cookie-forgery fence for /api/intelligence-feed (SEV-1)
67c291a          · docs(baseline): 2026-04-20 baseline · adds I19-I27
fe0b8fd          · chore(ratchet): R15 excludes __tests__/ to avoid comment-matching
e8e4248          · test(api): cookie-fence regressions for 4 remaining SEV-1 routes
79b9301 (HEAD)   · fix(security): restore admin view-as · shared resolveTenantScope helper
```

---

*Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941*
