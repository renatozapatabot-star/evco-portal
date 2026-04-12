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
