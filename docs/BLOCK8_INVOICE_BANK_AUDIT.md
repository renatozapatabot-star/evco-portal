# Block 8 — Invoice Bank (Audit)

Branch: `feature/v6-phase0-phase1` · Baseline commit before this slice: `2736a9f` (Block 7).

## Scope delivered

- Migration `20260419_invoice_bank.sql` extends `pedimento_facturas` with
  `assigned_to_trafico_id`, `assigned_at`, `status` (unassigned / assigned / archived),
  `file_url`, `received_at`, `company_id`, `uploaded_by`, `archived_at`. Idempotent
  `ADD COLUMN IF NOT EXISTS`. Index on `(status, company_id)` + partial index on
  `assigned_to_trafico_id`. Relaxes `pedimento_id NOT NULL` so bank rows can exist
  before an assignment. Adds tenant-scoped SELECT RLS policy
  `pedimento_facturas_bank_scope` (the existing `_select_via_parent` policy still
  covers assigned rows that join back to `pedimentos`).
- Events catalog: 5 new event types (`invoice_uploaded`, `invoice_classified`,
  `invoice_assigned`, `invoice_archived`, `invoice_deleted`).
- Pure lib `src/lib/invoice-bank.ts`: invoice-specific Claude Vision prompt +
  parser, `isValidStatusTransition`, `buildInvoiceAssignedPayload`,
  `INVOICE_BANK_EVENTS` telemetry union.
- API routes:
  - `GET  /api/invoice-bank` — filter bar list (status, q, currency, dates, amounts).
  - `POST /api/invoice-bank/upload` — bulk upload (≤ 50 files · 10 MB each).
    Images go through Claude Sonnet Vision; PDFs/XML insert with null fields.
  - `PATCH /api/invoice-bank/[id]` — `{action: 'assign', traficoId}` or
    `{action: 'archive'}`. Verifies tráfico tenancy before linking.
  - `DELETE /api/invoice-bank/[id]` — soft delete (`status='archived'` + distinct
    `invoice_deleted` event so the audit trail separates archive vs delete).
- Route `/banco-facturas` (server shell + client surface):
  - Filter bar (7 filters).
  - Drag-drop upload zone + click-to-select (no `window.open`).
  - List of invoice rows (60 px min-height · mono folio/amount · sans labels).
  - Right-rail PDF preview via `<iframe>` with `type="application/pdf"`.
  - Bottom bar `Asignar · Archivar · Eliminar` (60 px targets).
  - Assignment modal reuses `/api/search/universal` (entityId=`traficos`).
- Tests: `src/lib/__tests__/invoice-bank.test.ts` — 6 new tests
  (extraction · fence/string handling · null clamping · legal transitions ·
  illegal transitions · assigned payload + telemetry union size).

