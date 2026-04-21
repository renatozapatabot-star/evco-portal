# Block 16 — DODA + Carta Porte + AVC Audit

## Shipped atomically

One commit. Typecheck 0 errors. Build succeeds with all new routes registered.
Tests 242 → 251 (+9, target met).

## Shared PDF brand extraction

`src/lib/pdf/brand.tsx` exposes `AguilaPdfHeader({ title, subtitle?, gradientId? })`
and `AguilaPdfFooter({ label? })`. The EAGLE_PATH silhouette and silver palette
tokens (PDF_SILVER, PDF_SILVER_BRIGHT, PDF_SILVER_DIM) are exported for reuse.

Callers (5 total, as mandated):

1. Block 5 — `src/lib/classification-pdf.tsx` (refactored)
2. Block 10 — `src/lib/anexo-24-export.tsx` (refactored)
3. Block 16 — `src/lib/doc-generators/doda.tsx`
4. Block 16 — `src/lib/doc-generators/carta-porte.tsx`
5. Block 16 — `src/lib/doc-generators/avc.tsx`

Block 5 preserves its unique "Año 85" footer label via the `label` prop. Block 10
uses the default footer. Classification sheet and Anexo 24 PDFs remain
functionally identical — tests on both still pass.

## Generators

| File | Function | Output |
|---|---|---|
| `src/lib/doc-generators/doda.tsx` | `generateDODA(input)` | `{ pdf: Buffer, xml: string }` |
| `src/lib/doc-generators/carta-porte.tsx` | `generateCartaPorte(input)` | `{ pdf, xml }` |
| `src/lib/doc-generators/avc.tsx` | `generateAVC(input)` | `{ pdf, xml }` |

Each validates required fields and throws a typed `*ValidationError` on failure.
Each emits XML prefixed with `<!-- PLACEHOLDER: verify against official ... XSD
before production use -->`. Each PDF carries the AMBER banner "Generación local.
Submisión a VUCEM/SAT pendiente para V2."

XML schemas:

- **DODA**: `xmlns="http://www.sat.gob.mx/doda"` envelope with Pedimento,
  Emisor, Receptor, Valores, Transporte, Sello (SHA256 placeholder).
- **Carta Porte**: `cfdi:Comprobante` CFDI 4.0 + `cartaporte30:CartaPorte`
  complement 3.0 with Ubicaciones, Mercancias, Autotransporte.
- **AVC**: `xmlns="http://www.sat.gob.mx/avc"` envelope with EntradaBodega,
  Trafico, Importador, Patente, Recepcion, Evidencia, Notas, Sello.

All XMLs use ISO 8601 timestamps and proper XML escaping (ampersand, quotes,
angle brackets, apostrophe).

## Routes

| Page | Path |
|---|---|
| DODA | `/traficos/[id]/doda` |
| Carta Porte | `/traficos/[id]/carta-porte` |
| AVC | `/bodega/[id]/avc` |

All three use the shared `RegulatoryDocClient` component which renders the
AMBER banner, three buttons (Generar PDF / Generar XML / Descargar ambos), and
download links after success. Server components verify session and tenant
isolation via `company_id` unless the role is broker/admin.

## API

| Endpoint | Verb |
|---|---|
| `/api/regulatory/doda/[pedimento_id]` | POST |
| `/api/regulatory/carta-porte/[trafico_id]` | POST |
| `/api/regulatory/avc/[warehouse_entry_id]` | POST |

Each: `verifySession` → fetch row (tenant-scoped) → call pure generator →
upload PDF + XML to `regulatory-docs` bucket → insert `workflow_events` row
(`doda_generated` / `carta_porte_generated` / `avc_generated`) → `logDecision`.
Returns `{ pdf_url, xml_url, generado_en }`.

Storage path convention: `{company_id}/{trafico_id}/{timestamp}_{kind}.{ext}`.

## Migration

`supabase/migrations/20260426_regulatory_doc_events.sql` — adds three rows to
`events_catalog` (lifecycle, private, es-MX labels) with
`ON CONFLICT (event_type) DO NOTHING` for idempotency.

## Tests

9 new tests (3 per generator) under `src/lib/doc-generators/__tests__/`:

- PDF: Buffer type, `%PDF-` signature, non-trivial size (>1000 bytes)
- XML: xml declaration, PLACEHOLDER comment present, required top-level tags
- Validation: missing required fields and invalid formats rejected with typed errors

Test count: 242 → 251. All suites green in 1.20s.

## Gates

- `npx tsc --noEmit` → 0 errors
- `npm run build` → succeeds; 3 new pages + 3 new API routes registered
- `npx vitest run` → 251 passing (26 files)
- Lint: no new errors introduced in Block 16 files (pre-existing 143 errors
  unrelated per CLAUDE.md KNOWN ISSUES)

## Flagged for Renato

- Supabase Storage bucket `regulatory-docs` — create in dashboard before
  first generation call succeeds
- Migration `20260426_regulatory_doc_events.sql` — apply via
  `npx supabase db push`

## Readiness for Block 17

All Block 16 gates green. Pedimento-facing surfaces now include DODA +
Carta Porte + AVC generation. `workflow_events` emits three new event types
consumable by Cronología and the workflow processor. Ready to proceed to
Block 17 (MVE Monitor with auto-detection).
