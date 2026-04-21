# Block 13 · Warehouse Entry Workflow — Audit

## Scope shipped

- Migration `supabase/migrations/20260423_warehouse_entries.sql`
  - `warehouse_entries` table with status check + `photo_urls text[]`
  - Indexes on `trafico_id` and `(status, company_id)`
  - RLS: tenant-scoped read for `authenticated`, full access for `service_role`
  - Idempotent guards throughout (IF NOT EXISTS, DO $$ BEGIN blocks)

- Library `src/lib/warehouse-entries.ts`
  - `RegisterWarehouseEntrySchema` — Zod, normalises trailer to upper case
  - `buildPhotoPath()` — pure `{company}/{trafico}/{entry}/{ts}_{i}.{ext}` shape
  - `buildCorridorEvent()` — returns `warehouse_entry_received` workflow event payload
  - Constants: `WAREHOUSE_ENTRY_RECEIVED_EVENT`, `WAREHOUSE_PHOTO_BUCKET`, `DOCK_OPTIONS`

- API route `src/app/api/warehouse/register/route.ts`
  - `POST` with multipart `FormData` (fields + `photos[]`)
  - `verifySession()` tenant scope; client role rejected if trafico belongs to
    a different company; warehouse / operator / broker / admin bypass scope
  - Inserts row → uploads to `warehouse-photos` bucket → patches `photo_urls`
  - Fires `workflow_events` row (`warehouse_entry_received`) for corridor map
  - `logDecision()` appends to `operational_decisions`

- Page `src/app/bodega/recibir/` (server + client split)
  - Mobile-first 480px max-width container, `<= 375px` breakpoint primary
  - Trafico search (debounced 180ms) hitting `/api/search/universal?type=traficos`
  - Trailer input: `font: JetBrains Mono`, 18px, autoCapitalize=characters
  - QR scanner button: feature-detects `BarcodeDetector`; otherwise hidden
  - Dock select 1–8 (optional)
  - Photo capture: `<input type="file" accept="image/*" capture="environment" multiple>`
  - Notes textarea
  - Submit button 60px full-width silver gradient
  - Success screen: "Registrar siguiente" (reset) or "Ver detalle" (→ trafico page)

- Tests `src/lib/__tests__/warehouse-entries.test.ts` — five assertions:
  1. `buildCorridorEvent` emits correct event_type + payload shape
  2. `buildPhotoPath` shape + extension normalisation
  3. `trailer_number` required + normalised to upper; bogus chars rejected
  4. `dock_assigned` optional (null when omitted); invalid dock rejected
  5. `getCorridorPosition(warehouse_entry_received)` resolves to `rz_warehouse`

## Mobile rendering

All styles use `minHeight: 60` on interactive elements (meets desktop 60px
guidance; exceeds 44px phone minimum by design — this is the border, not WCAG).
`maxWidth: 480` wrapper keeps the layout anchored to Vicente's phone without
stretching on tablets. Primary viewport verified via @media inspection; live
rendering on device is a Renato follow-up.

## Storage

`warehouse-photos` bucket MUST be created in Supabase dashboard (Renato
follow-up). Without the bucket, the insert still succeeds; photo upload loop
silently produces zero uploaded paths (Telegram alert surfaces via
`logDecision`). Flagged in `plan.md` §Blocked on Renato.

## Corridor map integration

No code change needed — Block 7's `corridor-position.ts` already maps
`warehouse_entry_received` → `rz_warehouse` at severity `at_rest`. Pulses
appear automatically once the event lands in `workflow_events`.

## Known follow-ups

- Mobile device smoke test (iOS Safari + Android Chrome) — Renato follow-up
- `warehouse-photos` bucket provisioning — Renato Supabase dashboard
- Real QR decode path (currently the button just opens the camera picker
  since `BarcodeDetector` is not universally available)
