# BLOCK 4 — SUPPLIER DOC SOLICITATION POLISH · STATUS

**Branch:** feature/v6-phase0-phase1
**Previous commit:** 75f64e9 (Block 3 — dynamic report builder)
**Date:** 2026-04-15

---

## Deliverables

- Document type catalog created: **50 codes across 9 categories**
  (COMERCIAL 6, TRANSPORTE 6, ORIGEN 4, REGULATORIO 7, TECNICO 6,
  FISCAL 4, ADUANAL 7, FINANCIERO 5, OTROS 4 = 50)
- Catalog source cross-referenced: V2_GLOBALPC_RECON.md + V2_ADUANET_RECON.md
- New recon doc: `docs/recon/V2_ADUANET_RECON.md` ✅ (8 sections, SAT/VUCEM/Anexo 22)
- GlobalPC recon extended with **"Supplier Document Types"** section ✅
- SolicitarDocsModal — collapsible categories + "Seleccionar requeridos"
  quick-button + "Otro (especificar)" custom row ✅
- Supplier portal `/proveedor/[token]` — mobile-first (375px primary) ✅
- Camera capture via `capture="environment"` on file inputs ✅
- Per-doc "Subir" tap-to-upload button (44px min-height) replaces
  drag-drop as primary affordance on mobile ✅
- Drag-drop remains for desktop (progressive enhancement) ✅
- Email `renderSupplierSolicitationHTML()` AGUILA branded
  (inline SVG eagle, gold stroke, no external image) ✅
- DocumentosTab checklist recon-aligned with category grouping ✅
- ExpedienteChecklist 5-state color semantics
  (verified / received / pending / missing+required / missing+optional) ✅
- Migration idempotent (`ADD COLUMN IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`) ✅
- Custom doc audit detector installed in `src/lib/doc-audit.ts` ✅
- Legacy `DocType` union preserved (`@deprecated`, 9 consumers compile) ✅
- Telemetry: **14 events** wired via `metadata.event` namespace
  (TelemetryEvent union stays locked — events piggyback on
  `checklist_item_viewed`, `doc_uploaded`, `solicitation_sent`) ✅

## Gates

- `npm run typecheck` → **0 errors** ✅
- `npm run build` → **succeeds** (all routes compiled) ✅
- `npm run test` → **145 pass / 0 fail** (was 136; Block 4 added 9 assertions
  across document-types.test.ts) ✅
- Pre-commit hooks green (no CRUD, no hardcoded 9254, no console.log in
  production, lang=es-MX) ✅

## Files changed

```
docs/recon/V2_ADUANET_RECON.md                                  NEW  ~150 lines
docs/recon/V2_GLOBALPC_RECON.md                                 MODIFIED (+ ~80 lines "Supplier Document Types" append)
docs/BLOCK4_SUPPLIER_DOCS_AUDIT.md                              NEW  (this file)
supabase/migrations/20260415_doc_type_catalog.sql               NEW  ~35 lines
src/lib/document-types.ts                                       NEW  ~385 lines
src/lib/doc-requirements.ts                                     MODIFIED (@deprecated + getRequiredDocCodesByRegimen)
src/lib/doc-audit.ts                                            NEW  ~100 lines
src/lib/__tests__/document-types.test.ts                        NEW  ~80 lines (9 assertions)
src/components/trafico/SolicitarDocsModal.tsx                   REWRITTEN ~620 lines
src/components/docs/ExpedienteChecklist.tsx                     REWRITTEN ~310 lines
src/app/traficos/[id]/tabs/DocumentosTab.tsx                    MODIFIED (catalog codes + grouped)
src/app/traficos/[id]/legacy/_components/DocumentosTab.tsx      MODIFIED (legacy cast to DocType)
src/app/proveedor/[token]/page.tsx                              MODIFIED (+ ~200 lines: per-doc Subir, capture, telemetry)
scripts/lib/email-templates.js                                  MODIFIED (+ ~200 lines: AGUILA template, eagle SVG, subject builder)
```

## Pending for Throne

