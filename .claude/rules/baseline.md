# CRUZ Working-Consistency Baseline — 2026-04-20

The foundation. Every future session starts from here and must preserve
it. Any regression against this file is a SEV-2 incident and requires
an explicit Renato IV sign-off to ship.

---

## What this file is

A frozen reference of what "10/10 working" looks like on the client
portal when credentials go to Ursula at EVCO Plastics on Monday
2026-04-20 08:00. Three future uses:

1. **Pre-flight gate.** Before any deploy, reproduce the invariants
   below. Any one failing → stop, do not push to production.
2. **Regression witness.** If a future session ships a change and
   something later feels off, diff the change against this baseline.
3. **Onboarding brief.** Future Claude sessions read this first to
   understand what "steady state" means on this repo.

---

## Baseline snapshot

```
Branch:       overnight/ursula-ready
Head commit:  1f375b8c4809d7766c1453f951dc7f05e1c3c384
Timestamp:    2026-04-20 · Sunday evening polish
Portal:       portal.renatozapata.com (prod) · evco-portal.vercel.app
Client:       EVCO Plastics (clave 9254) · Ursula Banda pending credential
```

### Test suite shape

```
62 files / 523 passing / 1 pre-existing failure
Pre-existing failure: api-schemas.test.ts > rejects limit over 5000
  — acknowledged before this baseline; not introduced here.
```

### Target-surface tests (must all stay green)

| Suite | Count | What it guards |
|---|---|---|
| `src/lib/format/__tests__/company-name.test.ts` | 13 | Legal-suffix stripping on companies.name, MAFESA preservation, GRUPO title-casing, EVCO canonical form |
| `src/app/inicio/__tests__/quiet-season.test.tsx` | 8 | 4-tile 2×2 hero contract, Liberación inmediata cascade, sad-zero nav replacement |
| `src/lib/cockpit/__tests__/freshness.test.ts` | 7 | formatFreshness output for ahora / min / h / día cases |

Regression rule: **these three files must each be 100% green before any deploy.**

---

## Invariants frozen at this baseline

Each rule below was verified clean at commit `1f375b8`. The verification
command shown is the exact check that future sessions should rerun.

### I1 — Brand discipline: no Z mark in topbar

```bash
grep -n "AguilaMark" src/components/aguila/TopBar.tsx
# → 0 matches
```
The topbar home link uses a Home glyph. The Z wordmark lives on the
login hero only. Re-adding a brand mark in the topbar requires
founder sign-off.

### I2 — Canonical company display name

```bash
grep -n "cleanCompanyDisplayName" src/components/aguila/CockpitInicio.tsx
# → 1 match (the import) + 1 usage at the greeting
```
No inline regex stripping legal suffixes in cockpit code. All surfaces
that render `companies.name` go through `src/lib/format/company-name.ts`.

### I3 — Hero tile 4 = Liberación inmediata (95-99% broker metric)

```bash
grep -n "liberacion-inmediata\|Liberación inmediata\|greenLightPct" \
  src/lib/cockpit/quiet-season.ts src/app/inicio/page.tsx
# → multiple matches across both files
grep -n "Velocidad promedio" src/lib/cockpit/quiet-season.ts
# → 0 matches (retired)
```
Broker job metric (semáforo verde rate over 90 d) replaces clearance
days. Data source: `traficos.semaforo` = 0. Consistent 95-99% for a
disciplined patente.

### I4 — CruzCommand keyboard hint hidden on mobile

```bash
grep -n "cruz-command-kbd" src/app/globals.css
# → class + @media (max-width: 767px) display:none !important
```

### I5 — Sync freshness signal wired into /inicio

```bash
grep -n "FreshnessBanner\|readFreshness" src/app/inicio/page.tsx
# → import + await readFreshness(...) + <FreshnessBanner />
```
Contract: `.claude/rules/sync-contract.md`. Stale (>90 min) renders
amber banner; fresh renders "Sincronizado hace N min" microcopy; no
data renders nothing.

### I6 — Client isolation via session.companyId

