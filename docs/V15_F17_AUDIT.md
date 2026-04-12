# V1.5 · Feature 17 — Pedimento PDF Live Preview

**Status:** shipped
**Branch:** feature/v6-phase0-phase1

## Shipped
- New right-rail aside tab **"Vista previa PDF"** in the 14-tab pedimento editor
  (`src/app/traficos/[id]/pedimento/PedimentoLayout.tsx`). Two-tab aside strip:
  Validación (default) / Vista previa PDF.
- `PdfPreviewRail.tsx` client component, silver glass chrome, initial fetch
  immediate, subsequent refreshes **debounced to 2s** keyed on autosave
  validation-state changes (proxy for form dirtiness, since autosave writes
  straight to DB). Fallback text on error: *"No se pudo generar vista previa
  — corrige errores"*.
- **Pure render fn extracted:** `src/lib/pedimento/render-pdf.tsx` —
  `renderPedimentoPdf(full, generatedAt?)` via `@react-pdf/renderer` +
  shared `AguilaPdfHeader` / `AguilaPdfFooter`. No DB, no storage, no logging.
  Hot-swappable with the eventual SAT-official template.
- `GET /api/pedimento/[id]/preview` — returns raw `application/pdf` bytes.
  Verifies session + tenant (`company_id` check), loads pedimento + all child
  tables + partidas, calls `renderPedimentoPdf`, returns bytes. **No side
  effects** (no export-job row, no workflow_event, no decision log).
- **No new runtime dependencies.** Tried `react-pdf` (pdf.js-based viewer),
  then removed it in favor of a dep-free blob-URL iframe render — the browser
  native PDF viewer is sufficient for the demo moment and keeps the bundle
  lean (no worker ship, no pdf.js fonts, no SSR hazards).
- PDF output: AGUILA silver header + footer, sections for Encabezado,
  Partidas (first 40 + ellipsis tail), Facturas, Contribuciones.
  Pedimento number preserved with spaces; fracciones with dots; mono font on
  all numeric cells.

## Test delta
- Before: **333 tests / 39 files**
- After: **335 tests / 40 files** (+2 tests)
- New file: `src/lib/pedimento/__tests__/render-pdf.test.tsx`
  - asserts the render fn returns a `%PDF-` magic-header Buffer
  - asserts empty child-tables still produce a valid PDF (no crash on nulls)

## Deferred
- Zoom controls in the preview iframe (relies on browser viewer for now).
- Page navigation UI for multi-page pedimentos — the browser viewer handles
  navigation natively inside the iframe; no custom control strip yet.
- Print-direct-from-rail button (user can right-click / Cmd-P inside the
  iframe; explicit button TBD).
- `react-pdf` inline rendering (`<Document file={blob} />` + `<Page />`) —
  deferred in favor of iframe to avoid adding pdf.js worker + CDN
  configuration to the client bundle. If future features need per-page
  control (annotations, overlays), revisit.
- Mobile 375px layout — pedimento editor is desktop-only today (grid
  template doesn't collapse); preview rail inherits that constraint.

## Gates
- `npm run typecheck` — 0 errors
- `npm run build` — green
- `npm run test` — 335 passing
- `bash scripts/gsd-verify.sh` — pre-existing warnings/failures only; nothing
  flagged in the new files (`render-pdf.tsx`, `PdfPreviewRail.tsx`,
  `preview/route.ts`, `PedimentoLayout.tsx` diff).
