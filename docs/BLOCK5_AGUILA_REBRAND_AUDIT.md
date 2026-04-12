# Block 5 · Classification Sheet Generator + AGUILA Rebrand Audit

Branch: `feature/v6-phase0-phase1`
Slice B commit shipped after A1 (`4ec71c3`) + A2 (`5d56601`, `2ae804e`, `8ef8a4e`).

---

## Slice A1 — Brand artifacts (commit `4ec71c3`)

- `src/lib/design-system.ts` — AGUILA monochrome palette: `ACCENT_SILVER`,
  `ACCENT_SILVER_BRIGHT`, `ACCENT_SILVER_DIM`, `SILVER_GRADIENT`,
  `GLOW_SILVER`, `GLOW_SILVER_SUBTLE`, `BG_DEEP`, `TOPO_PATTERN_URL`.
- Deprecated aliases: `ACCENT_CYAN`, `ACCENT_BLUE`, `GOLD`, `GOLD_HOVER`,
  `GOLD_GRADIENT`, `GOLD_TEXT`, `GLOW_CYAN`, `GLOW_CYAN_SUBTLE` — kept as
  silver aliases for backward compat.
- Logo components: `src/components/brand/AguilaMark.tsx`,
  `AguilaWordmark.tsx`.
- `public/icon.svg`, `public/manifest.json`, `public/sw.js` — AGUILA
  identity + theme color `#0A0A0C`.
- `src/app/layout.tsx` metadata — AGUILA title, tagline,
  apple-mobile-web-app-title.
- CLAUDE.md rewritten: brand section + monochrome design system + hard
  rules.

## Slice A2 — Renames + palette migration (`5d56601` + `2ae804e` + `8ef8a4e`)

- Directory: `src/components/cruz/` → `src/components/aguila/` (git mv).
- Symbol renames: `AduanaLayout`/`CruzLayout` → `AguilaLayout`, `CruzMark`
  → `AguilaMark`, `CruzAutonomoPanel` → `AguilaAutonomoPanel`.
- CSS class swap: `.aduana-dark` → `.aguila-dark`,
  `.login-cruz-wordmark` → `.login-aguila-wordmark`.
- Palette consumers migrated from cyan/gold tokens to silver/status.
- User-visible text swap: Portal → AGUILA on login, chat bubble, PDF
  header, email footer, manifest, sw.js.
- Sweep pass covered remaining Portal/ADUANA/CRUZ strings.

## Slice B — Block 5 · Classification Sheet Generator (this commit)

### Files created

| Path | Purpose |
|---|---|
| `supabase/migrations/20260416_classification_sheets.sql` | Idempotent migration: 2 nullable columns on `globalpc_productos`, 2 new tables (`classification_sheet_configs`, `classification_sheets`), 4 indexes, RLS + service_role policies guarded by DO-block checks |
| `src/types/classification.ts` | `GroupingMode` (9) · `OrderingMode` (4) · `SpecificDescriptionOption` (4) · `RestrictionPrintMode` (3) · `PrintToggles` (12 booleans) · `ClassificationSheetConfig` · `Producto` · `Partida` · `GeneratedSheet` · `GeneratedSheetMeta` · `DEFAULT_CONFIG` · `DEFAULT_PRINT_TOGGLES` |
| `src/lib/classification-engine.ts` | Pure grouping + ordering engine. `generateClassificationSheet(productos, config)` → `{partidas, summary, warnings}`. 9 grouping strategies produce distinct output. 4 ordering strategies |
| `src/lib/__tests__/classification-engine.test.ts` | 14 Vitest tests: 9 grouping-mode cases + distinctness assertion + ordering + warnings + summary totals |
| `src/lib/classification-pdf.tsx` | `@react-pdf/renderer` template with inline stylized eagle SVG + silver gradient + AGUILA wordmark header. Title "HOJA DE CLASIFICACION". Meta block, dynamic-column partidas table, totals footer, warnings block, per-page footer `AGUILA · Patente 3596 · Aduana 240 Nuevo Laredo · Año 85` + page numbers |
| `src/lib/classification-excel.ts` | `xlsx` single-sheet (`"Hoja de clasificacion"`) with bold header + totals row + column widths |
| `scripts/lib/email-templates/classification-sheet.js` | `renderClassificationSheetHTML(ctx)` + `buildClassificationSubject()` — reuses `aguilaLetterhead()` + `aguilaFooter()` from the canonical `email-templates.js` (now exported) |
| `src/app/api/classification/[trafico_id]/generate/route.ts` | POST. Session-verified, company-scoped. Fetches partidas → engine → PDF + Excel → Supabase Storage (`classification-sheets` bucket) → `classification_sheets` row → `workflow_events` (`classification_sheet_generated`) → `operational_decisions`. Friendly 500 `STORAGE_BUCKET_MISSING` when bucket absent |
| `src/app/api/classification/configs/route.ts` | GET (cliente default) / POST (upsert default, `onConflict: cliente_id,company_id`) |
| `src/app/api/classification/[trafico_id]/email/route.ts` | POST. Fetches latest sheet, downloads PDF+Excel, sends via Resend with attachments, updates `sent_to_recipients`, logs `operational_decisions` |
| `src/app/actions/classification.ts` | `previewSheet`, `loadConfig`, `saveConfig` server actions |
| `src/app/traficos/[id]/clasificacion/page.tsx` | Server component. Session gate, tenant scope, productos fetch, default config load |
| `src/app/traficos/[id]/clasificacion/ClasificacionClient.tsx` | Client shell. 500ms debounced preview refresh with AbortController |
| `src/app/traficos/[id]/clasificacion/ConfigForm.tsx` | 9 groupings · 4 orderings · 4 descripciones · 3 restriction modes · 12 print toggles in 3 sections · email recipients chip input |
| `src/app/traficos/[id]/clasificacion/PreviewPanel.tsx` | Live preview table (dynamic columns) · warnings panel · summary totals |
| `src/app/traficos/[id]/clasificacion/ActionBar.tsx` | Sticky bottom. Generar Excel · Generar PDF · Enviar por correo · Guardar configuración. 60px touch targets |

