---
updated: 2026-04-22 11:45 CT
by: Claude session s005 (post-Grok-sprint, pre-Ursula-demo)
stale-after: 2026-04-23 morning (daily refresh expected)
---

# PORTAL · Current State

**This is the single page that answers: "where are we right now?"**
Everything else is referenced, not duplicated.

---

## 1. Live surface

| Item | Value |
|---|---|
| Prod URL | `https://portal.renatozapata.com` (CNAME → Vercel) |
| Backup alias | `https://evco-portal.vercel.app` |
| Primary client | EVCO Plastics (`company_id='evco'`, `clave_cliente='9254'`) |
| Live user | Ursula Banda · `ursula@evcoplastics.com` |
| Auth model | HMAC `portal_session` cookie (NOT Supabase JWT) — see §5 of `GROK.md` |
| Login path | `/login` → `evco2026` access code |

Smoke (2026-04-22 11:40 CT):

```
GET /                         → 307 → /login
GET /login                    → 200
GET /api/health               → 200 {"supabase":{"ok":true}, "sync":{"ok":true}}
GET /api/health/data-integrity → 200, verdict=red  (see §3)
```

All authenticated routes (`/inicio`, `/cruz`, `/traficos`, `/pedimentos`,
`/expedientes`) correctly 307 to `/login` when unauthenticated. This is
expected behavior; login first, then those routes serve 200.

---

## 2. Repo state

```
Branch:       main
Head commit:  ab0d323 feat(inicio): gate partial-data banner behind NEXT_PUBLIC_PARTIAL_DATA_BANNER
Remote sync:  origin/main == local main (in sync)
Typecheck:    0 errors
Lint:         0 errors, 417 warnings (TypeDoc docs/api/** now excluded — stashed fix pending commit)
```

Recent merges (last 72h):

- `1667a94` (Wed 2026-04-22 06:48) — **4-day Grok Build Readiness Sprint**:
  11 primitives + 1367 tests + 5573-line handbook. *This completes the
  Grok-handoff work — do not duplicate.*
- `fae4dd7` (Mon/Tue 2026-04-20/21) — EVCO final demo polish (Asistente
  → /cruz CTA, banner dedup, integrity audit script).
- `376b382` — Phase 3 #1–#5 (agent talks, briefs, remembers, drafts, learns).

---

## 3. Data-integrity verdict: red (but safe)

Endpoint: `/api/health/data-integrity?tenant=evco`

**All 6 data tables: green.** traficos=3451, entradas=20796,
expediente_documentos=214144, globalpc_productos=149710,
globalpc_facturas=14247, globalpc_partidas=22594.

**5 sync_types report red — all known one-time/legacy jobs that
never ran:**

| sync_type | Reason red | Impact |
|---|---|---|
| `econta_full` | Writer deferred until Anabel credential recon (CLAUDE.md known debt) | No client-facing impact; `/mi-cuenta` uses intraday econta |
| `globalpc` | Labeling; `globalpc_delta` + `globalpc_facturas_full` ARE green | No impact; intraday data flows via delta |
| `anexo24_reconciler` | Cron not in PM2 yet; WSDL path works | No impact; anexo24_partidas populated via nightly WSDL pull |
| `backfill_proveedor_rfc` | One-time backfill; cache populates intraday | No impact |
| `backfill_transporte` | One-time backfill; same cache pattern | No impact |

**Green signals (10):** anomaly_detector, completeness_checker,
content_intel, email_intake, globalpc_delta, globalpc_facturas_full,
regression_guard, risk_feed, risk_scorer, wsdl_anexo24_pull.

The verdict aggregator is boolean-OR — any red flips the top-line. A
follow-up should filter "never-ran" sync_types from the verdict logic.
Low priority; does not affect Ursula.

---

## 4. In-flight work (parallel sessions)

As of 11:45 CT, **three Claude sessions** run concurrently in
`~/evco-portal`. Per `.claude/rules/parallel-sessions.md`:
atomic per-file commits, verify branch before each commit.

Known in-flight (observed on disk):

- **White-label admin surface** (session unknown) — `src/app/admin/white-label/`
  + `src/lib/tenant/preview.ts` + `src/lib/tenant/config.ts` extensions
  (`ALLOWED_ACCENT_TOKENS`, `footer_text`, `WORDMARK_MIN_LEN`,
  `WORDMARK_MAX_LEN`). Currently fails typecheck —
  `preview.ts` imports `parseBranding` not yet exported from `config.ts`.
  Parallel session will finish this; do not edit their files.
- **US Operator queue + Contabilidad v2** (this session · stash@{1})
  — stashed pre-demo: `src/app/admin/trafico-us/`,
  `src/app/mi-contabilidad/`, `src/lib/contabilidad/supplier-invoices.ts`.
  Restore post-demo on feature branches.
