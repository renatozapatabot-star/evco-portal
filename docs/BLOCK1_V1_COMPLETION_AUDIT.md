# Block 1 · Tráfico Detail · V1 Completion Audit

**Status:** Commit A landed · Commit B deferred
**Branch:** `feature/v6-phase0-phase1`
**Commit A SHA:** `6468432`
**Prior head:** `961988b`
**Plan:** `/Users/renatozapataandcompany/.claude/plans/wise-mapping-nest.md`

---

## What shipped in Commit A

Foundation layer for the 70-event state machine. Commit A is self-contained
and green against every gate — safe to merge as-is or hold until Commit B
lands the new UI.

### Files created

| Path | Line count |
|---|---|
| `docs/recon/V2_GLOBALPC_RECON.md` | 169 |
| `src/lib/events-catalog.ts` | 286 |
| `src/app/traficos/[id]/legacy/page.tsx` | (moved from root — 100% rename) |
| `src/app/traficos/[id]/page.tsx` (new root redirect) | 21 |
| `supabase/migrations/20260412_events_catalog.sql` | 90 |
| `supabase/migrations/20260412_trafico_detail_columns.sql` | 11 |
| `supabase/migrations/20260412_trafico_notes_reguard.sql` | 21 |

### Files moved to legacy (git history preserved)

- `page.tsx`, `actions.ts`, `layout.tsx`, `error.tsx`, `loading.tsx`
  → `src/app/traficos/[id]/legacy/`
- Entire `_components/` directory (10 files) → `src/app/traficos/[id]/legacy/_components/`

### Files hoisted to `src/components/trafico/`

- `SolicitarDocsModal.tsx`
- `CommentThread.tsx`
- `MentionAutocomplete.tsx`

Both the legacy route and the forthcoming new UI will import these from
`@/components/trafico/...`. Pre-existing sibling `StickyActionBar.tsx`
remains in place.

### External consumers rewired

- `src/app/admin/shadow/page.tsx` — `HeroStrip` import → `legacy/_components/`
- `src/app/clientes/[id]/page.tsx` — `HeroStrip` import → `legacy/_components/`
- `src/components/trafico/CommentThread.tsx` — `addTraficoNote` import →
  `@/app/traficos/[id]/legacy/actions`

---

## events_catalog seed — 55 rows

Breakdown from the migration:

```
lifecycle   11
payment     11
inspection   8
exception    4
export       2
load_order   4
vucem        5
document     6
manual       4
-----------
total       55
```

Seed is idempotent via `ON CONFLICT (event_type) DO NOTHING`.

---

## Gate output

```
$ npm run typecheck
> tsc --noEmit
(no output — 0 errors)

$ npm run test
 Test Files  10 passed (10)
      Tests  124 passed (124)
   Start at  04:17:46
   Duration  578ms

$ npm run build
(completed successfully)
…
├ ƒ /traficos/[id]          ← new redirect stub
├ ƒ /traficos/[id]/legacy   ← legacy real route
…
```

Pre-commit hooks: TypeScript · No CRUD · No hardcoded IDs · No alert() ·
No console.log · lang=es — **all passed**.

---

## Commit B — NOT yet shipped

The new UI (TraficoDetail shell, Header, HeroStrip with 6 tiles, RightRail
with Acciones Rápidas state-machine panel + Información lateral, BelowFold
4-section progressive disclosure, 5 tab components including the 70-event
Cronología, extended server actions `fireLifecycleEvent` /
`assignOperator` / `escalateToBroker` / `markReceived`, and the
`?legacy=1` query-param gate) is **not yet in tree**.

Commit A's root `page.tsx` redirects every request to `/traficos/[id]/legacy`
so operators keep working. The redirect is commented — replacement in Commit B
is a single-file swap.

### Remaining work items (Commit B scope)

- `TraficoDetail.tsx`, `Header.tsx`, `HeroStrip.tsx`, `RightRail.tsx`,
  `BelowFold.tsx`, `types.ts`, `loading.tsx`
- `tabs/DocumentosTab.tsx`, `tabs/PartidasTab.tsx`, `tabs/CronologiaTab.tsx`,
  `tabs/NotasTab.tsx`, `tabs/ComunicacionTab.tsx`
- `actions.ts` — `fireLifecycleEvent`, `assignOperator`, `escalateToBroker`,
  `markReceived`, re-exporting `updateTraficoStatus` + `addTraficoNote`
- `page.tsx` — swap redirect for real data fetch + legacy gate
- Telemetry wiring (15 event types listed in the plan)
- Client View Test + No-Scroll Test at 1440×900

---

## Renato follow-ups

- [ ] `npx supabase db push` — applies the 3 new migrations
- [ ] `npx supabase gen types typescript --local > types/supabase.ts`
- [ ] Monday smoke test — `/traficos/[id]` currently redirects to legacy.
      Once Commit B lands, `/traficos/[id]?legacy=1` will be the escape hatch.
- [ ] Populate new columns (`doda_status`, `u_level`, `peso_volumetrico`,
      `prevalidador`, `banco_operacion_numero`, `sat_transaccion_numero`)
      as data sources come online

## Known limitations

- Below-fold columns from M2 are null on existing rows until populated.
- `users` table not created — mention autocomplete continues to use
  `client_users.role IN ('operator','admin','broker')`.
- `workflow_events` rows for existing tráficos require backfill or
  are rendered as "Sin eventos registrados" in the new Cronología.

