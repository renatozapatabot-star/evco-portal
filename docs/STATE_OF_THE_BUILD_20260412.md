# AGUILA · State of the Build · 2026-04-12

**Branch:** `feature/v6-phase0-phase1`
**HEAD:** `56544b7` (Block 17 — MVE monitor)
**Build gate (now):** typecheck 0 · build green · tests 258/258 passed (27 files, 1.37s)

---

## 1 · The Headline

Two weeks ago AGUILA was an EVCO-only portal with a 4-card client cockpit, no state machine, no unified search, a 180-format report problem waiting to happen, a pedimento page that ended at tab 4, and a stand-in brand identity that still read "CRUZ / ADUANA / Portal" in dozens of user-visible strings. Today, after 511 commits in 14 days, an operator can open the corridor map and see inferred-state pulses on a 2-mile window, a broker can approve a 14-tab pedimento with autosave + live validation and export an AduanaNet-shaped M3 stub, a warehouse hand can register a yard entry on mobile with photo capture, an accountant can see pendency-first cards, and a supplier can land on an AGUILA-branded mini-cockpit by token. The single biggest gap remaining is **theme and brand discipline**: 226 raw cyan hex hits still live in `src/`, 398 total legacy-brand tokens (Portal 85 + CRUZ 189 + ADUANA 124) remain across the tree, and the canonical client cockpit `/inicio` route per the V1 list does not exist as its own folder — client landings flow through `/` and `/cliente/*`. The engine works. The uniform is not yet uniform.

---

## 2 · By the Numbers

| Metric | Value | Source |
|---|---|---|
| Total commits on branch | 514 | `git log --oneline \| wc -l` |
| Commits last 14 days | 511 | `git log --since="14 days ago"` |
| TS/TSX source files | 1,036 | `find src -type f \( -name "*.ts" -o -name "*.tsx" \)` |
| Test files | 27 | `find src … -name "*.test.*"` |
| Tests passing | 258 / 258 | `npm run test` (1.37s) |
| Supabase migrations | 104 | `find supabase/migrations -name "*.sql"` |
| Block audit docs in /docs | 17 | `find docs -name "BLOCK*_AUDIT.md"` |
| `src/` size | 7.3 MB | `du -sh src/` |
| `docs/` size | 520 KB | `du -sh docs/` |
| Pages (`page.tsx`) | 141 | `find src/app -name page.tsx` |
| API route handlers | 160 | `find src/app/api -name route.ts` |
| TypeScript errors | 0 | `npm run typecheck` |
| Build | green | `npm run build` |
| **Brand drift — CRUZ** | 189 | `grep -rn "CRUZ" src/` |
| **Brand drift — ADUANA** | 124 | `grep -rn "ADUANA" src/` |
| **Brand drift — Portal** | 85 | `grep -rn "Portal" src/` |
| Brand hits — AGUILA | 173 | `grep -rn "AGUILA" src/` |
| **Raw user-visible `>Portal< / >CRUZ< / >ADUANA<`** | 2 | `grep -rn ">Portal<\|>CRUZ<\|>ADUANA<" src/app src/components` (see §5) |
| **Raw cyan hex / rgba** | 226 | `grep -rn "#00E5FF\|rgba(0,\s*229,\s*255\|rgba(34,\s*211,\s*238"` |
| State-machine events | 55 | `supabase/migrations/20260412_events_catalog.sql` (INSERT block) |
| Search entities | 12 | `src/lib/search-registry.ts` `SEARCH_ENTITIES` |
| Pedimento tab files | 15 (14 real + 1 placeholder) | `src/app/traficos/[id]/pedimento/tabs/` |
| Realtime subscriptions (`.channel(`) | 17 hits | `grep -rnE "\.channel\(\|subscribe\(\)" src/` |
| API routes referencing `company_id` | 110 | `grep -l "company_id" src/app/api -r` |
| API routes behind `verifySession\|getSession` | 123 | `grep -l …` |

The two raw JSX brand hits:

```
src/app/api/digest/route.ts:159 — <div …>ADUANA</div>         (email template header)
src/app/api/admin/onboard/route.ts:193 — <span …>Portal</span> (onboarding email header)
```