- **My lint fix** (this session · stash@{0}) — `eslint.config.mjs`
  adds `docs/api/**` to globalIgnores. Blocked on the white-label
  session's typecheck; commit after their TS clears.
- **Dated log reports** (untracked) — `docs/v2c-batch-reports/2026-04-22.md`
  + `scripts/logs/content-intel/2026-04-22.md`. Safe to commit; pure logs.

---

## 5. Ursula demo readiness (target: today, ~13:00–14:00 CT)

Locked invariants (from `baseline-2026-04-20.md` I1–I27 + founder-overrides):

- ✅ Topbar uses Home glyph (no Z mark)                     — I1
- ✅ `cleanCompanyDisplayName` on cockpit greeting            — I2
- ✅ Liberación inmediata % in hero tile 4                    — I3
- ✅ CruzCommand kbd hidden on mobile                         — I4
- ✅ FreshnessBanner + readFreshness wired on `/inicio`       — I5
- ✅ No `'9254'` literals in `src/app/api/` + `src/lib/`      — I6
- ✅ Pedimento spaces + fracción dots preserved               — I7
- ✅ `error.tsx` on 10+ client routes                         — I8
- ✅ No `#111111 / #222222` opaque cards                      — I9
- ✅ Six-tile nav (Embarques · Contabilidad · Expedientes ·
  Catálogo · Entradas · Anexo 24)                          — I10
- ✅ Alert-coverage baseline 28 of 29 scripts                 — I19
- ✅ No forgeable `user_role` / `company_id` cookie reads     — I20
- ✅ Rates refuse-to-calculate on missing/expired config      — I21
- ✅ `/mi-cuenta` calm-tone (no red/amber dunning language)   — I22
- ✅ system_config expiry-watch daily cron registered         — I24
- ✅ Ship gate includes lint + alert-coverage                 — I25

Open questions for Ursula:

- `/cruz` hero CTA lands on a working agent conversation (depends on
  Anthropic credits — check `ANTHROPIC_API_KEY` balance before demo)
- Mensajería remains operator-only on client side
  (`NEXT_PUBLIC_MENSAJERIA_CLIENT=false`)
- Partial-data banner stays gated OFF
  (`NEXT_PUBLIC_PARTIAL_DATA_BANNER` not set / false)

---

## 6. Grok handoff — what's already done

Grok-Build docs shipped this morning in commit `1667a94`:

- `GROK.md` (344 lines) — root constitution for Grok sessions
- `docs/GROK_QUICK_START.md` (193 lines) — 4-5 min primer
- `docs/grok-build-handbook.md` (5573 lines, 47 sections) — full handbook
- `docs/MIGRATING_SCHEMA.md` (309 lines) — migration recipe
- `scripts/agent-sandbox/` — 3 runnable examples + README
- 11 new primitives (intelligence + financial + tenant-scoped queries)
- 1367 tests total passing

Grok should read GROK.md → QUICK_START → handbook §36–§40. They're
already calibrated to this repo's rules.

---

## 7. Known debt (pre-existing, not introduced by this session)

Per CLAUDE.md "Known debt" + baseline-2026-04-19 pre-existing failures:

- 13 `@react-pdf/pdfkit` gradient-stop tests fail — upstream library
  bug; pin + patch deferred. Does not affect prod.
- `classification_log` empty until Tito starts reviewing —
  "Revisado por Tito" badge hidden; plumbed.
- `/pedimentos/nuevo` operator page uses anon key on
  `globalpc_partidas` — breaks after RLS migration on that table;
  operator-only, not on Ursula's path. Migrate before client #2.
- SAT RFC lookup gated on `SAT_RFC_API_URL` + `SAT_RFC_API_KEY`
  — cache + wiring live; awaits credentials.
- `backfill-doc-types.js` + `seed-tariff-rates.js` use wrong column
  names — scripts dead; no impact on cockpit.
- `po-predictor.js` has Supabase v2 `.catch()` incompat + 1000-row
  query limit needs 50K — rewrite scheduled post-demo.

---

## 8. Shipping

Ship command: `npm run ship` (6 gates) · dry: `npm run ship:dry`
Contract: `.claude/rules/ship-process.md`
Last green baseline: `.claude/rules/baseline-2026-04-20.md`

Do NOT deploy during Ursula's demo window unless a fix demands it.
Rollback is `vercel rollback` to last green (ab0d323 → prod).

---

*This file is hand-maintained. Update whenever the branch HEAD, live URL,
parallel-session state, or invariant set changes. Daily refresh expected.
Do NOT duplicate content from GROK.md, the handbook, or the baselines —
link to them.*
