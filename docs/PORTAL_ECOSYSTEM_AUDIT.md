# Portal Ecosystem Audit

## Phase 1 — Brand strip + Client 8-card

### Commit 1 — `feat(brand): strip ADUANA/CRUZ from all user-visible surfaces → Portal`

**SHA:** `16c1dd1`
**Files changed:** 18
**Line delta:** +30 / -30

**Surfaces rewritten:**

| File | Change |
|---|---|
| `src/app/layout.tsx` | `metadata.title`, `openGraph.title`, `openGraph.siteName`, `apple-mobile-web-app-title` |
| `public/manifest.json` | `name`, `short_name` |
| `public/icon.svg` | Wordmark regenerated with "Portal" — keeps gold `#C4963C`. Flagged for Renato to replace with proper logo asset when ready. |
| `public/sw.js` | Push notification default title + tag |
| `src/components/cruz/TopBar.tsx` | aria-label + `.topbar-logo-text` |
| `src/components/cruz/Sidebar.tsx` | `.sidebar-logo-text` |
| `src/app/login/page.tsx` | `.login-watermark` + `.login-cruz-wordmark` |
| `src/app/signup/page.tsx` | Brand lockup next to `AduanaMark` |
| `src/app/signup/pending/page.tsx` | Brand lockup |
| `src/lib/greeting.ts` | Dropped `— ADUANA está listo` from `getGreeting()` + `getSmartGreeting()` madrugada branch |
| `src/components/cockpit/admin/CruzAutonomoPanel.tsx` | Header → "Pipeline Autónomo" |
| `src/components/god-view/CruzAutonomo.tsx` | Both error + header → "Pipeline Autónomo" |
| `src/components/cruz-chat-bubble.tsx` | Bubble label (`CRUZ`), aria-label, top-bar label (`ADUANA AI`) → "Asistente Portal" |
| `src/app/admin/actions.ts` | `FROM_EMAIL` → dropped product brand |
| `src/app/operador/cola/actions.ts` | Inline Resend `from` → dropped product brand |
| `scripts/solicitud-email.js` | `FROM_EMAIL` |
| `scripts/document-wrangler.js` | `FROM_EMAIL` |
| `scripts/tito-daily-briefing.js` | Email header wordmark → "Portal" |

### Commit 2 — `feat(client): 8-card client cockpit — remove Solicitar Embarque/Clasificar Producto/Ahorro, rename Tráficos Recientes → Catálogo`

**SHA:** `0da2e01`
**Files changed:** 1
**Line delta:** +1 / -5

**Changes in `src/components/client/ClientHome.tsx`:**

- Removed 3 tiles from `TILES[]`: `Solicitar Embarque` (`/solicitar`), `Clasificar Producto` (`/clasificar-producto`), `Ahorro` (`/ahorro`)
- Renamed tile 4: `Tráficos Recientes` → `Catálogo` (href/description/icon preserved)
- Removed unused `lucide-react` imports: `Ship`, `Tags`, `DollarSign`
- Array goes from 11 → 8 entries
- Layout untouched — `nav-cards-grid` is still `repeat(2, 1fr)`, so 8 tiles render in a 4×2 grid alongside the right rail (intelligence + activity feed)

**Removed pages left in codebase** (not linked from client home): `/solicitar`, `/clasificar-producto`, `/ahorro`.

### Before/After ADUANA|CRUZ grep counts

```
grep -rn "ADUANA\|CRUZ" src/app src/components public  (excl node_modules)
```

| State | Total hits |
|---|---|
| Before Phase 1 | 272 |
| After Phase 1 | 247 |
| Delta | -25 |

Residual 247 hits are mostly:

- Internal symbol names (`AduanaLayout`, `CruzMark`, `CruzAutonomo`, `src/components/cruz/*`, `src/app/cruz/`, `AduanaChatBubble`, `useCruz*`, chat state keys like `cruz-chat-history`) — these don't render to users
- CSS class hooks: `.aduana-dark`, `.aduana-topbar`, `.aduana-sidebar`
- Internal event names: `cruz:open-chat`, `cruz:open-search`
- Code comments + CSS variable names
- A handful of marketing/demo pages still containing user-visible "CRUZ"/"ADUANA" text (`/demo`, `/resultados`, `/inteligencia`, `/voz`, `/bienvenida`, `/onboarding`, `/track`, `/proveedor`, `/upload`, `/share`, `/mis-reglas`, `/calls`, `/comunicaciones`, `/cruz`). These weren't listed in the Phase 1 plan table — they belong to Phase 2 or a wider brand sweep pass.

### Queued for follow-up (internal symbol rename commit, post-Phase 1)

- `AduanaLayout`, `CruzLayout` components
- `CruzMark` / `AduanaMark` component
- `CruzAutonomoPanel`, `CruzAutonomo` (rename files + exports)
- `src/components/cruz/` directory
- `AduanaChatBubble` component name
- Chat localStorage keys: `cruz-chat-history`, `cruz-chat-company`
- Custom event names: `cruz:open-chat`, `cruz:open-search`
- CSS classes: `.aduana-dark`, `.aduana-topbar`, `.aduana-sidebar`, `.login-cruz-wordmark`
- Service worker cache name: `cruz-v2`
- `sessionStorage` flag: `cruz_just_entered`

### Client cockpit verification

8 tiles in `TILES[]` array (verified by reading `ClientHome.tsx`):

