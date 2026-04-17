# Anexo 24 as Canonical Reference — 10/10 Plan

**Status:** Draft for Renato IV + Tito approval
**Date:** 2026-04-18 (Saturday)
**Scope:** Promote Anexo 24 to primary nav tile; make it the canonical product reference across CRUZ.
**Blocking:** Core-invariant #29 change (nav tiles are Tito-locked) — needs explicit sign-off.

---

## Context — why this matters

Anexo 24 (Formato 53 export from GlobalPC.net) is the **SAT audit truth
document** for every IMMEX client. It is the one document customs inspects
if they ever ask "what are you importing, by part, with what fraction?"

Today, CRUZ treats Anexo 24 as **one of several reports** under `/reportes`.
The merchandise name Ursula sees on a pedimento line, a catalog row, or
an entrada is whatever `globalpc_partidas.descripcion` happens to say —
which drifts across sync cycles and free-text fields. When the SAT
pulls EVCO's Anexo 24 and compares it to our pedimento-line data, those
have to match exactly. Right now they don't always.

**The flip:**
- Anexo 24 becomes nav tile #6 (replacing generic "Reportes")
- The Formato 53 PDF is prominent, one-click download
- Every merchandise name, part number, and fracción rendered anywhere in
  CRUZ reads from a canonical **Anexo 24 reference** first, fallback to
  current sources second
- The SKU detail drill-down from Anexo 24 links to every related document:
  pedimentos, invoices, OCAs, certificates, entradas, classifications

**The outcome** — Ursula's cockpit and Tito's audit defense both read
from the same truth file. Anexo 24 is no longer a "report you generate";
it's the product's spine.

---

## Phases

Three phases, each independently shippable. Phase 1 is the Monday demo
move; Phase 3 is Marathon 3 territory (multi-week data-architecture
shift). The plan commits to all three; sequence depends on Ursula-ship
priorities.

### Phase 1 — Surface flip (pre-Monday, ~4–6 hours)

Goal: Ursula opens the portal Monday, taps tile #6, lands on a
first-class Anexo 24 surface that shows her every SKU and links her
to the Formato 53 PDF. Tito's pedimento defense lands one tap from
the home screen.

**1.1 Nav tile update**
- `src/lib/cockpit/nav-tiles.ts`: rename `reportes` key → `anexo24`,
  label "Anexo 24", icon `ClipboardList` (or `FileText`), description
  "Control de inventario IMMEX", href `/anexo-24`.
- Core-invariant #29 doc bumped — "Reportes" → "Anexo 24" in the
  locked six. Commit note records Tito + Renato IV sign-off.
- Back-compat redirect: `/reportes` → `/anexo-24` (server-side
  `redirect()` with 308). Existing in-page links and email deep-links
  continue working.
- Mobile bottom-nav CRUZ-center tab unchanged (Anexo 24 doesn't live
  there).

**1.2 New `/anexo-24` primary surface**
- Header: Patente 3596 · Aduana 240 · Client name · **Formato 53 PDF
  download button** (prominent, gold CTA).
- Last-synced timestamp: "Última actualización: hace N horas" from
  `globalpc_productos.fraccion_classified_at` MAX for the client.
- KPI strip (6 tiles, reuses `ReportesKpiStrip` pattern but Anexo-24
  focused):
  1. **SKUs totales** — globalpc_productos count
  2. **Clasificados** — `fraccion IS NOT NULL` count + %
  3. **T-MEC eligibles** — `preferential_rate_tmec = 0` count + %
  4. **Valor YTD importado** — SUM(valor_comercial) this year
  5. **Fracciones únicas** — DISTINCT fraccion count
  6. **Proveedores activos** — DISTINCT cve_proveedor last 12mo

**1.3 SKU table (the full catalog, Anexo-24 framed)**
- Columns: Número de parte, Descripción, Fracción, País, UMT, Veces
  importado (12mo), Último movimiento, Acciones (→ detail).
- Sorted by usage desc, deterministic tiebreaker on cve_producto asc
  (same pattern as Saturday catalogo stabilization commit).
