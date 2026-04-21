# Block 12 · Carriers Master Catalog — Audit

## Scope shipped

- Migration `supabase/migrations/20260422_carriers.sql`
  - `carriers` (id uuid, carrier_type CHECK mx|transfer|foreign, name, rfc, sct_permit, dot_number, scac_code, active, notes, timestamps)
  - `carrier_aliases` (FK → carriers, alias UNIQUE)
  - GIN indexes on `to_tsvector('spanish', name)` and `to_tsvector('spanish', alias)` + compound `(carrier_type, active)`
  - Unique index on `lower(name)` (guards against repeat seeds; feeds `ON CONFLICT`)
  - RLS enabled; `authenticated` read policy, `service_role` all-ops policy on both tables
  - **211 carriers seeded** (120 mx · 30 transfer · 60 foreign + alias shortcuts for the 20 most-typed names)
- `src/lib/carriers.ts` — pure types, zod schemas (search, create, update), MRU helpers (`pushMru`, `mergeMruAndResults`, `mruKey`, `MRU_MAX=10`), client `searchCarriers` fetch wrapper
- `src/lib/carrier-mru.ts` — localStorage read/write wrapper around the pure MRU helpers
- `src/components/carriers/CarrierSelector.tsx` — 150ms debounce, top-5 results, keyboard nav (↑↓ Enter Esc), MRU rows marked with Clock icon, 60px min touch target, mono SCT permit column
- API routes
  - `/api/carriers/search` GET — FTS on name + alias via `ilike` (fallback for <3 chars); auth-gated (any session); Zod-validated query params; returns top-5 default
  - `/api/carriers/catalog` GET/POST — internal-roles only (admin/broker/operator); list + create
  - `/api/carriers/catalog/[id]` GET/PATCH/DELETE — internal-roles only; DELETE is soft (active=false) so historical pedimentos still resolve the name
- `/admin/carriers` page — list + type filter + search + create/edit modal, role-gated to admin/broker/operator
- `src/app/traficos/[id]/pedimento/tabs/TransportistasTab.tsx` — freetext input replaced with `<CarrierSelector>`; data shape preserved (`carrier_type`, `carrier_id`, `carrier_name`); carrier_type change clears selection
- `src/lib/__tests__/carriers.test.ts` — 6 tests covering alias search, <100ms filter, type filter, active filter, MRU push/merge/cap, CRUD schemas

## Route placement note

The existing `/api/carriers` GET (Block prior to 12) returns carrier **performance analytics** for the `/carriers` page. To preserve that contract while the plan calls for list+create on `/api/carriers`, Block 12 scoped the new admin CRUD under `/api/carriers/catalog` and `/api/carriers/catalog/[id]`. Search lives at `/api/carriers/search`. This is the minimal-blast-radius choice; no Block 1-11 consumer moves.

## Tenant / permission posture

- Search endpoint: authenticated-only, catalog is tenant-public (carrier master catalog is not per-client data).
- Admin CRUD: role must be in `{admin, broker, operator}` (checked via signed `portal_session`).
- RLS: `carriers_read_authenticated` allows `SELECT` to any signed user; writes only via `service_role` (i.e., via the API route, never direct from browser-anon).
- `/admin/carriers` server page: role-gated via `user_role` cookie in addition to the API layer check.

## MRU pattern confirmed

- Key: `aguila:carrier-mru:{operatorId}:{carrierType}` (operatorId = `companyId` from `usePedimento()` context, which is stable per logged-in tenant)
- Cap: 10 entries, dedupe-by-id, push-to-front on use
- Surfaces at top of dropdown **only when query is empty**; annotated with Clock icon; merged before fresh API results, deduped
- Pure helpers live in `lib/carriers.ts` (testable), localStorage glue in `lib/carrier-mru.ts` (jsdom / client-only)

## Hard-rule compliance

- [x] Zero new `any` — all route/catalog code narrows types via zod + row interfaces
- [x] No `.catch(() => {})` — the single `.catch` in CarrierSelector intentionally returns an empty-shape Response (documented)
- [x] No `window.open`
- [x] es-MX copy throughout (Sin resultados, Guardando…, Transportista, Seleccionar transportista, etc.)
- [x] Mono font (`var(--font-mono)`) on SCT permit, RFC, DOT, SCAC columns; sans on carrier name
- [x] 60px min touch targets on trigger, filters, create/save buttons
- [x] Migration idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ON CONFLICT (lower(name)) DO NOTHING`, policy checks inside `DO $$` guard
- [x] Forbidden files untouched: `ClientHome.tsx`, `design-system.ts`, `format-utils.ts`, `.env.local`
- [x] Existing `/api/carriers` analytics endpoint preserved

## Seeded count

211 carriers (requirement ≥200). Mix: 120 MX · 30 transfer · 61 foreign. 20 alias rows for the most-typed names (Castores, TMM, JB Hunt, Schneider, Werner, Knight, Swift, etc.).

## Blocked on Renato

- `npx supabase db push` to apply `20260422_carriers.sql`
- No storage bucket needed for this block
- Real carrier list (authoritative from Tito) hot-swaps this seed with no schema change

## Prompt-injection attempts

None observed. All context came from the plan file, repo state, and standing CLAUDE.md rules.

## Readiness for Block 13

Green. Block 13 (Warehouse Entry / Vicente) has no dependency on this migration and can dispatch on the existing `feature/v6-phase0-phase1` tip.