Both are inside server-rendered email HTML, not app-shell UI — still user-visible to recipients. Flag for Phase 3.

---

## 3 · The Blocks Shipped

In order by HEAD (newest first). Every row has a commit and a one-line outcome. Block audit doc column = `docs/BLOCK{N}_*_AUDIT.md` where present.

| Block | Commit | Outcome | Audit doc |
|---|---|---|---|
| 17 — MVE monitor | `56544b7` | Vercel cron + Telegram alerts + `/mve/alerts` list page | `BLOCK17_MVE_MONITOR_AUDIT.md` |
| 16 — DODA + Carta Porte + AVC | `07ab9a6` | PDF+XML generators with shared `AguilaPdfHeader` | `BLOCK16_REGULATORY_DOCS_AUDIT.md` |
| 15 — Client 12-section config | `96ede1c` | `/clientes/[id]/configuracion` autosave + completeness meter | `BLOCK15_CLIENT_CONFIG_AUDIT.md` |
| 14 — Yard/patio entry | `04494ad` | `/bodega/patio` visual grid + waiting-time color coding | `BLOCK14_YARD_ENTRY_AUDIT.md` |
| 13 — Warehouse entry (Vicente) | `9014690` | Mobile-first `/bodega/recibir` with photo + QR ready | `BLOCK13_WAREHOUSE_ENTRY_AUDIT.md` |
| 12 — Carriers catalog | `3450821` | Master catalog + `CarrierSelector` + MRU, replaces 600-option dropdown | `BLOCK12_CARRIERS_AUDIT.md` |
| 11 — PECE + 75 banks | `4b7de78` | Keyboard-nav bank picker + payment workflow | `BLOCK11_PECE_BANKS_AUDIT.md` |
| 10 — Anexo 24 export | `0e9bc27` | Export structure (placeholder, verification pending) | `BLOCK10_ANEXO_24_AUDIT.md` |
| 9 — Pedimento export | `0549f8e` | AduanaNet M3 swap-ready placeholder | `BLOCK9_PEDIMENTO_EXPORT_AUDIT.md` |
| 6c — Pedimento completion | `4b0d3a5` | Extended 10 tabs + Cronología firing + 14 validation tests | `BLOCK6C_PEDIMENTO_FULLNESS_AUDIT.md` |
| 8 — Invoice bank | `8537b7b` | Bulk upload + Claude vision classification + trafico assignment | `BLOCK8_INVOICE_BANK_AUDIT.md` |
| 7 — Corridor map | `2736a9f` | Inferred-state pulses, 2-mile window, AGUILA canonical treatment | `BLOCK7_CORRIDOR_MAP_AUDIT.md` |
| 6b — Pedimento core tabs | `c3d8dfb` | Field-blur autosave + live Validación right rail | — |
| 6a — Pedimento schema | `687c0e5` | Data schema + validation engine + `CoordinatesBadge` + shell | — |
| 5 — Classification sheet | `dde2d61` | 9×4×12 config matrix → hoja de clasificación generator | — |
| A2b cleanup — brand residue | `8ef8a4e` | Sweep remaining user-visible Portal/ADUANA/CRUZ | — |
| A2b — palette migration | `2ae804e` | Cyan/gold → silver + topographic overlay | `BLOCK5_AGUILA_REBRAND_AUDIT.md` |
| A2a — directory + symbol rename | `5d56601` | CSS swap + user-visible text | — |
| A1 — AGUILA rebrand tokens | `4ec71c3` | Design tokens + logo components + icon + manifest | — |
| 4 — Supplier doc solicitation | `c3ede6f` | Recon-aligned 50-code catalog across 9 categories | `BLOCK4_SUPPLIER_DOCS_AUDIT.md` |
| 3 — Dynamic report builder | `75f64e9` | Replaces GlobalPC 180+ static formats with engine + 8 templates | `BLOCK3_REPORT_BUILDER_AUDIT.md` |
| 2 — Unified search | `b0dccbe` | 12 entities + advanced search, kills 4-box + 9-field freeze | `BLOCK2_UNIFIED_SEARCH_AUDIT.md` |
| 1B — Tráfico detail UI | `039169f` | UI with state machine Cronología | `BLOCK1_V1_COMPLETION_AUDIT.md` |
| 1A — events_catalog | `6468432` | Catalog + legacy move + shared trafico components | — |