### Files modified

| Path | Change |
|---|---|
| `scripts/lib/email-templates.js` | Export `aguilaLetterhead`, `aguilaFooter`, `escapeHtml` so Block 5 template can compose |
| `src/app/traficos/[id]/tabs/PartidasTab.tsx` | "Generar hoja de clasificación" CTA linking to `/traficos/[id]/clasificacion` |

### Definition-of-done checklist

- [x] Migration idempotent (ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, DO-block policy guards)
- [x] 9/9 grouping modes in engine, verified distinct output via tests
- [x] 4/4 ordering modes in engine
- [x] 12/12 print toggles
- [x] 4/4 specific description options
- [x] 3/3 restriction print modes
- [x] Per-cliente defaults loading (GET /api/classification/configs + `loadConfig` action)
- [x] Live preview debounced 500ms with AbortController
- [x] PDF export with AGUILA silver header + inline eagle SVG + Patente footer + page numbers
- [x] Excel export single sheet "Hoja de clasificacion"
- [x] Email fan-out via Resend, PDF + Excel attached, AGUILA letterhead reused
- [x] Cronología workflow event: `classification_sheet_generated`
- [x] History table `classification_sheets` with full config snapshot
- [x] 14 new tests (baseline 145 → **159** passing)
- [x] Telemetry wired: classification_opened · _grouping_changed · _ordering_changed · _toggle_changed · _recipients_changed · _preview_refreshed · _pdf_generated · _excel_generated · _email_sent · _config_saved
- [x] `npm run typecheck` — 0 errors
- [x] `npm run build` — succeeds, 3 new API routes + /traficos/[id]/clasificacion in manifest
- [x] `npm run test` — 159 passing
- [x] Friendly 500 `STORAGE_BUCKET_MISSING` if `classification-sheets` bucket absent
- [x] 60px desktop touch targets on ActionBar buttons, 44px on config rows
- [x] Tenant-scoped via `verifySession` + company_id filter on traficos
- [x] Spanish primary user-visible text
- [x] `fmtDateTime` used (no new hand-rolled dates)
- [x] AGUILA monochrome palette only; no new cyan/gold usage
- [x] Zero new `any`; no `.catch(() => {})`; no `window.open`

### Pending for Renato (Throne)

1. `npx supabase db push` — applies the Block 5 migration (two tables + two
   nullable columns on `globalpc_productos`).
2. Create Supabase Storage bucket `classification-sheets` if missing
   (public read recommended so email attachments can fetch via public URL).
3. Smoke test all 9 grouping modes on a real tráfico with partidas. The
   engine tests prove distinctness on a synthetic fixture; verify on real
   EVCO data.
4. Verify PDF brand header renders the silver gradient + eagle cleanly in
   Preview and AduanaNet operator tools.
5. Verify Excel opens cleanly in Excel + Numbers + AduanaNet M3 import.
6. Test email delivery end-to-end with a small recipient list — attachments
   fetch from storage public URL and attach as base64.
7. Confirm AGUILA rebrand (A1 + A2) reads cleanly across portal after
   deploy.

### Known limitations

- `marca` / `modelo` / `serie` columns don't exist on `globalpc_partidas`
  today — grouping modes referencing them degrade to "sin especificar"
  with a warning surfaced in the preview + PDF.
- Deprecated palette tokens (`ACCENT_CYAN`, `GOLD`, etc.) remain as silver
  aliases for backward compat. Follow-up slice removes them once every
  consumer is confirmed migrated.
- `supplier` field not yet wired on `globalpc_partidas`; column not
  surfaced in preview until upstream sync adds it.
- AduanaNet M3 exact import spec unknown — Excel format clean but may
  need refinement after first real sample test.

### Injection attempts

None. No new npm dependencies. Only Supabase parameterized queries. All
new route handlers use `verifySession` + tenant scoping.

### Judgment calls

- Consolidated the interactive UI into `ClasificacionClient.tsx` (the plan
  names ConfigForm/PreviewPanel/ActionBar as separate files — kept those
  three distinct, added ClasificacionClient as the parent shell for
  cleaner state flow).
- `none` grouping mode: plan says "one partida per row". Initial
  implementation keyed on `cve_producto` which collapsed duplicates —
  fixed so every producto becomes its own partida regardless of duplicate
  content, matching the operator mental model.
- `email` route fetches the **latest** generated sheet rather than
  accepting a sheet_id. Simpler operator flow ("hit send" after
  generating). Sheet_id override can be added later.
- PDF landscape A4. Classification tables are wide — portrait truncates
  too aggressively.
