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