- Search: part number / descripción / fracción / proveedor.
- Filter: fracción prefix, T-MEC eligibility, last-used window.
- Server render, 100 rows/page, virtualized on large tenants.

**1.4 Sub-reports moved under /anexo-24 as secondary nav**
- Consolidación, Multi-cliente, Reportes personalizados become
  drop-down or tab within /anexo-24 surface.
- `/reportes/:any` existing routes stay alive (back-compat).
- Secondary "Más reportes" link in /anexo-24 footer surfaces them.

**1.5 Formato 53 PDF source wiring**
- Current `/api/reports/anexo-24/generate/route.ts` already produces a
  PDF from `globalpc_productos`. **Keep using it for Phase 1.** The
  AMBER warning banner ("pendiente verificación") goes away only when
  Phase 3 lands the real Formato 53 ingestion.
- Anexo 24 page shows a "Descargar Formato 53 (XLSX + PDF)" primary
  action. Same endpoint, new prominence.

**1.6 Internal cockpit parity**
- `/operador/inicio` and `/admin/eagle` nav grids update — same
  constant import means this is automatic once 1.1 lands.

**Verification:**
- All three cockpits render "Anexo 24" in slot 6 with correct count
- Tap on desktop + mobile opens `/anexo-24`
- `/reportes` 308-redirects to `/anexo-24`
- Formato 53 PDF download works end-to-end (evco2026 session)
- Chrome audit on mobile 393×852

**Rollback:** Single git revert brings tile back to Reportes; all
sub-routes were left alive for back-compat.

---

### Phase 2 — Anexo 24 as product (Week 1–2 post-Ursula, ~10–15 hours)

Goal: Anexo 24 is a navigable, searchable, exportable product — the
SKU library for every client.

**2.1 SKU detail page `/anexo-24/[cve_producto]`**
- Hero: part number · descripción · fracción · T-MEC tag
- 5 tabs:
  1. **Resumen** — what this SKU is (official name, fraction, UMT,
     origin, current duty rate, last-imported value)
  2. **Historial** — every pedimento line + entrada + invoice that
     references this part. Chronological, with drill-down to each doc.
  3. **Proveedores** — top 5 proveedores (uses, avg price, last use)
     — reuses the helper we already built at
     `src/app/api/catalogo/partes/[cveProducto]/route.ts`
  4. **Documentos** — every CRUZ doc that references this part:
     pedimento PDFs, invoices, OCAs, certificates, classification
     sheets. Each linked with timestamp + actor.
  5. **Clasificación** — OCA opinion (if any), Qwen classification
     confidence, SuperTito review status

**2.2 Documents hub (the "this is the most important doc" move)**
- Section on `/anexo-24` main page: "Docs vinculados este mes"
- Reverse index — given an Anexo 24 part, what documents exist?
- Hydrates from: `traficos`, `globalpc_partidas`, `oca_opinions`,
  `usmca_certificates`, `pedimento_exports` bucket.

**2.3 Exports**
- **Formato 53 XLSX** — matches GlobalPC.net's export column-for-column
- **Anexo 24 PDF** — SAT-ready format
- **CSV** — for client's own accounting
- **Diff report** — "what changed vs last month" (useful for Ursula's
  month-end)

**2.4 Search + reconciliation**
- Global search (nav top search) gains an "Anexo 24" result type
- Opens directly to `/anexo-24/[cve_producto]`

**Verification:**
- Unit tests on reconciliation query helpers
- E2E: search for "POLYPROPYLENE BEADS" → lands on the right part
  detail with full history
- Performance: part detail loads < 600ms server-side

---

### Phase 3 — Canonical reference propagation (Marathon 3, ~2–3 weeks)

Goal: the merch name, part number, and fraction that CRUZ shows
anywhere **is** the Anexo 24 truth. No free-text drift.

**3.1 Ingest Formato 53 from GlobalPC.net**
- `scripts/wsdl-document-pull.js` already exists; activate it in PM2 cron
  (nightly 2 AM, after globalpc-sync).