---

## 4 · The Blocks In Flight / Queued / Deferred

| Status | Item | Reason |
|---|---|---|
| In flight | Phase 2 — cyan sweep (226 raw hits) | This plan, commit 2 |
| In flight | Phase 3 — brand residue strip (398 total, 2 raw JSX) | This plan, commit 3 |
| In flight | Phase 4 — nav culling (141 pages → 24 V1 routes in nav) | This plan, commit 4 |
| In flight | Phase 5 — cockpit polish pass (V1 delta matrix §5) | This plan, commit 5 |
| Queued | `/inicio` canonical client cockpit route | Does not exist; currently mapped via `/` or `/cliente/*` |
| Deferred V2 | AduanaNet real M3 submission | No sandbox credentials; Block 9 ships placeholder |
| Deferred V2 | Anexo 24 sample cross-check | No reference file yet; Block 10 placeholder |
| Deferred V2 | VUCEM + SAT direct submission | External API access not yet provisioned |
| Deferred V2 | SAT XSD validation on DODA/Carta Porte/AVC XML | Block 16 generates; schemas not yet loaded |
| Deferred V2 | Internal symbol rename (`AduanaChatBubble`, `CruzMark`, …) | Cosmetic; 398 internal tokens remain, zero runtime impact |
| Deferred V2 | Network intelligence / Trade Index | Month 6+ |
| Blocked | `docs/brand/aguila-canonical-v1.png` | User to commit authoritative visual |

---

## 5 · The Architecture As It Exists Today

Shipped / partial / not-built by surface, with concrete evidence.

### State machine — **SHIPPED (55 events)**
`supabase/migrations/20260412_events_catalog.sql` — `INSERT INTO events_catalog (…) VALUES (…)` contains 55 value tuples. Cronología UI in `src/app/traficos/[id]/tabs/` reads this catalog. Trigger firing verified by Block 6c (14 tests in `src/app/traficos/[id]/pedimento/__tests__/*`).

### Search — **SHIPPED (12 entities)**
`src/lib/search-registry.ts` — `SEARCH_ENTITIES` array: `traficos, pedimentos, entradas, facturas, partidas, productos, fracciones, clientes, proveedores, operadores, documentos, ordenes_carga`. Consumed by `CommandPalette.tsx` + `/api/search/advanced`.

### Reports — **SHIPPED (dynamic engine + 8 templates)**
`src/app/reportes/ReportBuilderClient.tsx` + `src/app/api/reports/templates/`. 10-entity coverage claim from Block 3 spec. Placeholder `/reportes/legacy` route preserved.

### Document catalog — **SHIPPED (50 codes / 9 categories per Block 4)**
`supabase/migrations/20260415_doc_type_catalog.sql` — catalog table + rows. `expediente_documentos.doc_type_code` added idempotently. Legacy `document_type` + `doc_type` preserved for gradual migration.

### Classification engine — **SHIPPED (9×4×12 matrix)**
`src/app/api/classification/configs/` + `src/app/api/classification/[trafico_id]/generate/` + `/traficos/[id]/clasificacion/page.tsx` (113 lines). Per Block 5 spec.

### Pedimento — **SHIPPED (14 tabs + autosave + validation)**
`src/app/traficos/[id]/pedimento/tabs/` contains 14 implementation files (`InicioTab, DatosGeneralesTab, PartidasTab, FacturasProveedoresTab, TransportistasTab, GuiasContenedoresTab, DescargasTab, ContribucionesTab, CompensacionesTab, PagosVirtualesTab, CuentasGarantiaTab, CandadosTab, DestinatariosTab, ClienteObservacionesTab`) + `TabPlaceholder.tsx`. 24 total tsx files under the pedimento tree. Autosave + right-rail live validation confirmed by Block 6b audit. 14 validation tests added in Block 6c.

### Brand surface — **PARTIAL**
Components exist: `src/components/brand/AguilaMark.tsx`, `AguilaWordmark.tsx`, `CoordinatesBadge.tsx`. Imported in 5 places under `src/app`. **Gap:** most cockpits do not yet render the wordmark above the fold; residual legacy wordmark strings (Portal/CRUZ/ADUANA: 398 total) still in tree.

