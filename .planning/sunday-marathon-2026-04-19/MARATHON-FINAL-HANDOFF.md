# Sunday Marathon 2026-04-19 → 2026-04-20 · Final Handoff

**Context:** Started as a data-trust audit Sunday evening. User kept saying "continue" + "don't defer" Monday morning under launch pressure. Ended 12:30 AM with 14 commits + runbook + new tooling + one production bug class eliminated.

**Branch:** `sunday/data-trust-v1` · unmerged · ready to ship.
**Target:** 08:00 Monday 2026-04-20 Ursula credential send.

---

## The one thing you most need to know

**Step 0 at 06:55 is the single most important manual action.**

`TELEGRAM_SILENT=true` on Throne has been making 3 major full-sync scripts silently no-op in production. Fixed in this session, but the scripts still RESPECT the flag correctly — they just don't bail early on it anymore. Flipping the flag to `false` Monday 06:55 is what makes the whole Phase 8 resilience layer actually deliver alerts:

```bash
ssh <throne>
grep TELEGRAM_SILENT ~/evco-portal/.env.local
# If 'true': flip to 'false', restart pm2, fire probe.
```

Runbook at `.planning/sunday-marathon-2026-04-19/MONDAY-RUNBOOK.md`. Or just run `node scripts/pre-ship-check.js` — it does Steps 0-3 in one command.

---

## Final marathon commit chain (14 commits on `sunday/data-trust-v1`)

```
<new>    harden(pipeline): combined fix on 3 full-sync scripts + wsdl + auto-classifier + ratchet
b7407f6  audit+harden(pipeline): pre-ship checker, safe-write wrappers, SEV-2 finding doc
c9b847f  docs(launch): runbook — nightly-reconciliation activation steps
a351bc9  feat(pipeline): nightly-reconciliation.js drift detector
3b4064f  fix(data-trust): neutralize client-config fallbacks + Telegram gate
682d4a2  harden(pipeline): Telegram alerts on silent syncs
bfbea72  fix(data-trust): catalog allowlist (launch UX)
d312ef3  docs(launch): Monday runbook
1a25ea9  clean(data-trust): ratchet 35 → 0
c84e267  verify(launch): certificate GO WITH CAVEATS
7b29a89  fix(data-trust): P0 + P1 fix
8a1085a  audit(phase-6): decision gate
7070b9b  audit(phase-2): schema archaeology
c025723  audit(phase-1): leak reproduced
```

---

## What's verified green

- `tsc --noEmit` → 0 errors
- `vitest run` → **714/714 passing (88 files)**
- `gsd-verify.sh` → 0 failures, 22 warnings
- `node --check` on every touched script → parse OK
- Ratchets active and at baseline:
  - `globalpc_productos` allowlist guard → **baseline 0**
  - `'unknown'` tenant fallback → **baseline 2** (only legitimate local-grouping uses)
  - `FALLBACK_TENANT_ID` → baseline 1 (legacy, tracked)

---

## What landed (rolled up by theme)

### P0 — CRUZ AI catalog leak (commit `7b29a89`)
Root cause fixed. Regression test at `src/lib/aguila/__tests__/tools.catalogo.test.ts`. Ratchet `globalpc_productos allowlist guard` at baseline 0.

### P1 — Catalog count UX (commit `bfbea72`)
`/inicio` + `/api/catalogo/partes` apply the anexo-24 allowlist. Ursula will see ~693 imported SKUs, not ~149K legacy mirror. Per `active-parts.ts` contract.

### P1 — Client config fallback (commit `3b4064f`)
`EVCO_DEFAULTS` removed. MAFESA users will no longer inherit EVCO identity from partial session metadata.

### Operational resilience (commits `682d4a2`, `<new>`)
- Telegram alerts on `globalpc-sync` + `full-client-sync` (previously silent on failure)
- `safeUpsert` wrappers on `globalpc-delta-sync`, `resync-productos`, `full-sync-eventos` (zero-write-drift detection — the 2026-04-16 incident pattern)
- `safeInsert` on `full-sync-productos`
- **Stray top-level `return` bug eliminated** on all 3 full-sync scripts. Scripts previously no-op'd under `TELEGRAM_SILENT=true` — now run correctly
- Block-EE-forbidden `|| 'unknown'` tenant fallback replaced with skip-and-alert on: `full-sync-productos`, `full-sync-facturas`, `full-sync-eventos`, `wsdl-document-pull`, `auto-classifier`