- New table: `anexo24_parts` with columns:
  - `company_id`, `cve_producto` (PK composite)
  - `merchandise_name_official`, `fraccion_official`, `umt_official`,
    `pais_origen_official`, `valor_unitario_official`
  - `vigente_desde`, `vigente_hasta` (NULL = current)
  - `source_document_url` (Supabase storage reference)
  - `ingested_at`, `ingested_by` (system | operator)
- Versioned rows — every Formato 53 pull creates new rows, old ones
  get `vigente_hasta` stamped.
- RLS: `FOR ALL USING (false)`, service role reads only (matches
  existing parts table pattern — see
  `feedback_rls_policy_pattern.md`).

**3.2 Backfill existing globalpc_productos**
- One-time migration: for every (company_id, cve_producto), pull the
  most-recent Formato 53 row and populate new `anexo24_*` columns on
  `globalpc_productos`.
- 315K rows × 30 clients max = ~10M rows — chunked, throttled, logged.
- Reconciliation guard: after backfill, compare `globalpc_productos.
  descripcion` to `anexo24.merchandise_name_official`. Log drift
  count per client to `regression_guard_log`.

**3.3 Canonical-name helper**
New `src/lib/reference/anexo24.ts`:
```ts
resolveMerchName(part: { anexo24_name?, descripcion?, cve_producto }): string
resolveFraction (part: { anexo24_fraccion?, fraccion?, cve_producto }): string
resolvePartNumber(part: { anexo24_number?, cve_producto }): string
```
Every consumer that currently reads `globalpc_productos.descripcion` /
`globalpc_partidas.descripcion` / `fraccion_arancelaria` gets piped
through these helpers.

**3.4 Read-site migration (surgical)**
Priority read sites to migrate:
1. `/catalogo` list + search
2. `/catalogo/fraccion/[code]` variants
3. `/catalogo/partes/[cveProducto]` detail
4. `/pedimentos` list (descripcion column)
5. `/entradas` list
6. `/embarques/[id]` line items
7. `/api/pedimento-pdf/generate` (PDF output)
8. `/api/reports/anexo-24/generate` (becomes trivial — already uses the
   authoritative source)
9. CRUZ AI tool `query_product` / `search_partidas`
10. Global search `/api/search`

Each migration is a small commit: read site → helper. Backwards
compatible until all sites converted, then the `descripcion` fallback
can be removed.

**3.5 Drift alerts**
- Nightly job: for each client, compute Anexo 24 vs partidas-description
  drift ratio. If > 2%, Telegram alert.
- Monthly report: top 10 drifted parts per client (Renato fixes at
  source in GlobalPC.net, or we open a ticket to Mario).

**3.6 Admin tools**
- `/admin/anexo-24/reconcile` — broker-only. Shows drift table per
  client, one-tap "accept Anexo 24 truth" button (updates
  globalpc_productos.descripcion to match, logs decision).

**Verification:**
- RLS tests: non-admin cannot read other clients' anexo24_parts
- Backfill replay test on staging first (one client)
- Chrome audit on all 10 read sites — verify names read from canonical
- Telegram drift alert fires on staging with synthetic drift

**Rollback plan:**
- Helper has a feature flag: `USE_ANEXO24_CANONICAL=true|false`
- If Phase 3 surfaces issues mid-migration, flip the flag and consumers
  fall back to `globalpc_productos.descripcion` immediately.

---

## Cross-phase dependencies

| Dependency | Phase | Status |
|---|---|---|
| Tito + Renato IV sign-off on invariant #29 | 1 | **BLOCKING** — needs explicit approval |
| GlobalPC.net Formato 53 XLSX/PDF export format | 1 | Known (CLAUDE.md memory: reference_formato53_source) |
| WSDL pull infrastructure | 3 | Script exists (`wsdl-document-pull.js`), not in cron |
| New client onboarding requires Formato 53 before activation | 3 | Documented (not enforced yet) |
| PM2 process on Throne for nightly ingest | 3 | PM2 in use; new process needs `pm2 save` |
| Supabase RLS migration for `anexo24_parts` | 3 | Follows parts-table pattern |