### Telemetry — **PARTIAL**
`usage_events` table exists (`20260410120000_v2a_interaction_events.sql`). Events fire via `metadata.event`. Grep for `metadata\.event\s*[=:]\s*'…'` returns **0 literal matches** — events are passed through helpers, not inline literals, so the "distinct event names" count cannot be derived from grep. The `TelemetryEvent` union is locked at 15 (per plan's follow-up note); marathon events piggyback on `metadata.event` free-form string. **Gap:** widening the union is V2.

### Multi-tenant — **SHIPPED**
110 API routes reference `company_id` (grep). 123 routes go through `verifySession`/`getSession`. Dependency flow is consistent across the 160-route surface. No grep hit for raw `'9254'` or `'EVCO'` client literals in `src/app/api/` (inspection).

### Legacy fallbacks — **SHIPPED**
`src/app/traficos/[id]/legacy/` — preserved (directory exists). `src/app/reportes/legacy/` — preserved (directory exists). Reachable by URL; not in nav.

### Real-time — **SHIPPED (partial)**
17 hits for `.channel(` or `.subscribe()` across `src/app` + `src/components`. Used on `/corredor` + notification bell (`NotificationBell` live unread). Not yet on traficos list / dashboard KPIs.

---

### V1 Route Discrepancy Matrix

Walk of all 26 V1-approved routes from the plan. Scoring criteria: **Cockpit** = 10-point test (theme, no-scroll@1440, every card actionable, wordmark present, mono-for-codes, sans-for-labels, 60/44 touch, mobile 375, es-MX, zero user-visible legacy brand). **Theme** = silver palette discipline (raw cyan hits = penalty). **Cards action** = every card has href or onClick. **Mobile** = media queries + stacked layout at 375.

Scores are from **static code inspection** — route file lines, grep hits for cyan/brand/English, presence of mobile media, action wiring. Live cockpit-at-1440 verification is Phase 5.

| Route | File | Cockpit /10 | Theme /10 | Cards action? | Mobile OK? | Specific issues |
|---|---|---|---|---|---|---|
| `/inicio` (client cockpit) | **missing** | 0 | — | — | — | Folder does not exist; client currently lands at `/` or `/cliente/*` — breaks plan's canonical list |
| `/operador/inicio` | `operador/inicio/page.tsx` (135 L) | 8 | 9 | likely | unknown | Cyan=0, brand=0, clean; needs Phase 5 1440 walk |
| `/admin/inicio` | `admin/inicio/page.tsx` (219 L) | 8 | 9 | likely | unknown | Largest inicio; cyan=0, brand=0; card-count audit needed |
| `/bodega/inicio` | `bodega/inicio/page.tsx` (112 L) | 8 | 9 | likely | yes | Block 13 mobile-first; cyan=0 |
| `/contabilidad/inicio` | `contabilidad/inicio/page.tsx` (140 L) | 8 | 9 | likely | unknown | Cyan=0, brand=0 |
| `/traficos` | `traficos/page.tsx` (551 L) | 7 | 7 | mostly | partial | **3 raw cyan hits** — needs Phase 2 sweep; list heavy |
| `/traficos/[id]` | `traficos/[id]/page.tsx` (222 L) + split components | 8 | 9 | yes | partial | Clean on brand/cyan; mobile needs walk |
| `/traficos/[id]/pedimento` | `pedimento/page.tsx` (136 L) + 14 tab files | 8 | 9 | yes | unknown | 14 tabs shipped; no-scroll@1440 per tab not verified |
| `/traficos/[id]/pedimento/exportar` | 99 L | 7 | 9 | yes | unknown | Placeholder export; polish unchecked |
| `/traficos/[id]/pedimento/pago-pece` | 108 L | 7 | 9 | yes | unknown | Block 11 shipped; 1440/375 walk pending |
| `/traficos/[id]/clasificacion` | 113 L | 7 | 9 | yes | unknown | Block 5; polish pending |
| `/traficos/[id]/doda` | 70 L | 6 | 9 | unknown | unknown | Block 16 thin page, mostly generator invocation |
| `/traficos/[id]/carta-porte` | 64 L | 6 | 9 | unknown | unknown | Same as DODA |
| `/clientes/[id]` | 359 L | 8 | 9 | likely | unknown | Cyan=0 brand=0; card-count review |
| `/clientes/[id]/configuracion` | 150 L | 8 | 9 | yes | unknown | Block 15 autosave; 12-section editor polish pending |
| `/reportes` | 16 L (delegates to client) | 7 | 9 | yes | unknown | Thin shell; ReportBuilderClient does the work |
| `/reportes/anexo-24` | 61 L | 6 | 9 | unknown | unknown | Placeholder; Block 10 |
| `/banco-facturas` | 23 L | 6 | 9 | unknown | unknown | Very thin shell; client component carries UX |
| `/corredor` | 51 L | 8 | 9 | yes | unknown | Block 7 inferred-state pulses; mobile check pending |
| `/mve/alerts` | 339 L | 8 | 9 | yes | partial | Block 17; list heavy |
| `/admin/carriers` | 48 L | 6 | 9 | unknown | unknown | Block 12 catalog; shell is thin |
| `/bodega/recibir` | 16 L | 6 | 9 | unknown | yes | Block 13 mobile-first; shell thin |
| `/bodega/patio` | 16 L | 6 | 9 | unknown | partial | Block 14 grid lives in client component |
| `/bodega/[id]/avc` | 67 L | 6 | 9 | unknown | unknown | Block 16 AVC generator |
| `/login` | `login/page.tsx` (504 L) | 6 | **5** | yes | yes | **12 raw cyan hits** — login still wears cyan |
| `/proveedor/[token]` | `proveedor/[token]/page.tsx` (1,178 L) | 7 | **5** | yes | yes | **12 raw cyan hits** — supplier mini-cockpit still wears cyan, despite A2b |

**Routes scoring < 7 on Cockpit:** `/inicio` (0, missing), `/traficos/[id]/doda` (6), `/traficos/[id]/carta-porte` (6), `/reportes/anexo-24` (6), `/banco-facturas` (6), `/admin/carriers` (6), `/bodega/recibir` (6), `/bodega/patio` (6), `/bodega/[id]/avc` (6), `/login` (6). **10 routes.** Most "6"s are thin shells that delegate to client components not inspected by this grep pass — their real score lands after Phase 5's live walk.

**Routes scoring < 7 on Theme:** `/login` (5), `/proveedor/[token]` (5). Both have 12 raw cyan hits each; combined they account for 24 of the 226 cyan violations — ~11% of the tree's cyan debt in two files.

---

## 6 · What an Operator Can Actually Do Today

**Monday 7:30 AM.** Tito opens `/admin/inicio` on desktop at 1440×900. He sees the pipeline-stage banner, a drill-through card per stage, the escalation banner (Block P2.3), and the shadow-dashboard card. ✅ AGUILA. He clicks into `/traficos` to scan active shipments.

**7:45 AM.** He opens a specific tráfico: `/traficos/[id]`. Right rail shows comments, left column the Cronología reading `events_catalog` with 55 possible state transitions. He adds a note via `trafico_notes` (Block 1b). ✅ AGUILA.

**8:00 AM.** He clicks "Pedimento" → `/traficos/[id]/pedimento`. 14 tabs render. He edits a partida; field-blur autosave writes; right-rail Validación updates. ✅ AGUILA.

**8:30 AM.** Export pedimento → `/traficos/[id]/pedimento/exportar`. Gets M3-shaped file. ⚠️ AduanaNet submission is placeholder — the real submit is **still in AduanaNet**.

**9:00 AM.** Operator Eloísa opens `/operador/inicio`, sees her 8-card workspace (RoleKPIBanner + action cards). She clicks "Banco de facturas" → `/banco-facturas` → bulk uploads 30 invoice PDFs; Claude vision classifies; she assigns them to a tráfico. ✅ AGUILA.

**10:00 AM.** A supplier emails invoices late. Eloísa requests docs via the Block 5 composer; system emits `workflow_events` + Resend email. ✅ AGUILA.

**11:00 AM.** Vicente (warehouse) receives a truck. Opens `/bodega/recibir` on phone. Photos + QR entry registered. ✅ AGUILA.

**12:00 PM.** Anabel (contabilidad) opens `/contabilidad/inicio` → pendency-first cards. ✅ AGUILA.

**1:00 PM.** Carrier-porte doc needed. Generated via `/traficos/[id]/carta-porte` (Block 16 shared `AguilaPdfHeader`). ✅ AGUILA generates PDF+XML. ⚠️ XSD validation against SAT schema not yet run.

**3:00 PM.** Client EVCO plant manager logs in. Lands on `/` or `/cliente/*` (the plan's canonical `/inicio` **does not exist as a folder**). ⚠️ Needs polish — route plan mismatch.

**4:00 PM.** Corridor check → `/corredor`. Inferred-state pulses with 2-mile window. ✅ AGUILA (Block 7).

**5:00 PM.** MVE monitor has fired Telegram alerts; Tito reviews at `/mve/alerts`. ✅ AGUILA (Block 17).

**End of day.** Anexo 24 pull from `/reportes/anexo-24`. ⚠️ Structure is in place; output has not been compared to a real SAT sample. Final reconciliation → e-conta, which is **still the legacy path**.

**Annotated gap summary:** real AduanaNet submission, real SAT Anexo 24 round-trip, real VUCEM submission, real e-conta posting — these all still require the legacy tools. The AGUILA side produces the exports; the external leg is not wired.

---

## 7 · What Still Requires Legacy Tools

| Workflow | Legacy tool | Block that would close gap | Complexity |
|---|---|---|---|
| Pedimento submission | AduanaNet M3 | Block 9 → real M3 swap | Medium — needs credentials + sandbox |
| Anexo 24 SAT round-trip | SAT portal | Block 10 → XSD + signed POST | High — cert + XSD compliance |
| Carta Porte 3.1 fiscal stamp | PAC (Solución Factible / similar) | Block 16 follow-up — PAC integration | Medium-High |
| VUCEM customs uploads | VUCEM direct | Not blocked yet | High — IMMEX / FIEL |
| E-conta posting | e-conta tool | Block 23 (not scheduled) | Medium |
| Morning email from Tito to clients | Manual + Gmail | Block 8 Tito daily briefing exists; client-side not shipped | Low |
| Real operator ranking | — | V2 ML on usage_events | Low-Medium |

---

## 8 · Recon Coverage

Parity audit vs `docs/recon/` expectation from the GlobalPC recon docs, based on block audit papers and shipped file counts.

| GlobalPC feature | Status | Evidence |
|---|---|---|
| Tráfico list + detail | Shipped | `/traficos`, `/traficos/[id]` |
| Pedimento editor (all tabs) | Shipped (14/14) | `src/app/traficos/[id]/pedimento/tabs/` |
| Hoja de clasificación | Shipped | Block 5 — 9×4×12 matrix + page |
| 180+ static report formats | Replaced by dynamic builder + 8 templates | Block 3 |
| 4-box search + 9-field advanced | Replaced by unified 12-entity palette | Block 2 |
| 600-option carrier dropdown | Replaced by catalog + MRU | Block 12 |
| 75-bank PECE picker | Shipped | Block 11 |
| Document type catalog (50 codes) | Shipped | `20260415_doc_type_catalog.sql` + Block 4 |
| Anexo 24 export | Placeholder (structure only) | Block 10 — deferred V2 for real comparison |
| DODA + Carta Porte + AVC generators | Shipped (PDF+XML) | Block 16 |
| MVE monitor | Shipped | Block 17 — cron + Telegram |
| Corredor / corridor map | Shipped | Block 7 |
| Invoice bank (banco de facturas) | Shipped | Block 8 |
| Warehouse entry + yard | Shipped | Blocks 13 + 14 |
| Client 12-section config | Shipped | Block 15 |
| Comments / @mentions | Shipped | P3 Block 7 |
| Notifications / bell | Shipped (Realtime) | V1-polish Block 6 |
| 33 cron jobs (legacy claim) | Partial | Vercel crons + PM2 (warehouse/Throne) — count not verified this pass |
| Shadow classification dashboard | Shipped | V1-polish Block 12 |

---

## 9 · Production-Discipline Scorecard (/100)

Ten metrics. Honest, not generous. Justification per row.

| # | Metric | Score | Justification |
|---|---|---|---|
| 1 | TypeScript strict — zero errors | 10 | `npm run typecheck` clean |
| 2 | Build succeeds | 10 | `npm run build` green |
| 3 | Test coverage (count + speed) | 7 | 258 passing in 1.37s is fast, but 27 test files vs 1,036 source files ≈ 2.6% — `lib/` coverage fine, route/RLS coverage light |
| 4 | Brand discipline | **4** | 85 Portal + 189 CRUZ + 124 ADUANA = 398 legacy tokens still in tree. 2 raw JSX hits in email templates. Phase 3 fixes user-visible; internal rename is V2 |
| 5 | Theme discipline (palette) | **4** | 226 raw cyan hits across 1,036 files. Login (12) and supplier (12) alone carry 24 of them |
| 6 | Multi-tenant safety | 9 | 110 API routes use `company_id`; 123 use session verification; zero raw `'9254'` literals found in `src/app/api` spot-check |
| 7 | Migration hygiene | 9 | 104 migrations, RLS convention per recon; idempotent ADD COLUMN patterns present in Block 4 migration |
| 8 | Observability / telemetry | 6 | `usage_events` table + `metadata.event` pattern shipped, but `TelemetryEvent` union locked at 15 and marathon events ride free-form strings; no distinct-event count derivable from grep |
| 9 | Legacy preservation | 9 | `/traficos/[id]/legacy` + `/reportes/legacy` present; no data lost during UI refresh |
| 10 | Documentation / audit trail | 8 | 17 BLOCK_*_AUDIT.md files + this doc; no consolidated pre-this-commit state doc existed |

**Total: 76 / 100.** Reliability + build hygiene are strong. Brand + theme are the drag — exactly the debt Phases 2-5 of this plan exist to pay down.

---

## 10 · Strategic-Alignment Scorecard (/80)

Eight dimensions, 1-10 each.

| # | Dimension | Score | Reasoning |
|---|---|---|---|
| 1 | Replaces GlobalPC parity items | 9 | Search, reports, carriers, banks, pedimento, MVE, classification, doc catalog all shipped |
| 2 | SAT / AduanaNet submission reach | 4 | All submission legs are placeholders — external APIs not wired |
| 3 | Operator daily-use readiness | 8 | Operator can run a Monday inside AGUILA except for external submissions |
| 4 | Client self-serve readiness | 6 | Client landing route mismatch (`/inicio` missing); cockpit exists elsewhere |
| 5 | Warehouse readiness (Vicente) | 8 | Mobile-first entry + yard grid shipped; polish gaps small |
| 6 | Accounting readiness (Anabel) | 7 | Cockpit + pendency cards shipped; e-conta export deferred |
| 7 | Multi-tenant readiness (MAFESA+) | 8 | `company_id` enforcement pervasive; supplier token flow AGUILA-branded |
| 8 | Brand maturity | 5 | Components exist, tokens locked, but 398 legacy tokens + 226 cyan hits argue otherwise |

**Total: 55 / 80.** The reach is real but the uniform is not yet uniform.

---

## 11 · The Risks

1. **Client `/inicio` route mismatch.** The plan's V1-approved list names `/inicio` as the client cockpit. That folder does not exist. Client traffic currently resolves through `/` or `/cliente/*`. If a client is shown the plan and asked to navigate to `/inicio`, they hit a 404 (or middleware redirect, if one exists). **Mitigation:** Phase 5 either creates the folder or amends the plan to the actual canonical route.
2. **Theme drift visible on login + supplier.** 24 of the 226 cyan hits live in the two most externally-visible surfaces (`/login`, `/proveedor/[token]`). First-impression surfaces still look pre-AGUILA. **Mitigation:** Phase 2 cyan sweep — these two files are #1 priority.
3. **Email headers still say ADUANA / Portal.** `src/app/api/digest/route.ts:159` and `src/app/api/admin/onboard/route.ts:193`. Every digest + onboarding email sent from AGUILA today carries the wrong brand. **Mitigation:** Phase 3 must include server-rendered email HTML.
4. **Telemetry union locked at 15.** Marathon events ride `metadata.event` as free-form strings — invisible to typed consumers and un-aggregatable without string parsing. **Mitigation:** V2 widening block; for V1 accept the gap and document it.
5. **External submission deferrals.** AduanaNet M3, Anexo 24 SAT round-trip, Carta Porte PAC stamp, VUCEM — all placeholders. Operator still depends on legacy tools for the final mile. **Mitigation:** V2 priority; for V1 document the boundary and make the export artefacts portable.

---

## 12 · The Next 3 Blocks

This plan's Phase 2 → 3 → 4 → 5 chain, in that order:

1. **Phase 2 — cyan sweep.** Replace 226 raw hex hits with silver tokens from `src/lib/design-system.ts`. Priority targets: `/login` (12), `/proveedor/[token]` (12), `/traficos` (3).
2. **Phase 3 — brand residue strip.** Target the 2 raw JSX hits (digest + onboard email headers) + any user-visible strings the grep matrix surfaces. Leave internal symbol names (`AduanaChatBubble`, `CruzMark`) for V2 hygiene block.
3. **Phase 4 — nav culling.** Hide the 117 non-V1 pages (141 total minus the 24 approved) from sidebar + command palette per role. Routes stay reachable by URL.

Phase 5 (cockpit polish pass) comes next but depends on all three above + surfaces the delta matrix's specific fixes.

---

## 13 · The Rating

**Current: 7.0 / 10.**

The engine is there: 55-event state machine, 14-tab pedimento with autosave + live validation, 12-entity unified search, dynamic report builder, corridor map with inferred pulses, MVE monitor, warehouse + contabilidad + supplier cockpits, 258 tests green, 104 migrations. That's a 9/10 foundation.

The uniform is not: 226 raw cyan hits, 398 residual legacy-brand tokens, `/inicio` missing from the canonical route map, email templates still branded ADUANA/Portal, and two highest-visibility surfaces (`/login`, `/proveedor/[token]`) carrying the most cyan debt. That pulls the number down hard.

**To reach 7.5:** Phase 2 (cyan ≤ 10 hits, all explicitly allow-listed) + Phase 3 (zero user-visible legacy brand including email headers).
**To reach 8.0:** Add Phase 4 (nav culling) + fix the `/inicio` route mismatch + wordmark visible on all 5 cockpits above the fold.
**To reach 9.0:** Phase 5 cockpit polish passes on all 24 V1 routes + Monday smoke test on 1440 + 375 by Renato IV + Tito sign-off.
**To reach 10.0:** First real email-to-clearance runs end-to-end through AGUILA with external submission legs live, not placeholders. That's V1.5 / V2 territory.

---

## 14 · Closing

The eagle flies — it just doesn't yet wear a clean uniform.

---

## Appendix — Verification Output

```
$ git log --oneline | wc -l
514

$ git log --since="14 days ago" --oneline | wc -l
511

$ find src -type f \( -name "*.ts" -o -name "*.tsx" \) | wc -l
1036

$ find src -type f \( -name "*.test.ts" -o -name "*.test.tsx" \) | wc -l
27

$ find supabase/migrations -name "*.sql" | wc -l
104

$ find docs -name "BLOCK*_AUDIT.md" | wc -l
17

$ du -sh src/ docs/
7.3M  src/
520K  docs/

$ npm run typecheck
> tsc --noEmit
(clean)

$ npm run test
Test Files  27 passed (27)
     Tests  258 passed (258)
  Duration  1.37s

$ npm run build
(green; Next.js route manifest includes all 141 pages + 160 API routes)

$ grep -rn "Portal" src/ | wc -l
85
$ grep -rn "CRUZ"   src/ | wc -l
189
$ grep -rn "ADUANA" src/ | wc -l
124
$ grep -rn "AGUILA" src/ | wc -l
173

$ grep -rn "#00E5FF\|rgba(0,\s*229,\s*255\|rgba(34,\s*211,\s*238" src/ --include="*.ts" --include="*.tsx" --include="*.css" | wc -l
226

$ grep -rn ">Portal<\|>CRUZ<\|>ADUANA<" src/app src/components
src/app/api/digest/route.ts:159:    <div style="…">ADUANA</div>
src/app/api/admin/onboard/route.ts:193:    <span style="…">Portal</span>
```

---

*Doc written 2026-04-12. Evidence gathered from HEAD `56544b7` on branch `feature/v6-phase0-phase1`. No source changes in this commit.*
