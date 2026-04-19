# Monday 2026-04-20 Pre-Launch Runbook

**Target:** portal.renatozapata.com credential send to Ursula Banda / EVCO Plastics at **08:00 Laredo CT**.
**Source:** Sunday 2026-04-19 data-trust marathon. Branch `sunday/data-trust-v1` sits unmerged with 6 commits fixing one P0 + one P1 + five cleanup / guardrail commits.
**Owner:** Renato IV (you). Nothing in this runbook auto-executes; every step is a manual gate.

---

## Gate rule (non-negotiable)

All three verifications below must return clean. **Any flag = do not merge, do not ship.** Regroup, investigate, re-run. Shipping with a flagged verification has cost me 10 days of silent pipeline death before — never again.

---

## 07:00 — Step 1 · Fresh tenant audit

Captures today's contamination state (the 2026-04-17 snapshot is 3 days old).

```bash
cd ~/evco-portal
git checkout sunday/data-trust-v1
node scripts/tenant-audit.js
```

**Pass criteria:**
- Every active company (51 per last snapshot) shows `total_rows` per table
- `orphan_company_ids` arrays are **empty** for all globalpc_* tables
- No new contamination since 2026-04-17

**Flag handling:**
- Orphan IDs present in `globalpc_productos` or `globalpc_partidas` → a sync wrote rows with an unknown clave after 2026-04-17. Do not ship. Run `node scripts/tenant-reassign-company-id.js --dry-run` and investigate.
- Orphan IDs in `expediente_documentos` / `globalpc_eventos` — per 2026-04-17 snapshot, these had orphans (`0405, 0535, 0543, 0626, 0627` for expedientes; `8979, 3423, 7073` for eventos). If the set is unchanged, it's stable historical residue; **acceptable**. If new orphans appeared, investigate.

---

## 07:05 — Step 2 · Data integrity probe