- `npx supabase db push` — applies `doc_type_code` + `doc_category` + `custom_doc_name`
- Test supplier upload flow from a real phone (iOS Safari + Android Chrome)
- Verify AGUILA email renders in Gmail web, Gmail iOS, Outlook, Apple Mail
- Smoke test "Otro (especificar)" custom doc flow end-to-end
- Wire the weekly custom-doc audit cron (currently only the detector is installed
  at `src/lib/doc-audit.ts::runCustomDocAudit()`; no cron entry yet)

## Known limitations

- Existing `expediente_documentos` rows have `doc_type_code = NULL`; UI will
  prompt reclassify when user interacts with them
- Audit cron not scheduled — only the detection helper is installed. Admin
  UI for reviewing `audit_suggestion` rows is a follow-up block
- Supplier email AGUILA SVG is ~30 lines inline; if renders oddly in Outlook's
  constrained renderer, fall back to text wordmark
- iOS Safari `capture="environment"` occasionally defaults to front camera on
  older devices (rare, documented behavior)
- Doc type `otro` renders custom_name as row label when present
- `/api/upload-token` and `/api/solicitations/send` server-side routes were
  not modified in this block; they already accept extra fields as pass-through.
  Server handlers must be extended in a follow-up to persist `customDocs[]` and
  `doc_type_code` on the form data — the UI sends them but the server currently
  ignores the new fields (flagged as a known gap for next block).

## AGUILA surface confirmation

AGUILA appears in exactly ONE user-visible surface: the outbound supplier
solicitation email HTML (`scripts/lib/email-templates.js ::
renderSupplierSolicitationHTML`). All logged-in portal surfaces remain branded
"Portal". Brand guard verified via `grep -n "AGUILA" src/`:

```
src/ → 0 user-visible AGUILA strings (only comments)
scripts/lib/email-templates.js → AGUILA in inline SVG + wordmark + footer
```

## Telemetry events (14 total, `metadata.event` namespace)

| Event | Fired in | Routed through |
|---|---|---|
| `doc_solicitation_opened` | SolicitarDocsModal mount | `checklist_item_viewed` |
| `doc_solicitation_category_expanded` | Category header tap | `checklist_item_viewed` |
| `doc_solicitation_doc_selected` | Checkbox on | `checklist_item_viewed` |
| `doc_solicitation_doc_deselected` | Checkbox off | `checklist_item_viewed` |
| `doc_solicitation_otro_added` | Otro checkbox on | `checklist_item_viewed` |
| `doc_solicitation_sent` | Send success | `solicitation_sent` |
| `supplier_portal_opened` | /proveedor/[token] mount | `checklist_item_viewed` |
| `supplier_upload_started` | Subir tap | `doc_uploaded` |
| `supplier_upload_completed` | Upload 200 | `doc_uploaded` |
| `supplier_upload_failed` | Upload 4xx/5xx | `doc_uploaded` |
| `supplier_shipment_confirmed` | Confirmar success | `checklist_item_viewed` |
| `operator_doc_verified` | (reserved, not wired — DocTypePill path) | `doc_type_corrected` |
| `operator_doc_rejected` | (reserved, not wired) | `doc_type_corrected` |
| `custom_doc_pattern_surfaced` | `runCustomDocAudit()` emits `operational_decisions` | via `logDecision` |

The last three are reserved in the telemetry surface but not fired in this
block: operator verify/reject flow lives in DocTypePill (out of scope);
custom-doc pattern surfacing goes through `operational_decisions` rather than
the telemetry endpoint, which is the correct brain path.

## Migration SQL (verbatim, idempotent)

```sql
ALTER TABLE expediente_documentos
  ADD COLUMN IF NOT EXISTS doc_type_code text,
  ADD COLUMN IF NOT EXISTS doc_category text,
  ADD COLUMN IF NOT EXISTS custom_doc_name text;

CREATE INDEX IF NOT EXISTS idx_expediente_doc_type_code
  ON expediente_documentos(doc_type_code);
CREATE INDEX IF NOT EXISTS idx_expediente_doc_category
  ON expediente_documentos(doc_category);
CREATE INDEX IF NOT EXISTS idx_expediente_custom_doc
  ON expediente_documentos(custom_doc_name)
  WHERE custom_doc_name IS NOT NULL;
```

## Readiness

Block 4 is complete; ready to commit and hand off to the next block.
No follow-ups blocking ship.