---

*Block 1A audit — April 12, 2026. Patente 3596.*

---

## Commit B — new UI shipped

Replaces the redirect stub `src/app/traficos/[id]/page.tsx` with the full
recon-driven detail surface. `?legacy=1` still redirects to the legacy
route; the main path now renders the new Header + 6-tile hero strip +
2-col grid (tabs + RightRail) + BelowFold.

### Files created (Commit B)

| File | Lines |
|---|---|
| `src/app/traficos/[id]/page.tsx` (replaced) | 222 |
| `src/app/traficos/[id]/TraficoDetail.tsx` | 350 |
| `src/app/traficos/[id]/Header.tsx` | 180 |
| `src/app/traficos/[id]/HeroStrip.tsx` | 166 |
| `src/app/traficos/[id]/RightRail.tsx` | 378 |
| `src/app/traficos/[id]/BelowFold.tsx` | 267 |
| `src/app/traficos/[id]/actions.ts` | 191 |
| `src/app/traficos/[id]/types.ts` | 100 |
| `src/app/traficos/[id]/loading.tsx` | 78 |
| `src/app/traficos/[id]/PageOpenTracker.tsx` | 22 |
| `src/app/traficos/[id]/tabs/DocumentosTab.tsx` | 180 |
| `src/app/traficos/[id]/tabs/PartidasTab.tsx` | 356 |
| `src/app/traficos/[id]/tabs/CronologiaTab.tsx` | 448 |
| `src/app/traficos/[id]/tabs/NotasTab.tsx` | 256 |
| `src/app/traficos/[id]/tabs/ComunicacionTab.tsx` | 137 |
| **Total** | **3,331** |

### Gates

```
npm run typecheck    → 0 errors
npm run build        → green; route manifest shows both
                       ƒ /traficos/[id]
                       ƒ /traficos/[id]/legacy
npm run test         → 124 passed (10 files)
npm run lint         → 0 new errors in Block 1B files
                       (pre-existing 137 errors elsewhere untouched)
```

### Telemetry coverage (15 events, all fired via `useTrack`)

All telemetry uses the locked 15-event `TelemetryEvent` union; new
event vocabulary rides in `metadata.event` — matches the pattern the
Polish Pack established in `PageOpenTracker`.

| # | Event (metadata.event or type) | File |
|---|---|---|
| 1 | `trafico_opened` | `PageOpenTracker.tsx` |
| 2 | `tab_switched` | `TraficoDetail.tsx` |
| 3 | `hero_tile_clicked` | `HeroStrip.tsx` |
| 4 | `action_fired` (rightrail buttons) | `RightRail.tsx` |
| 5 | `action_fired` (assign_operator) | `RightRail.tsx` |
| 6 | `cronologia_filter_changed` | `tabs/CronologiaTab.tsx` |
| 7 | `cronologia_event_opened` | `tabs/CronologiaTab.tsx` |
| 8 | `partida_opened` | `tabs/PartidasTab.tsx` |
| 9 | `below_fold_section_expanded` | `BelowFold.tsx` |
| 10 | `trafico_note_added` | `tabs/NotasTab.tsx` |
| 11 | `mention_created` (per mention) | `tabs/NotasTab.tsx` |
| 12 | `doc_uploaded` | `components/docs/DocUploader` (reused) |
| 13 | `doc_type_corrected` | `components/docs/DocTypePill` (reused) |
| 14 | `solicitation_sent` | `components/trafico/SolicitarDocsModal` (reused) |
| 15 | `checklist_item_viewed` | `components/docs/ExpedienteChecklist` (reused) |

### Hard-rules code scan

```
grep -rn "window.open"      src/app/traficos/[id]/ --exclude-dir=legacy → 0
grep -rn ".catch(() =>"     src/app/traficos/[id]/ --exclude-dir=legacy → 0
grep -rn ": any"            src/app/traficos/[id]/ --exclude-dir=legacy → 0
grep -rn "fmtRelativeTime"  src/app/traficos/[id]/ --exclude-dir=legacy → 0
grep -rn "console\.log"     src/app/traficos/[id]/ --exclude-dir=legacy → 0
grep -rn "ADUANA\|CRUZ"     src/app/traficos/[id]/*.tsx tabs/*.tsx     → 0
```

All glass tokens from `src/lib/design-system.ts`; no new hex literals.
`fmtDateTime` used throughout. 60px touch targets on every interactive
element. Tenant-scoped via `verifySession`. All server actions log to
`operational_decisions` and fire a `workflow_events` row with the
category-mapped `workflow`.

### Client View Test / No-Scroll Test

Code-conforming: dark glass palette matches `ClientHome.tsx`; right
rail uses exactly two panels totalling ~560px (Acciones + Información),
fitting within the 900px viewport alongside the 92px hero strip and
header. Browser verification is Renato's — run `?legacy=1` as the
fallback if anything regresses under real data.

### Readiness for next block

- Block 1B unblocked; `/traficos/[id]` is the new default, legacy
  preserved at `/traficos/[id]/legacy`.
- Blocked on Renato: `npx supabase db push` (Block 1A migrations —
  events_catalog, trafico_detail_columns, trafico_notes re-guard) then
  `npx supabase gen types typescript --local > types/supabase.ts`.
- Until migrations land, Cronología renders zero events (empty state
  with next-expected hint) and BelowFold shows "Sin registro" for the
  new columns — graceful, no errors.