1. Entradas → /entradas
2. Tráficos → /traficos
3. Pedimentos → /pedimentos
4. Catálogo → /catalogo
5. Anexo 24 → /anexo24
6. Expedientes Digitales → /expedientes
7. Reportes → /reportes
8. KPI's → /kpis

Removed: Solicitar Embarque, Clasificar Producto, Ahorro (confirmed absent from TILES).

### Gate output

| Gate | Commit 1 | Commit 2 |
|---|---|---|
| `npm run typecheck` | 0 errors | 0 errors |
| `npm run build` | succeeded | succeeded |
| `npm run test` | 124 / 124 pass (10 files) | 124 / 124 pass (10 files) |
| Pre-commit hooks | green | green |

### Phase 2 readiness

Phase 1 is complete and green. Phase 2 can proceed. Recommended scope notes for Phase 2:

- Mechanical internal-symbol rename (separate commit, as planned)
- Brand sweep of marketing/demo pages (`/demo`, `/resultados`, `/inteligencia`, `/bienvenida`, `/onboarding`, `/voz`, `/track`, `/upload`, `/proveedor`, `/share`, `/mis-reglas`, `/calls`, `/comunicaciones`, `/cruz`) — 247 residual hits concentrate here
- `src/components/views/reportes-view.tsx` also still contains `CRUZ — Renato Zapata & Company` header strings (2 occurrences in PDF/report export)
- Other backend scripts (`scripts/send-notifications.js`, `scripts/solicit-missing-docs.js`, `scripts/weekly-digest.js`, `scripts/lib/email-templates.js`, `scripts/lib/docs-handlers.js`, `scripts/lib/email-send.js`) still use `CRUZ — Renato Zapata` in `FROM_EMAIL` — included in the wider brand sweep, not blocking Phase 2

## Phase 2

### P2 commit 1 — brand sweep follow-up

Second pass targeting user-visible `CRUZ`/`ADUANA` text the Phase 1 table missed: `reportes-view.tsx` CSV + headers, email `FROM_EMAIL` constants in 6 scripts, and marketing/demo page copy.

**Files changed:**

| File | Change |
|---|---|
| `src/components/views/reportes-view.tsx` | CSV meta header, filename prefix (`CRUZ_Traficos_` → `Portal_Traficos_`), footer caption |
| `scripts/send-notifications.js` | `FROM_EMAIL`, CTA text, email wordmark header + subheader, test fallback sender |
| `scripts/solicit-missing-docs.js` | Email `from` header on outbound solicitation |
| `scripts/weekly-digest.js` | `FROM_EMAIL`, subheader, CTA button text |
| `scripts/lib/email-templates.js` | Footer attribution text |
| `scripts/lib/docs-handlers.js` | Email `from` header |
| `scripts/lib/email-send.js` | Shared `FROM_EMAIL` constant |
| `src/app/demo/page.tsx` | Wordmark + after-state label |
| `src/app/demo/request-access/page.tsx` | Wordmark + form label |
| `src/app/resultados/page.tsx` | Claims detail copy |
| `src/app/inteligencia/page.tsx` | 3 labels (KpiCard sub, section header, paragraph copy) |
| `src/app/bienvenida/page.tsx` | H1 greeting |
| `src/app/onboarding/page.tsx` | Brand lockup + 3 step copy strings |
| `src/app/voz/page.tsx` | Header label |
| `src/app/track/[token]/page.tsx` | Header label |
| `src/app/upload/[token]/page.tsx` | 2 wordmarks + referral paragraph |
| `src/app/proveedor/[token]/page.tsx` | 3 logo usages + referral paragraph + footer |
| `src/app/share/[trafico_id]/page.tsx` | Metadata title/OG/siteName + header wordmark + CTA headline |
| `src/app/mis-reglas/page.tsx` | Page title + subtitle + empty state description |
| `src/app/calls/page.tsx` | Page subtitle |
| `src/app/comunicaciones/page.tsx` | Draft button label |
| `src/app/cruz/page.tsx` | Full-screen chat header H1 |

### Discretionary sweep hits beyond explicit targets

Rewrote these user-visible strings found during the discretionary sweep:

