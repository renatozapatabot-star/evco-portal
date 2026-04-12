# V1.5 F19 · Print Label System — Audit

## Demo moment

Vicente finishes registering a new entrada on his phone, taps **Imprimir
etiqueta**, the browser opens the 4×6" PDF, the OS print dialog pushes it to
his Zebra/Brother thermal printer. The label carries the F1 QR code, tráfico
ref, cliente name, dock, trailer number, timestamp, and the AGUILA wordmark.

## What shipped

- `supabase/migrations/20260503_v15_f19_print_queue.sql`
  - `print_queue` table (id, company_id, template, payload jsonb, status
    `pending|printed|failed|cancelled`, created_by, created_at, printed_at,
    printer_id, error)
  - Three indexes: `(status, created_at desc)`, `company_id`, `created_by`
  - RLS on: `read_own_company`, `insert_own_company`, `service_role_all`
- `src/lib/label-templates/entrada.tsx`
  - `@react-pdf/renderer` 4×6" document (288×432 pt)
  - AGUILA wordmark + silver header + black-on-white body (thermal-safe)
  - Large QR image (180pt) + short code in monospace
  - Tráfico ref, cliente, dock, trailer, received-at in es-MX timezone
  - `renderEntradaLabelPdf()` + `ensureQrDataUrl()` helpers (pure, testable)
- `POST /api/labels/print`
  - `verifySession` + allowed roles: `warehouse|admin|broker|operator`
  - Loads warehouse_entries row, checks tenant (non-internal must match)
  - F1 integration: calls `createEntradaQrCode()` if no code exists yet
  - Resolves cliente display name from `companies` (nombre_comercial →
    razon_social → name → company_id fallback)
  - Inserts `print_queue` row with `template='entrada_4x6'` + payload
  - Writes `label_print_queued` decision to `operational_decisions`
  - Returns `{ id, pdfUrl: /api/labels/[id]/pdf, qrCode }`
- `GET /api/labels/[id]/pdf`
  - Session + tenant check, re-renders PDF from queue payload
  - Returns `application/pdf` with `Cache-Control: no-store`
- UI: `src/app/bodega/recibir/RecibirEntradaClient.tsx`
  - "Imprimir etiqueta" silver-gradient button (60px) on the success screen
  - Opens returned `pdfUrl` in a new tab so the browser print dialog fires
  - Silver toast "Etiqueta en cola" on success; red toast on failure
- Tests: `src/lib/__tests__/label-templates-entrada.test.ts` (3 cases)

## Telemetry

`payload.event = 'label_print_queued'` on every queue insert.
`operational_decisions.decision_type = 'label_print_queued'` for the Brain.

## Theme

Label PDF is white background with silver/black ink — correct for thermal
printers. The only white surface in the app, by design. The in-app UI
(button, toast) stays AGUILA dark silver glass.

## Deferred

- Direct printer push (IPP, CUPS, Zebra ZPL driver) — browser print is the
  common denominator across Vicente's phone, the bodega iPad, and any laptop.
- Real dock assignment from a yard module — current flow uses the dock
  Vicente typed on the entrada form or none.
- Cola de impresión page (`/bodega/impresion`) + last-5-jobs widget on
  `/bodega/inicio` — deferred; print is a per-entrada action and the
  `print_queue` table is ready. Ship in a follow-up that also adds the
  "mark printed / reprint" action.
- Nav item under warehouse — not added (per plan: ship only if under 30 min).

## Test delta

Baseline 340 → 343 tests (+3 for label template input + QR fallback).

## Gates

1. `npm run typecheck` — 0 errors
2. `npm run build` — green
3. `npm run test` — 343 passed
4. `bash scripts/gsd-verify.sh` — pre-existing warnings only (demo/request-access
   hardcoded hexes — not introduced by F19)

## Files

- `supabase/migrations/20260503_v15_f19_print_queue.sql` (new)
- `src/lib/label-templates/entrada.tsx` (new)
- `src/app/api/labels/print/route.ts` (new)
- `src/app/api/labels/[id]/pdf/route.ts` (new)
- `src/app/bodega/recibir/RecibirEntradaClient.tsx` (edit — print button + toast)
- `src/lib/__tests__/label-templates-entrada.test.ts` (new)
- `docs/V15_F19_AUDIT.md` (new)
