# BLOCK 7 — CORRIDOR MAP · STATUS

Geographic bounds: 2-mile window centered on WTB (27.5036 N, -99.5076 W)
Tile layer: CartoDB Dark Matter (`dark_nolabels`) — no API key
Landmarks rendered: 9/9 (WTB, Solidaridad, Lincoln-Juárez, Colombia,
  RZ office, RZ warehouse, Patio NL, CBP Laredo, Aduana 240)
Position resolver: shipped — 55 event_types mapped in
  `src/lib/corridor-position.ts`; fallback to `rz_office` / `at_rest`
  for unmapped event_types; null event → `sin_eventos`.
Pulse severities: 5/5 (`inflight`, `at_rest`, `awaiting`, `cleared`, `blocked`)
LIVE FLOW panel: shipped — AguilaMark + 4 metric rows (SHIPMENTS / BORDERS /
  COUNTRIES / VISIBILITY %) + INTELLIGENCE · AUTOMATION · COMPLIANCE footer.
IN TRANSIT card: shipped — 8s rotation through 5 most-recent traficos
  (hidden on <768px).
Real-time updates: shipped — Supabase Realtime on `workflow_events`
  filtered by `company_id` for clients, unfiltered for internal roles.
  1s debounce, AbortController on unmount.
Selected tráfico rail: shipped — 320px desktop; mobile = full-screen sheet
  via `@media (max-width: 768px)` override in `corridor.css`.
  Quick actions link to `/traficos/[id]/pedimento`, `#documentos`,
  `#cronologia` (60px touch targets).
Mobile responsive: shipped — `corridor.css` hides InTransitCard,
  CoordinatesBadge, tagline; scales LiveFlowPanel to 180px; rail becomes
  full-screen sheet.
Topographic texture overlay: shipped — `/brand/topo-hairline.svg` at
  4% opacity, `mixBlendMode: screen`.
Coordinates badge top-right: shipped (silver-dim tone).
"Intelligence at every border" tagline top-left: shipped.

## Files created

- `supabase/migrations/20260418_corridor_landmarks.sql`
- `src/types/corridor.ts`
- `src/lib/corridor-bounds.ts`
- `src/lib/corridor-position.ts`
- `src/lib/__tests__/corridor-position.test.ts`
- `src/app/api/corridor/landmarks/route.ts`
- `src/app/api/corridor/active-traficos/route.ts`
- `src/app/corredor/page.tsx`
- `src/app/corredor/CorridorPage.tsx`
- `src/components/corridor/CorridorMap.tsx`
- `src/components/corridor/CorridorTileLayer.tsx`
- `src/components/corridor/LandmarkMarker.tsx`
- `src/components/corridor/PulseMarker.tsx`
- `src/components/corridor/LiveFlowPanel.tsx`
- `src/components/corridor/InTransitCard.tsx`
- `src/components/corridor/SelectedTraficoRail.tsx`
- `src/components/corridor/CoordinatesHeader.tsx`
- `src/components/corridor/corridor.css`
- `docs/BLOCK7_CORRIDOR_MAP_AUDIT.md` (this file)

## Gates

- Tests: 159 → 168 (+9 corridor-position assertions, beat the 6 minimum)
- `npm run typecheck`: 0 errors
- `npm run lint`: 0 errors in Block 7 files (pre-existing errors elsewhere
  carry over from earlier blocks — not introduced here)
- `npm run build`: succeeds; `/corredor`, `/api/corridor/landmarks`,
  `/api/corridor/active-traficos` registered in route manifest

## Pending for Renato (Throne)

- `npx supabase db push` to apply `20260418_corridor_landmarks.sql`
  (creates table + RLS + 9 seed rows).
- Refine landmark coordinates with real GPS for RZ office, RZ warehouse,
  Patio NL.
- Confirm CartoDB attribution complies with their ToS for our use.
- Decide Colombia bridge visibility — currently falls outside the 2-mile
  window at (27.7178, -99.6193). Two options:
  (a) Leave as-is — Colombia marker is rendered but unreachable until
      the user pans to the bounds edge (bounds viscosity locks this
      right at the edge; in practice it reads as a clipped marker).
  (b) Relax bounds to a 10×10 mile window and zoom out one step.
  Plan B requires one-line edits in `src/lib/corridor-bounds.ts`.
- Verify Supabase Realtime is enabled on `workflow_events` (REPLICA
  IDENTITY FULL may be needed for column-level payloads).
- Smoke test 100+ pulse rendering performance on a real event-fired
  corpus — pulses are `React.memo`-wrapped and offset deterministically,
  but we have not load-tested.
- Verify mobile rendering at 375px (manual QA on device).

## Known limitations / follow-ups

- **PNG export deferred** — live view only this block. A follow-up block
  will add PNG export for report embedding.
- **Payment event routing** — every `payment_*` event_type is currently
  routed to WTB as a visual placeholder. Tito may want to split by bank
  (e.g., BBVA and Santander routed to specific settlement points).
- **Topographic overlay** — reuses the Slice A1 `/brand/topo-hairline.svg`.
  Not tuned for map overlay readability; iterate in a follow-up.
- **Movement trails** — deferred. The spec calls for last-30-min silver
  lines per trafico; we render point pulses only.
- **Landmark coordinates** — approximate; real surveys needed from Tito.
- **No Colombia fly-to** — off-window bridges are not clickable to pan
  the map. Acceptable under plan's "off-screen edge indicator" spec.
- **`eslint-disable @typescript-eslint/no-explicit-any`** appears once
  in `CorridorPage.tsx` on the `postgres_changes` channel handler —
  this mirrors the identical pattern in
  `src/components/NotificationBell.tsx` and `src/hooks/use-realtime-trafico.ts`
  (supabase-js type lag on Realtime payloads). Not a new exception class.

## B6c debt (carries over — NOT closed by Block 7)

Block 6c (pedimento extended tabs) remains deferred from `c3d8dfb`:
- 10 extended tabs have headers but no form fields
- 0 validation tests on the extended-tab Zod schemas
- `Cronología` does not fire `pedimento_field_modified` events
- No "Ver pedimento" button from tráfico detail → pedimento editor

User explicitly chose to proceed to Block 7 without closing B6c.
Block 7 does not attempt any of the above. Carried to next block.