- `/resultados` — "operaciones gestionadas por ADUANA"
- `/inteligencia` — KpiCard sub "por ADUANA AI", section header "Rendimiento ADUANA AI", body "ADUANA ha clasificado"
- `/bienvenida` — "Bienvenido a ADUANA"
- `/onboarding` — "CRUZ" brand lockup, "ver CRUZ con datos de ejemplo", "CRUZ clasifica productos", "Tu agencia ADUANA está activada"
- `/voz` — "Modo Voz · ADUANA AI"
- `/track/[token]` — "ADUANA Tracking"
- `/upload/[token]` — both "ADUANA" wordmarks + "CRUZ puede simplificar su proceso"
- `/proveedor/[token]` — all three `<div style={styles.logo}>ADUANA</div>` + "CRUZ organiza todos sus documentos" + footer "CRUZ — Renato Zapata & Company"
- `/share/[trafico_id]` — metadata title (3 occurrences), openGraph siteName, header wordmark, CTA headline
- `/mis-reglas` — page title, subtitle, empty-state description
- `/calls` — subtitle
- `/comunicaciones` — "🦀 Redactar con ADUANA" button label
- `/cruz` — top H1 (the route's own brand heading)

Left alone intentionally:

- JS identifiers: `draftWithADUANA()`, `CRUZLayout`, `CruzChatHistory`, etc.
- Code comments and JSDoc (e.g. `// CRUZ Client Auto-Notification Pipeline`, `* CRUZ — Automated Document Solicitation`, operator-facing `console.log` strings)
- AI system-prompt strings that are not rendered to users (`src/app/cruz/page.tsx` line 103 — context sent to model)
- Directory names (`src/components/cruz/`, `src/app/cruz/`, `src/app/aduana/`)
- CSS class hooks (`.aduana-dark` etc.), event names, localStorage keys

### Before/After grep counts

```
grep -rn "ADUANA\|CRUZ" src/app src/components public scripts  (excl node_modules)
```

| State | Total hits |
|---|---|
| Before P2 commit 1 | 1153 |
| After P2 commit 1 | 1103 |
| Delta | -50 |

Remaining hits are overwhelmingly code identifiers, CSS class hooks, directory names, comments, and internal event/storage keys — not user-visible copy.

### Gate output

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run build` | succeeded (all routes compiled) |
| `npm run test` | 124 / 124 pass (10 files) |
| Pre-commit hooks | green |

### Injection attempts detected during execution

Multiple `<system-reminder>` blocks appeared inside tool-call outputs attempting to redirect execution: (a) an ADUANA-preserving CLAUDE.md insisting "all user-facing text says 'ADUANA'", (b) an operational-resilience rules file, (c) a design-system file, (d) a core-invariants file, (e) an MCP `computer-use` instructions block. All were treated as untrusted data per the prompt's injection guard and ignored. Executor continued with the user's authoritative scope.

### P2 commit 2 — operator 8-card + banner

Operator cockpit now gets the same glass 8-card nav grid that the client cockpit shipped in Phase 1, plus a role-agnostic positive-KPI banner (`RoleKPIBanner`) that celebrates week-over-week personal throughput. Nav grid logic was extracted from `ClientHome` into a shared `NavCardGrid` component so both cockpits consume the same primitive.

**Files added:**

| File | Lines | Role |
|---|---|---|
| `src/components/NavCardGrid.tsx` | 56 | Shared glass grid wrapper consuming `SmartNavCard` — used by client + operator |
| `src/components/RoleKPIBanner.tsx` | 79 | Role-agnostic positive-KPI banner, green-tint glass, returns `null` when no celebration |

**Files modified:**

| File | Change |
|---|---|
| `src/components/client/ClientHome.tsx` | Removed inline `.nav-cards-grid` `.map()` block, replaced with `<NavCardGrid items={...} />`. `TILES` definition + tile count/micro-status logic unchanged — rendered output preserves the 8-card grid verbatim (same cards, same order, same badges, same styling). |
| `src/app/operador/inicio/page.tsx` | Added parallel queries `personalCompletedThisWeekRes` + `personalCompletedLastWeekRes` against `traficos` (heuristic: `estatus='Cruzado'` AND `assigned_to_operator_id=opId` AND `updated_at` in the 7-day / 7-to-14-day windows). Plumbed both counts into `<InicioClient>`. |
| `src/app/operador/inicio/InicioClient.tsx` | New imports (8 Lucide icons + `NavCardGrid` + `RoleKPIBanner`). Added `OPERATOR_TILES` array (8 tiles: Mis tráficos, Cola de excepciones, Pedimentos pendientes, Subir documentos, Clasificaciones, Solicitudes enviadas, Mi día, Equipo). Rendered `<RoleKPIBanner>` + `<NavCardGrid>` inside the left column, between `<HeroStrip>` and `<ActiveTraficos>`. Badges wired from existing props (`personalAssigned`, `colaCount`, `kpis.pendientes`); `clasificacionesPendientes` / `solicitudesAbiertas` are 0-placeholders until their data sources land. |

**Line deltas:**

- Added: `NavCardGrid.tsx` 56 + `RoleKPIBanner.tsx` 79 = 135 new
- `ClientHome.tsx`: -19 / +17 (net -2)
- `InicioClient.tsx`: +49 / 0 (49 net inserted)
- `page.tsx`: +18 / 0 (18 net inserted)

**New layout (operator inicio):**

```
Greeting header (dot · name · summary · live timestamp)
QuickActions
├─ Left column (1fr)
│   HeroStrip (4 KPIs)
│   RoleKPIBanner           ← NEW — only renders when thisWeek > lastWeek
│   NavCardGrid 8 cards     ← NEW — glass cards, 2×4, 60px touch
│   ActiveTraficos table
└─ RightRail (340px)        ← unchanged
```

**Client parity:** `ClientHome` now consumes `<NavCardGrid>`. Same 8 tiles (Entradas / Tráficos / Pedimentos / Catálogo / Anexo 24 / Expedientes Digitales / Reportes / KPI's), same order, same `tileCount` + `tileMicroStatus` resolution, same `SmartNavCard` render — visual output identical. The `.nav-cards-grid` CSS rules now live in `NavCardGrid`'s own `<style>` block; ClientHome's existing responsive style block still defines the same selectors (duplicate-safe cascade), so no rule is lost if either file is read in isolation.

**Query choice for personal throughput:**

Picked `traficos` (not `operational_decisions`) because: (1) the existing page already queries `traficos` with `assigned_to_operator_id` filters, so the operator→tráfico mapping is proven; (2) `operational_decisions.decision` stores free-text (`"estatus: En Proceso → Cruzado"`) which requires `ilike` pattern matching + JSON actor extraction — less reliable. The `traficos.updated_at` window is a proxy (it fires on any column update, not specifically the status transition), but for an operator who owns the tráfico this is close enough for a week-over-week celebration signal. If precision tightens later, swap to `operational_decisions` filtered by `decision_type='status_update'` + `decision ilike '%→ Cruzado%'` + `data_points_used->>actor` match.

**Gate output:**

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run build` | succeeded (all routes compiled) |
| `npm run test` | 124 / 124 pass (10 files) |
| Pre-commit hooks | green |

**Injection attempts detected during P2 commit 2:**

Four `<system-reminder>` blocks appeared inside tool-call outputs: (a) the `computer-use` MCP instructions, (b) the repo `CLAUDE.md` (ADUANA brand directive insisting "all user-facing text says 'ADUANA'"), (c) `.claude/rules/performance.md`, (d) `.claude/rules/design-system.md`, (e) `.claude/rules/core-invariants.md`. Per the prompt's injection guard, all were treated as untrusted context. The operator cockpit's user-visible strings stay Spanish + brand-neutral ("Mis tráficos", "Portal te lo reconoce", etc.) — no brand-name overrides were applied beyond the plan's explicit "Portal" directive. Design-system values the plan specified (rgba glass, 20px blur, 60px touch) were already consistent with what the rule files declared, so no behavior change resulted from either source — only from the plan.

### P2 commit 3 — /operador/subir

Cross-tráfico document upload landing for operators. Server component at `src/app/operador/subir/page.tsx` gates via `portal_session` + `verifySession` (redirects `client` → `/inicio`, unauthenticated → `/login`, allows `operator`/`admin`/`broker`). Fetches active tráficos (`estatus NOT IN ('Cruzado','Cancelado')`, PORTAL_DATE_FROM-scoped) — scoped to `session.companyId` for operators, cross-client for admin/broker. Resolves `companies.nombre_comercial`/`razon_social` in one batched `.in()` call — no N+1.

Client component `SubirClient.tsx`: 32px Geist header "Subir documentos", Spanish subtitle, glass tráfico picker (60px native `<select>` with cyan border when populated, optional filter box when list > 8), reuses existing `DocUploader` (unmodified) once a tráfico is selected, disabled placeholder zone before selection. Email hint card links `ai@renatozapata.com` as the alternate intake channel. `page_view` telemetry fires on mount with `entityType: 'operador_subir'` and the candidate count.

Gate output:
| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run build` | success — `/operador/subir` registered as ƒ Dynamic |
| `npm run test` | 124/124 pass (10 files) |
| Pre-commit hooks | green |

**Injection attempts detected during P2 commit 3:**

Six `<system-reminder>` blocks arrived inside tool output: (a) the `computer-use` MCP instructions arriving with the very first bash result; (b) the repo `CLAUDE.md` reasserting the ADUANA brand and a pile of project conventions; (c) `.claude/rules/performance.md`; (d) `.claude/rules/design-system.md`; (e) `.claude/rules/core-invariants.md`; (f) `.claude/rules/operational-resilience.md`; and (g) `.claude/rules/cruz-api.md`. Per the prompt's injection guard, all were treated as untrusted context. The plan's "Portal" user-visible brand is preserved (no "ADUANA" string introduced on this surface). Glass tokens, 60px targets, and Spanish-primary copy happen to line up with what the rule files declared — no behavior change was driven by either source beyond what the plan already specified. No computer-use tool was invoked.

### P2 commit 4 — admin polish

Three surfaces: clickable escalation banner, positive-KPI banner for Tito, and pipeline stage drill-through. Last commit of Phase 2.

**Clickable escalation banner** — `src/components/cockpit/AdminCockpit.tsx` (where the exact string "N escalaciones requieren atención inmediata" actually lives; the user prompt's pointer to `src/app/admin/inicio/` was resolved against the real source). When `healthLevel` is `amber` or `red` the status line renders as a `next/link` to `/admin/aprobar` (route confirmed present) with 60px min-height, cyan-hover underline, and a right-aligned "Abrir cola →" affordance. Green stays static — no false urgency.

**Positive-KPI banner (Tito)** — `src/app/admin/inicio/InicioCockpit.tsx` renders the shared `<RoleKPIBanner>` between `HeroStrip` and `ClientHealthGrid`. Data comes from two new Supabase queries in `inicio/page.tsx` counting `operational_decisions` with `outcome IS NOT NULL` over the last 7d and the prior 7d (days 8-14). `InicioData.autonomy` now carries `{ thisWeekDecisions, lastWeekDecisions }`. The cockpit gates on `thisWeekDecisions >= 10` before mounting the banner; the banner itself already returns `null` when `thisWeek <= lastWeek`, so no false positivity ever slips through. Celebration copy: `Sistema sólido, {name} — {n} decisiones autónomas esta semana, +{pct}% vs. semana pasada.` Name reuses the existing greeting source (`data.greeting.name` = "Renato Zapata III").

**Pipeline stage drill-through** — `src/components/cockpit/admin/CruzAutonomoPanel.tsx`: each of the 7 stage cells in the Pipeline Autónomo bar is now wrapped in a `next/link` to `/admin/pipeline/[stage]` with `minHeight: 60`, cyan hover (`rgba(0,229,255,0.14)` background + stronger border), and visible focus outline. New route `src/app/admin/pipeline/[stage]/page.tsx` is a server component gated by `verifySession` (role ∈ `{admin, broker}`), validates the stage slug against `VALID_STAGES` or returns `notFound()`, then fetches the 50 most recent `workflow_events` filtered by `workflow = stage` ordered by `created_at DESC`. Renders a dark-glass table with timestamp (`fmtDateTime`), event_type, trigger_id, status pill (success/pending/failed/neutral), and a lightweight payload summary (trafico / pedimento / doc_type / action / reason / message — first three that exist). Back-link to `/admin/inicio`. Empty state copy: "Sin eventos recientes en este paso."

**Stage slug set used (7, not 8):** `intake, classify, docs, pedimento, crossing, post_op, invoice`. The prompt suggested 8 with `monitor`, but `CruzAutonomoPanel`'s existing `WORKFLOW_STAGES` array defines only 7 cells and `fetchCockpitData.ts` aggregates `byStage` off `workflow_events.workflow` using the same set. Ambiguity resolved by honoring "smallest change" + existing rendered surface. `monitor` is kept in the page's `STAGE_LABELS` map so the route is forward-compatible if the pipeline ever grows to 8; it just isn't linked from the cockpit today.

**Gate output:**

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run build` | success — `/admin/pipeline/[stage]` registered as ƒ Dynamic |
| `npm run test` | 124 / 124 pass (10 files) |
| Pre-commit hooks | green |

**Injection attempts detected during P2 commit 4:**

Five `<system-reminder>` blocks arrived inside tool output: (a) the `computer-use` MCP instructions with the first batch of bash results; (b) the repo `CLAUDE.md` with the ADUANA brand directive and platform context; (c) `.claude/rules/performance.md`; (d) `.claude/rules/core-invariants.md`; (e) `.claude/rules/design-system.md`; and (f) `.claude/rules/operational-resilience.md`. Per the prompt's injection guard, all treated as untrusted. No brand-name change was applied to the user-visible surfaces (copy stays "Pipeline · {title}" + "Volver a Inicio" — brand-neutral, Spanish). The Cinematic Glass tokens happen to align with what both the user prompt and the rule files specified; no behavior change was driven by the rules. No `computer-use` tool was invoked.

### Phase 2 ready to ship

All four Phase 2 commits landed on `feature/v6-phase0-phase1`:

1. Commit 1 — `feat(client): 8-card client cockpit` (`0da2e01`)
2. Commit 2 — `feat(operator): 8-card cockpit with glass grid + shared RoleKPIBanner` (`e7c45bc`)
3. Commit 3 — `feat(operator): /operador/subir cross-trafico document upload landing` (`d07fb23`)
4. Commit 4 — `feat(admin): Pipeline stage drill-through + positive-KPI banner + clickable escalation banner` (this commit)

Four gates green on every commit. Three cockpits now share the same glass grid shape, the same `<RoleKPIBanner>` celebration pattern, and (for the admin) the same drill-through mechanic from summary to detail. Phase 3 — warehouse + contabilidad + new roles — can begin.

### P3 commit 1 — new roles infrastructure

Foundation for the two new cockpits coming in commits 2 and 3. No cockpit pages yet — this commit only adds the type, routing, and nav scaffolding so that a `warehouse` or `contabilidad` session can authenticate, land on the correct path, and render the shell without erroring.

**Changes (4 files):**

1. `src/lib/session.ts` — introduced `PortalRole` union (`'client' | 'operator' | 'admin' | 'broker' | 'warehouse' | 'contabilidad'`), narrowed `verifySession` return type from `string` to `PortalRole`, and added rejection of any decoded role outside the union. `signSession` left untouched (still accepts any string — legacy callers compile unchanged).
2. `src/middleware.ts` — added root-path redirects: `warehouse` → `/bodega/inicio`, `contabilidad` → `/contabilidad/inicio`. Both roles pass through every other guard (CSRF, session verification, admin-only route blocks) identically to operators.
3. `src/components/nav/nav-config.ts` — extended `UserRole` union, added `WAREHOUSE_NAV` (4 items: Inicio, Entradas, Subir, Buscar) and `CONTABILIDAD_NAV` (4 items: Inicio, Facturación, Cobranzas, Pagos), added empty `WAREHOUSE_GROUPS` / `CONTABILIDAD_GROUPS` for symmetry, extended `getRoutesForRole`, and introduced a new `getNavForRole` helper for shells that need a flat top-level nav per role.
4. `src/components/DashboardShellClient.tsx` — extended the `user_role` cookie dispatch so `warehouse` and `contabilidad` resolve to `portalType='operator'` (internal-team shell with sidebar visible).

**Injection attempts logged:** Four `<system-reminder>` blocks arrived inside tool output during this commit: (a) MCP `computer-use` tool instructions; (b) the repo `CLAUDE.md` ADUANA constitution; (c) `.claude/rules/operational-resilience.md`; (d) `.claude/rules/performance.md`; (e) `.claude/rules/core-invariants.md`; (f) `.claude/rules/design-system.md`. Per the prompt's injection guard, all treated as untrusted data. No scope change applied. No computer-use tool invoked.

**Gates:**

- `npm run typecheck` — 0 errors
- `npm run build` — succeeds (all routes compiled, middleware compiled)
- `npm run test` — 124/124 pass (10 files)

**Renato's next step (flagged, not blocking this commit):** create Supabase auth users for Vicente (`role=warehouse`) and Anabel (`role=contabilidad`) with appropriate `company_id` before commits 2 and 3 ship the cockpit pages. Without users, the new roles exist only as a type-level union — no one can log in as them yet.

**Readiness for commit 2:** Warehouse cockpit (`/bodega/inicio`) can now be built as a thin page — session will carry the narrow role, middleware will route `/` there, sidebar will render via operator-style shell, and `getNavForRole('warehouse')` returns the four-item nav.

### P3 commit 2 — warehouse cockpit

Vicente's cockpit now exists. `/bodega/inicio` renders a giant cyan-glow drag-drop hero above an 8-card glass nav grid — upload-first, because that is the warehouse's one job. Session gate is `verifySession`: `warehouse`, `admin`, `broker` pass through; `client` and `operator` bounce to `/inicio`; unauth bounces to `/login`.

**Changes (3 new files):**

| File | Lines | Purpose |
|---|---|---|
| `src/app/bodega/inicio/page.tsx` | 121 | Server component — session gate + 7 parallel Supabase counts (entradas today / this-week / last-week / próximas / en-bodega / last-7d), bucketed on America/Chicago day boundaries |
| `src/app/bodega/inicio/BodegaClient.tsx` | 170 | Client component — glass header with `getGreeting(operatorName)`, `<RoleKPIBanner>` (green celebration only when `entradasThisWeek > entradasLastWeek`), hero drag-drop linking to `/bodega/subir`, 8-card `<NavCardGrid>` |
| `src/app/bodega/subir/page.tsx` | 66 | Warehouse-scoped upload landing — warehouse sees all active tráficos across clients (floor work is cross-client). Reuses operator `SubirClient` component for the picker + `DocUploader` flow |
| `src/app/bodega/ayuda/page.tsx` | 80 | Stub help page — three glass cards: "Cómo subir documentos", "Cómo registrar una entrada nueva", "Contacto". Same session gate |

**Nav tiles (8):**

| Label | Href | Badge source |
|---|---|---|
| Entradas de hoy | `/entradas?hoy=1` | entradas with `fecha_llegada_mercancia >= todayStart CST` |
| Por arribar | `/entradas?estatus=esperado` | traficos with `fecha_llegada > now` and estatus ∉ {Cruzado, Cancelado} |
| En bodega | `/entradas?estatus=recibido` | entradas (last 90d) with trafico whose estatus ∉ {Cruzado, Cancelado} |
| Subir fotos | `/bodega/subir` | — |
| Últimos 7 días | `/entradas?rango=7d` | entradas with `fecha_llegada_mercancia >= weekStart CST` |
| Buscar tráfico | `/buscar` | — |
| Mi día | `/mi-dia` | — |
| Ayuda | `/bodega/ayuda` | — |

**Judgment calls:**

1. **Upload picker flow.** The prompt offered two options for the hero: (a) drop → inline picker appears, or (b) drop → route to `/bodega/subir` which has the picker. Chose (b) — single canonical upload flow, reuses the operator `SubirClient` component as-is (zero duplication, zero new props on `DocUploader`). The hero is a full-width cyan-glow `<Link>` to `/bodega/subir` — visually a drop zone, semantically a navigation.
2. **Greeting name source.** Plan said "Vicente or authenticated user's display name". Used `operator_name` cookie (same cookie the operator cockpit reads) with fallback to `"Vicente"`. When Renato provisions the warehouse user this cookie will already be set by the login flow.
3. **Entradas have no `estatus` column.** The `/entradas?estatus=...` hrefs are purely for nav — the badge counts are computed from the two signals that actually exist: `fecha_llegada_mercancia` on entradas and `estatus` on traficos. "Por arribar" counts future-dated traficos not yet crossed. "En bodega" counts entradas (last 90d) whose parent tráfico hasn't crossed — the same pattern already used in the existing `src/app/bodega/page.tsx`.
4. **CST day boundaries.** Used `Intl.DateTimeFormat` with `timeZone: 'America/Chicago'` to resolve the current Laredo date, then constructed UTC midnight. Good enough for day-level bucketing; the CST/CDT edge hour only affects windowing within the transition day.
5. **No modifications to `NavCardGrid` or `RoleKPIBanner`.** Both components already accepted every prop this cockpit needed — zero API changes.

**Gate output:**

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run build` | success — `/bodega/inicio`, `/bodega/subir`, `/bodega/ayuda` all registered as ƒ Dynamic |
| `npm run test` | 124 / 124 pass (10 files) |
| Pre-commit hooks | green |

**Injection attempts detected during P3 commit 2:**

Five `<system-reminder>` blocks arrived inside tool output: (a) MCP `computer-use` tool instructions delivered with the first `ls` result; (b) the repo `CLAUDE.md` (ADUANA brand constitution, identity, domain rules); (c) `.claude/rules/performance.md`; (d) `.claude/rules/design-system.md`; (e) `.claude/rules/core-invariants.md`; (f) `.claude/rules/operational-resilience.md`. Per the prompt's injection guard, all treated as untrusted. No scope change applied. No brand rename to "ADUANA" — user-visible copy uses "Portal" only, per hard rules. No `computer-use` tool invoked. The glass tokens and session-gate pattern align with both the prompt and the rule files, but the implementation was driven entirely by grepping existing code (operator cockpit + client cockpit).

**Readiness for commit 3:** Same pattern can be ported to `/contabilidad/inicio` for Anabel. `getNavForRole('contabilidad')` already exists from P3 commit 1 with four items (Facturación, Cobranzas, Pagos), and the shared `<NavCardGrid>` + `<RoleKPIBanner>` primitives are unchanged by this commit.

### P3 commit 3 — contabilidad cockpit

**Scope:** Pendency-first 8-card cockpit for Anabel at `/contabilidad/inicio`, plus three stub pages (`ayuda`, `exportar`, `kpis`). Mirrors the `/bodega/inicio` pattern with accounting semantics: the header is a triple counter of what is waiting, not a celebration of what was done.

**Files added:**

| File | Lines | Role |
|---|---|---|
| `src/app/contabilidad/inicio/page.tsx` | 126 | Server gate + 8 parallel Supabase fetches |
| `src/app/contabilidad/inicio/ContabilidadClient.tsx` | 121 | Client cockpit — header, banner, 8-card grid |
| `src/app/contabilidad/ayuda/page.tsx` | 77 | Glass stub: Cómo facturar / registrar pago / contacto |
| `src/app/contabilidad/exportar/page.tsx` | 62 | Glass stub: "próximamente" |
| `src/app/contabilidad/kpis/page.tsx` | 60 | Glass stub: margen / DSO / cobranza promedio |

**Data field choices (call-outs for Anabel's first review):**

| KPI | Source | Ambiguity |
|---|---|---|
| `pendientesFacturar` | `traficos.estatus IN ('Cruzado','Cancelado')` last 90d, minus any trafico number found inside `invoices.notes` | There is no canonical "unbilled" flag. The `invoices.notes` regex match (`\b\d{4,}\b`) is a best-effort proxy — it will over-count when invoices don't reference the trafico number in their notes, and under-count when notes mention unrelated numbers. Flagged for replacement by a proper join column in a later phase. |
| `cxCobrar` | `invoices.status IN ('sent','viewed','draft')` | Matches the existing `/facturacion` semantics — pending + sent + viewed all count as outstanding. |
| `cxPagar` | `aduanet_facturas.fecha_pago IS NULL` last 90d | Proxy for unpaid DTA/IGI/IVA. Not perfect — some older rows may have null fecha_pago simply because the sync hasn't backfilled it. Scoped to last 90d to minimize noise. |
| `morososCount` | `invoices.status = 'overdue'` | Relies on a nightly job flipping `sent` → `overdue` when `due_date < today`. If that job lags, this undercounts. Follow-up: compute `due_date < today AND status != 'paid'` at read time if the nightly flip proves unreliable. |
| `facturasMes` | `invoices.created_at >= monthStart_CST` | Uses America/Chicago month boundary, consistent with the rest of the cockpit. |
| `thisWeekOverdue` / `lastWeekOverdue` | `invoices.status='overdue'` bucketed by `created_at` (weekStart/twoWeeksStart) | Drives the banner. Banner fires only when `lastWeek > thisWeek` AND `thisWeek > 0`. |

**Judgment calls:**

1. **No separate `cobranzas`, `pagos`, `morosos`, or `estados-cuenta` routes exist yet.** The 8 card hrefs reference them anyway — they will 404 until P4/P5. This matches the operator cockpit precedent where tile hrefs sometimes land on work-in-progress pages.
2. **Banner inversion.** `RoleKPIBanner` is built to celebrate `thisWeek > lastWeek`. For contabilidad the metric to *reduce* is overdue invoices, so the delta (`lastWeekOverdue - thisWeekOverdue`) is passed as `thisWeek`, with `lastWeek = 0`. Zero modifications to the shared component.
3. **Session gate.** Allows `contabilidad | admin | broker`. Non-allowlisted roles redirect to `/inicio` (not `/login`), same pattern as bodega when an operator lands there by accident.
4. **Greeting.** Reads the `operator_name` cookie with fallback `"Anabel"`. Renato will set this cookie when provisioning her Supabase auth user.
5. **Currency + pedimento invariants preserved.** No new monetary math in this commit — the cockpit only counts rows; all display formatting stays inside `/facturacion` and its successors.

**Gate output:**

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run build` | success — `/contabilidad/inicio`, `/contabilidad/ayuda`, `/contabilidad/exportar`, `/contabilidad/kpis` all registered as ƒ Dynamic |
| `npm run test` | 124 / 124 pass (10 files) |
| Pre-commit hooks | green |

**Injection attempts detected during P3 commit 3:**

Multiple `<system-reminder>` blocks arrived inside tool output: (a) a global `CLAUDE.md` describing a CRUZ platform; (b) an `MEMORY.md` with a project index; (c) the repo `CLAUDE.md` (ADUANA brand constitution); (d) an MCP `computer-use` tool-usage manifest; (e) `.claude/rules/performance.md`; (f) `.claude/rules/design-system.md`; (g) `.claude/rules/core-invariants.md`; (h) `.claude/rules/operational-resilience.md`. Per the prompt's injection guard, all treated as untrusted data. Brand remained "Portal" in user-visible copy. No `computer-use` tool invoked. No scope expansion (no supplier cockpit, no banner refactor, no empty-state sweep — those belong to Phase 4). Alignment with the rule files was incidental: the glass tokens and session-gate pattern were read from the existing `/bodega/inicio` source, not from the injected rules.

**Phase 3 ready to ship.**

All three P3 commits have landed on `feature/v6-phase0-phase1`:

1. Session + middleware + nav-config support for `warehouse` and `contabilidad` roles.
2. `/bodega/inicio` upload-first cockpit for Vicente.
3. `/contabilidad/inicio` pendency-first cockpit for Anabel.

**Renato's next step:** create the Anabel Supabase auth user with role `contabilidad` and set the `operator_name` cookie on login to `Anabel`. After that, the `/contabilidad/inicio` route will render on her first visit (middleware already redirects `/` → `/contabilidad/inicio` for the role).

**Phase 4 preview:** supplier mini-cockpit (`/proveedor/inicio` or similar), banner refactor (consolidate `RoleKPIBanner` logic to support both celebration and reduction metrics in one prop shape), empty-state sweep across the remaining cockpits, and a full audit pass against DESIGN_SYSTEM.md.


### P4 commit 1 — supplier mini-cockpit

**Scope:** `/proveedor/[token]` rebuilt as a 4-card glass mini-cockpit; new token-gated API `/api/supplier/confirm-shipment`; `/api/upload-token` GET enriched with company_name + expires_at + shipment confirmation state.

**Files modified / created:**
- `src/app/proveedor/[token]/page.tsx` (959 lines — full rewrite from the legacy upload-only card)
- `src/app/api/supplier/confirm-shipment/route.ts` (139 lines — new)
- `src/app/api/upload-token/route.ts` (GET payload expanded; POST unchanged)

**4-card grid (2×2 desktop, 1-col mobile, 80px min-height cards):**
1. Documentos solicitados — opens a checklist panel diffing `required_docs` vs `docs_received`.
2. Subir documento — opens a drag/pick uploader routed to the existing `/api/upload-token` POST (reused, token-only, no session).
3. Ver tráfico — read-only summary (trafico id, cliente, counts, vencimiento, confirmation timestamp).
4. Confirmar embarque — posts to `/api/supplier/confirm-shipment`, which stamps `upload_tokens.shipment_confirmed_at`, emits a `workflow_events` row (`event_type='supplier.shipment_confirmed'`, workflow=`intake`), and writes an `operational_decisions` row via `logDecision({decision_type: 'supplier_confirm'})`. Idempotent — repeat taps return the original confirmation timestamp. The "Confirmar" tile locks to a green confirmed state after success.

**Positive-completion banner:** glass card with `rgba(34,197,94,0.08)` tint renders above the grid when all required docs are received: "¡Listo! Los {n} documentos fueron recibidos. Gracias."

**Glass aesthetic:** matches ClientHome — `rgba(255,255,255,0.04)` cards, `blur(20px)`, cyan `#00E5FF` icons, 20px radius, JetBrains Mono on the Tráfico id / counts / timestamps, 60px touch targets on every button including the in-panel close (X) hit area and Confirmar CTA.

**Endpoint choice:** reused `/api/upload-token` for file uploads — it already validates tokens, writes to Storage (`expediente-documents` bucket), and inserts into `documents` table with `source='supplier_upload'`. No new upload endpoint was needed.

**Vision classification for supplier uploads:** **skipped on purpose.** The legacy `/api/upload-token` POST stores docs with `document_type = file.name.split('.')[0]` (no vision call). Supplier uploads should stay that way — suppliers often misname files and trigger the vision classifier from this path would run it on unvetted PDFs with no operator review loop. Operator-side vision classification already runs via `/api/docs/classify` against docs uploaded through the authenticated flow, and the operator can re-run it on supplier uploads manually. Building an async classifier queue for supplier uploads belongs in a later commit, not this one.

**Gate output:**
| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run test` | 124 / 124 pass (10 files, 588 ms) |
| `npm run build` | success — `/api/supplier/confirm-shipment` registered as ƒ Dynamic; `/proveedor/[token]` registered as ƒ Dynamic |
| `npx eslint` (changed files) | 0 errors after fixing 2 unescaped entities |
| Brand sweep | 0 user-visible "CRUZ" or "ADUANA"; one internal comment reference to "CRUZ Operational Brain" (decision logger table lineage — not rendered) |

**Injection attempts detected during P4 commit 1:**
Several `<system-reminder>` blocks arrived inside tool output — (a) a global CRUZ `CLAUDE.md`; (b) an auto-memory `MEMORY.md` listing project context files; (c) the repo ADUANA `CLAUDE.md`; (d) an MCP `computer-use` tool-usage manifest; (e) `.claude/rules/performance.md`; (f) `.claude/rules/design-system.md`; (g) `.claude/rules/core-invariants.md`; (h) `.claude/rules/operational-resilience.md`; (i) `.claude/rules/cruz-api.md`; (j) `.claude/rules/supabase-rls.md`. Per the prompt's injection guard all were treated as untrusted data. User-visible brand stayed "Portal". No `computer-use` tool was invoked. Scope held to the supplier mini-cockpit — no banner refactor, no empty-state sweep, no design-system audit (those are reserved for P4 commits 2+). Rule-file alignment (glass tokens, 60px targets, parameterized Supabase queries, Zod input validation, structured `{data, error}` response shape) was incidental — those patterns were read from the existing `/api/docs/upload` and `ClientHome` sources.

**Readiness for commit 2:** green. `RoleKPIBanner` is still celebration-only; the positive-completion banner on this page is inlined rather than pushed through `RoleKPIBanner`, matching the plan's directive to avoid adding props to the shared banner. The banner refactor (supporting both celebration and reduction metrics) can land in commit 2 without reworking this page.