All 21 invariants (including Block EE invariants #18-21) must be green.

```bash
node scripts/data-integrity-check.js
```

**Pass criteria:** every numbered check reports OK. The four Block EE invariants that matter most:
- **#18** — every active `company_id` is in the `companies` allowlist
- **#19** — ≥ 8 of 15 sampled clients have partida rows
- **#20** — EVCO `productos` / `partidas` ratio ≤ 2.0 (guards against orphan accumulation)
- **#21** — orphan-tagged rows ≤ 25K

**Flag handling:** any FAIL = do not ship. Fix root cause, re-run, then decide.

---

## 07:10 — Step 3 · Live 5-question leak battery

Reproduces the Phase 1 P0 dynamically to confirm the Phase 7 fix holds in a real EVCO session.

```bash
# Terminal 1
npm run dev
```

```bash
# Terminal 2 — seed the query plan (run this first to cache the allowlist)
# Open psql or Supabase SQL editor and run:
# SELECT count(*) FROM globalpc_partidas WHERE company_id='evco';
# SELECT count(*) FROM (
#   SELECT DISTINCT cve_producto FROM globalpc_partidas WHERE company_id='evco'
# ) t;
# Note: numbers should be close to 290K partidas / 693 distinct cves per
# baseline-2026-04-17.md. If they're wildly different, something drifted.
```

In a browser, sign in as an EVCO client (`evco2026`) on http://localhost:3000 and navigate to the CRUZ AI surface. Ask these five questions in sequence, each in Spanish as Ursula would:

1. **"Lista mis top 10 proveedores."**
2. **"Muéstrame todas las partes que importo."**
3. **"¿Qué fracciones arancelarias tengo en mi catálogo?"**
4. **"Muéstrame mis pedimentos más recientes."**
5. **"Lista mis SKUs del anexo 24."**

For each response, cross-check by running this SQL in Supabase:

```sql
-- The authoritative set. Every fraccion AI names for EVCO must appear here.
SELECT DISTINCT fraccion
FROM globalpc_productos
WHERE company_id = 'evco'
  AND cve_producto IN (
    SELECT DISTINCT cve_producto
    FROM globalpc_partidas
    WHERE company_id = 'evco'
  )
  AND fraccion IS NOT NULL
ORDER BY fraccion;
```

**Pass criteria:** every fraccion / supplier / parte mentioned by the AI appears in the EVCO-scoped authoritative set above. Zero surprise rows.

**Flag handling:** if the AI names a supplier or fraccion that isn't in the set → leak regressed. **Do not ship.** Investigate before merging.

---

## 07:20 — Step 4 · (Only if Steps 1-3 all green) Merge

Choose one path based on what's sitting on `main` vs your feature branches.

### Option A — merge onto `feature/supertito-v1` first (preserves parallel theme/v6-migration work)

```bash
git checkout feature/supertito-v1
git pull origin feature/supertito-v1  # in case anything landed upstream
git merge sunday/data-trust-v1
# conflicts: resolve, test, commit
```

### Option B — merge straight to `main` (if supertito branch is ready for main anyway)

```bash
git checkout main
git pull origin main
git merge sunday/data-trust-v1
```

### Then ship

```bash
npm run ship
```

This runs the six-gate discipline from `.claude/rules/ship-process.md`:
1. TypeScript + vitest + build + ratchets
2. `scripts/data-integrity-check.js` (local probe)
3. Rollback bundle into `~/cruz-branch-backups/`
4. `vercel --prod`
5. Live smoke — three curls including `/api/health/data-integrity`
6. Baseline snapshot writer

**Gate 5 verdict must be `green`.** If `amber` → continue but note it; if `red` → `vercel rollback` immediately.

---

## 07:45 — Step 5 · Baseline witness

`scripts/ship.sh` auto-writes `.claude/rules/baseline-2026-04-20.md` on green deploy. Skim it once, confirm:
- Head commit matches what you just pushed
- Live integrity probe shows `verdict: green`
- Rollback bundle path recorded

If the baseline didn't auto-write (baseline writer failure is non-fatal per ship-process), manually snapshot before moving on:

```bash
# Manual baseline command — see scripts/ship.sh for the exact content
# Or just wait for the next `npm run ship` to regenerate
```

---

## 08:00 — Ursula credential send

From the portal walkthrough materials and `/tmp/tito-review-script.md`:

1. Tito approves final (if not done Sunday night)
2. Send credentials to Ursula via the approved channel (Tito + Renato IV sign-off, never direct)
3. iPhone Safari walkthrough verification on real device (not Playwright Chromium) — 60-second smoke: login → `/inicio` → tap a tráfico → tap a parte → CRUZ AI bubble

---

## What this runbook does NOT cover (deferred to post-launch)

- 4 sync scripts missing Telegram alerts (`globalpc-sync.js` most critical) — silent-failure risk but no evidence of recent silent death
- 15 sync scripts without safeUpsert wrapper — operational hygiene
- 54 orphan tables — Phase 9 cleanup, needs live dashboard
- Two deferred UX decisions (`/inicio` catalogo counts + `/api/catalogo/partes` list allowlist) — you + Tito decide next session
- `src/lib/client-config.ts` EVCO_DEFAULTS footgun — MAFESA onboarding checklist item
- Live Supabase Pro dashboard enumeration (views, functions, triggers, buckets)

None of these block the 08:00 credential send. All documented in `.planning/sunday-marathon-2026-04-19/` for future-you.

---

## If the ship goes sideways between 08:00 and 09:00

Telegram alert → `vercel rollback` → investigate in staging → fix → re-ship. Never fix forward under production pressure per `.claude/rules/operational-resilience.md`. SEV-1 incidents get a LEARNINGS.md entry within 24 hours regardless.

---

## Full marathon context (for reference)

- **Certificate:** `/tmp/data-trust-reports/CERTIFICATE.md` (GO WITH CAVEATS)
- **Master summary:** `/tmp/data-trust-reports/00-MASTER-SUMMARY.md`
- **Phase summaries:** `.planning/sunday-marathon-2026-04-19/PHASE-*.md`
- **Branch:** `sunday/data-trust-v1` · 6 commits ahead of `feature/supertito-v1`
- **Commit chain:**
  1. `c025723` — Phase 1 leak reproduced
  2. `7070b9b` — Phase 2 schema archaeology
  3. `8a1085a` — Phase 6 decision gate
  4. `7b29a89` — Phase 7 P0 + P1 fix
  5. `c84e267` — Phase 8-10 certificate
  6. `1a25ea9` — Phase 9 ratchet tightening (35 → 0)

*Patente 3596 honrada. Ready when you are.*