```bash
grep -rn "'9254'\|\"9254\"" src/app/api src/lib
# → 0 matches in production query paths
```
RLS `FOR ALL USING (false)` on every tenant-scoped table. Service role
bypasses for portal reads. HMAC session is the tenant gate, not
URL/cookie/header.

### I7 — Pedimento + fracción formatting preserved

```bash
grep -rn "pedimento.*replace\|replace.*pedimento" src/
grep -rn "fraccion.*replace\|replace.*fraccion" src/
# → 0 strip-spaces or strip-dots matches
```
`formatPedimento()` and `formatFraccion()` are the canonical helpers.

### I8 — Error boundaries on every client page

```bash
ls src/app/{inicio,embarques,pedimentos,expedientes,entradas,catalogo,ahorro,mensajeria,reportes,anexo-24,cruz}/error.tsx 2>/dev/null | wc -l
# → ≥ 10 (every client-visible route has one)
```

### I9 — Design system: glass + silver/gold discipline

```bash
grep -rn "background.*'#111111'\|background.*'#222222'" src/components/ src/app/
# → 0 matches (opaque cards banned)
```
All glass surfaces compose through `<GlassCard>`. Hero tier
`rgba(0,0,0,0.4)` + `blur(20px) saturate(1.2)` + top-lit inset
`rgba(255,255,255,0.07)`.

### I10 — Six locked nav tiles

```bash
grep -n "UNIFIED_NAV_TILES" src/lib/cockpit/nav-tiles.ts
# → array with exactly 6 entries: embarques, pedimentos, expedientes,
#   catalogo, entradas, anexo24
```
Changing this list requires Tito + Renato IV sign-off (invariant #29).

---

## Reproducing the baseline

One command sequence brings a fresh checkout to this exact state:

```bash
cd ~/evco-portal
git checkout overnight/ursula-ready
git show --stat 1f375b8 | head
npm install
npx tsc --noEmit                 # expect EXIT 0
npx vitest run                   # expect 523/524 passing (1 pre-existing)
npx vitest run src/lib/format/__tests__/company-name.test.ts \
               src/app/inicio/__tests__/quiet-season.test.tsx \
               src/lib/cockpit/__tests__/freshness.test.ts
# expect 28/28 passing — the target-surface gate
```

If any of the three target files regress, **do not ship.** They
encode the contracts Ursula reads every day.

---

## What "10/10 working" means here

The portal Ursula reaches on Monday clears these six simultaneous truths:

1. **She sees her company.** `EVCO Plastics de México`, not the full
   legal suffix. (I2)
2. **She sees the broker's job.** `Liberación inmediata 98%` — one
   glance, the patente earns its keep. (I3)
3. **She sees the alive signal.** Breathing "En línea" pill + fresh
   sync microcopy. (I5)
4. **She can search.** CruzCommand bar is the primary action.
   Mobile-polished; kbd badge hidden. (I4)
5. **She cannot see another tenant.** RLS + session.companyId + explicit
   filters. Verified across every read path. (I6)
6. **Nothing crashes.** Every page has an error boundary + soft-wrapped
   SSR queries. (I8)

Any future work that preserves all six is additive polish. Any work
that breaks one is a regression against this baseline — revert before
shipping.

---

## Evolution protocol

This baseline is **replaceable, not sacred.** When a future shipping
session raises the floor:

1. Verify the current baseline still holds (rerun the reproduce block).
2. Add a new baseline file: `.claude/rules/baseline-YYYY-MM-DD.md`.
3. Link it from `CLAUDE.md` under "BUILD STATE".
4. Keep the old baseline file; it's the record of what was true at
   the prior milestone.

Do NOT edit this file to reflect new state. Create the next one. The
ratchet only goes forward.

---

*Signed at the repo layer — enforced by tests, verified by commits,
witnessed by `git log` on branch `overnight/ursula-ready`.*
*Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941*

---

**Superseded by:** [`baseline-2026-04-17.md`](./baseline-2026-04-17.md) — see ratchet protocol.