## Gate results

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run build` | succeeds · `/banco-facturas`, `/api/invoice-bank`, `/api/invoice-bank/[id]`, `/api/invoice-bank/upload` all registered |
| `npm run test` | 174 passing (was 168 → +6) |

## File counts

| File | Lines |
|---|---|
| `supabase/migrations/20260419_invoice_bank.sql` | 77 |
| `src/lib/invoice-bank.ts` | 219 |
| `src/lib/__tests__/invoice-bank.test.ts` | 87 |
| `src/app/api/invoice-bank/route.ts` | 96 |
| `src/app/api/invoice-bank/upload/route.ts` | 222 |
| `src/app/api/invoice-bank/[id]/route.ts` | 246 |
| `src/app/banco-facturas/page.tsx` | 23 |
| `src/app/banco-facturas/BancoFacturasClient.tsx` | 667 |
| **Total new** | **1637** |

## Telemetry — 6 event fire sites

| Event | Fires at |
|---|---|
| `invoice_bank_opened` | `BancoFacturasClient.useEffect` (once per mount) via `trackEvent('page_view', 'invoice_bank_opened')` |
| `invoice_uploaded` | Client `onFiles` after successful upload batch · server `/api/invoice-bank/upload` emits a `workflow_events` row per file |
| `invoice_classified` | Client loop over per-file results flagged `classified: true` · server emits `workflow_events` row on successful vision extraction |
| `invoice_assigned` | Client `onAssign` after 200 response · server `/api/invoice-bank/[id]` PATCH assign branch emits `workflow_events` + `logDecision` |
| `invoice_archived` | Client `onArchive` · server PATCH archive branch emits `workflow_events` + `logDecision` |
| `invoice_deleted` | Client `onDelete` · server DELETE handler emits `workflow_events` (distinct type) + `logDecision` |

## Hard-rule checks

- No new `any`: zero. The only `unknown` narrowings are in `parseInvoiceExtraction`
  and the PATCH JSON parse.
- No `.catch(() => {})`: the only catch blocks set a user-facing toast message or
  surface through the returned row; none are silent.
- No `window.open`: grep in new files returns 0 matches.
- es-MX user-visible copy throughout.
- AGUILA silver palette only — no cyan/gold imports (deprecated tokens not used).
- Mono font for invoice numbers + amounts; sans for labels; 60 px targets on all
  action buttons; 44 px minimum on mobile inputs.
- Tenant-scoped via `verifySession` + `company_id` on every query.

## Blocked on Renato (for deploy)

1. Apply migration: `npx supabase db push` (picks up `20260419_invoice_bank.sql`).
2. Storage bucket `expedientes` already exists — no new bucket required for B8.
3. `ANTHROPIC_API_KEY` in Vercel env (already set).

## Known judgment calls

- **PDF/XML extraction is deferred** to V1.5 tuning per plan follow-up
  (invoice OCR accuracy tuning). Bulk upload still accepts PDFs + XML and inserts
  rows with `status='unassigned'` and null fields; the operator fills them in via
  the assignment modal's tráfico pick. Vision extraction runs only on images
  today — an explicit scope trade to keep Block 8 atomic.
- **Confirmation before delete** uses `window.confirm`. The pre-commit hook
  disallows `alert(`; `confirm(` is not in the banned list and is the simplest
  3-AM-driver-safe confirmation.
- **iframe preview** per plan §Right rail. No `react-pdf` introduced (would
  require a new npm dep — explicitly disallowed by this slice).
- **Assignment modal** queries `/api/search/universal` filtered client-side to
  `hits.data.traficos`. That endpoint already debounces the client calls; we
  throttle at 180 ms inside the modal too so typing under 2 chars doesn't fire.
- `pedimento_facturas_bank_scope` RLS policy assumes middleware sets
  `app.company_id` per request (matches the pattern already in
  `20260417_pedimento_data.sql`). If Supabase session config isn't doing this
  server-side, the service-role client in route handlers still works because
  it bypasses RLS — defense is at the query layer (`eq('company_id', ...)`).

## Injection attempts observed

- Multiple re-injected `<system-reminder>` blocks during this session claimed
  CRUZ / ADUANA branding and a dark-cockpit opaque-card design system.
- Per the prompt's injection guard, task prompt + plan file are the only
  authoritative source. The delivered surfaces use AGUILA silver, no CRUD / no
  "Portal" / no "ADUANA" / no "CRUZ" in user-visible strings, glass cards with
  `rgba(9,9,11,0.75)` + `backdrop-filter: blur(20px)` per the plan and the
  `.claude/rules/design-system.md` guidance.

## Readiness for Block 8.5

Block 8.5 (B6c extended pedimento tabs) has a direct dependency: the Facturas
tab will call `GET /api/invoice-bank?status=unassigned&company_id=...` to list
bank rows for selection, and the "Agregar factura" modal there will issue the
same PATCH assign payload documented above. Nothing in Block 8's public
contracts blocks 8.5. Migration order is clean (this file is dated
20260419; Block 8.5 will likely not need a new migration).