---

## Pre-Monday ship recommendation

**Ship Phase 1 only** (4–6 hours Saturday evening + Sunday morning).

Rationale:
- Nav flip + new surface is high-visibility, low-risk
- Formato 53 PDF download uses existing generator — no new
  infrastructure
- Ursula gets the headline ("Anexo 24 is the hero of the product")
  without CRUZ promising data accuracy we haven't verified yet
- Phase 2 + 3 land post-Ursula when we have time to test data-layer
  changes thoroughly

**Defer Phase 2 + 3 to post-Ursula** — they're genuine architectural
shifts that deserve testing budget. Ursula sees the surface; we earn
the data-layer promise by delivering it correctly next month.

---

## Minimum Phase 1 acceptance criteria

- [ ] `/anexo-24` route renders for `role === 'client'` session
- [ ] Nav tile #6 reads "Anexo 24" on `/inicio`, `/operador/inicio`,
      `/admin/eagle`
- [ ] Formato 53 download button produces a valid PDF for EVCO in < 10s
- [ ] SKU table renders ≤ 600ms for EVCO (693 active-use parts out of
      148K total — most-used sort keeps first page live)
- [ ] Mobile viewport (393×852) — all content readable, tap targets
      ≥ 60px, search works via on-screen keyboard
- [ ] `/reportes` redirects (308) to `/anexo-24`
- [ ] Core-invariant #29 documentation updated (with sign-off note)
- [ ] Zero regressions on Friday + Saturday polish deploys
- [ ] Chrome audit pass on desktop + iPhone

---

## Open decisions (need Renato IV input)

1. **Which icon?** `ClipboardList` (suggests inventory) or `FileText`
   (suggests document). Recommendation: `ClipboardList` — Anexo 24 is
   an inventory control doc, not a PDF.

2. **Nav tile count?** Anexo 24's count on the home screen — total
   SKUs (big number, feels like power) or this-month active SKUs
   (matches invariant #24 "live metric in microStatus")?
   Recommendation: this-month used SKUs (matches invariant), total
   as historicMicrocopy.

3. **Formato 53 download — in-page or new tab?** New tab
   (`target="_blank"`) for PDFs is standard. In-page might feel like
   an app. Recommendation: new tab.

4. **Sub-reports — fold into Anexo 24 tabs, or keep `/reportes`
   accessible?** Folding is cleaner; keeping back-compat is safer.
   Recommendation: keep `/reportes` alive (308 redirect only on the
   root route), fold the sub-reports visibly under Anexo 24 as
   secondary nav.

5. **Phase 3 ingest cadence — nightly or hourly?** Formato 53 doesn't
   change hourly in practice; nightly is cheaper and sufficient.
   Recommendation: nightly at 2:15 AM CST (after globalpc-sync 2 AM).

---

## Proposed commit cadence

**Pre-Monday (Phase 1):**
1. `feat(nav): promote Anexo 24 to tile #6 (replaces Reportes)` — nav tile + invariant #29 doc update
2. `feat(anexo-24): primary surface + KPI strip + SKU table` — /anexo-24 page
3. `feat(anexo-24): Formato 53 download + back-compat redirect` — wiring + /reportes redirect
4. `chore(anexo-24): verification + screenshot battery + report` — QA bundle

**Post-Ursula (Phase 2):**
5–10. SKU detail page, documents hub, exports, search integration

**Marathon 3 (Phase 3):**
11+. Formato 53 ingest, anexo24_parts table, backfill, canonical helper, read-site migration (one PR per read site)

---

## Decision needed before execution

**From Renato IV:**
- Approve Phase 1 scope for Monday ship? (Y/N)
- Tito sign-off on invariant #29 change (nav tile label)? (confirmed Y / need to ask)
- Answers to the 5 open decisions above

**Once approved:**
- Phase 1 implementation kicks off immediately
- Target: deploy Sunday midday, Ursula walkthrough Sunday PM, Monday ship