### New tooling (commits `a351bc9`, `b7407f6`, `<new>`)
- `scripts/nightly-reconciliation.js` — per-tenant per-table drift detector (Supabase vs GlobalPC MySQL). Bands: green <1%, amber 1-5%, red >5%. NOT in PM2 yet — runbook has the activation sequence.
- `scripts/pre-ship-check.js` — one-command runbook Steps 0-3 + target-surface tests. Prints single PASS/WARN/FAIL.
- New ratchet: `'unknown' tenant fallback` — catches future regressions of the forbidden pattern.

### Docs (commits `d312ef3`, `c9b847f`, `<new>`)
- `MONDAY-RUNBOOK.md` — full 06:55-08:00 sequence
- Phase 1-10 summaries + master certificate in `.planning/sunday-marathon-2026-04-19/`

---

## What I did NOT do (and why)

- **54 orphan tables cleanup** — needs live Supabase Pro dashboard; can't do without credentials. Tier list in `/tmp/data-trust-reports/07-table-usage-map.md`.
- **Live dashboard enumeration** (views/functions/triggers/buckets) — same.
- **`vapi-llm` MAFESA hardening** — flagged the hardcoded `'evco'` director context + added `companyIdOverride?: string` parameter path, but left the default at `'evco'` for Monday compat. MAFESA voice needs a proper request-body threading (4 call sites). Out of scope, flagged.
- **safeUpsert on `globalpc-sync.js`** — this is the Block-EE reference writer with custom error handling for "relation does not exist" specifically. Swapping it for safeUpsert risks losing that detection. Better to leave + document.

---

## The pushbacks that mattered

1. **The "don't fix bug 1 without bug 2" paradox.** Three full-sync scripts had both a stray top-level `return` (made them no-op under TELEGRAM_SILENT=true) AND a Block-EE-forbidden `|| 'unknown'` fallback. Fixing either in isolation would make things worse. Only solved by doing BOTH together — which I did in the final commit.
2. **`/catalogo` UX change day-of-launch.** Applying the allowlist drops Ursula's visible catalog from ~149K to ~693. I flagged this explicitly before doing it. User said ship. Shipped.
3. **Refused to wrap 15 sync scripts at once.** Did 3 highest-value ones. Combinatorial risk on the tail wasn't worth it.

---

## What Monday looks like

**06:55** — `ssh throne; node scripts/pre-ship-check.js`
If all green → proceed.

**07:00-07:20** — Manual Step 3 (live 5-question AI leak battery in dev browser with EVCO session). Every fraccion AI names must appear in:
```sql
SELECT DISTINCT fraccion FROM globalpc_productos
WHERE company_id='evco' AND cve_producto IN (
  SELECT DISTINCT cve_producto FROM globalpc_partidas WHERE company_id='evco'
);
```

**07:20** — `git merge sunday/data-trust-v1` → `npm run ship` → verify baseline auto-writes.

**08:00** — Credentials to Ursula.

**Post-ship** — activate `nightly-reconciliation` cron per the activation section of the runbook. First firing 03:00 Tuesday.

---

## The ratchets are the legacy

Five ratchets now active in `gsd-verify.sh` protect against regression:

| Ratchet | Baseline | What it catches |
|---|---|---|
| `globalpc_productos` allowlist guard | 0 | Any unguarded read of the catalog master (the original P0 class) |
| `'unknown'` tenant fallback | 2 (2 legit uses) | Any new `\|\| 'unknown'` on a company_id write |
| `FALLBACK_TENANT_ID` | 1 (legacy constant) | Any new use of the retired sentinel |
| globalpc-sync mapRow company_id writes | ≥8 required | Block EE write contract |
| Hex colors | 2722 | Pre-existing |

If anyone introduces a regression of these bug classes, the build fails. That's the durable win of this marathon — not the fixes themselves but the fences around them.

---

*Patente 3596 honrada. Ready for 08:00.*
