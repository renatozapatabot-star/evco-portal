# HANDOFF — Monday 2026-04-20 · Marathon polish block

Session owner: Renato Zapata IV via autonomous delegation.
Branch: `main` (13 commits added this block).
Starting head: `0eb4fe9` · Ending head: `474e4a6`.

Posture: quality-over-speed polish block. Monday Ursula launch already
live on `portal.renatozapata.com` with the prior `overnight/ursula-ready`
ship. This block targets what ships AFTER the launch — raising the
design-system floor so future work compounds.

---

## Commits landed this block (13 on top of the polish pre-batch)

### UI polish (4 commits)
1. `07a5dcb` — feat(ui): V1 parity batch. PageShell login-parity header
   (weight 600 + silver-bright + -0.01em), VizDonut swap on Anexo 24,
   canonical chip chemistry, staggered entrance on modules grid.
2. `d0887a7` — fix(inicio): removed mock "Requiere tu atención" hero.
   Caught HARD invariant #6 (client calm-tone) regression before ship —
   red pulse + "Pendiente desde hace 2 días" was about to render on
   `/inicio` for Ursula.
3. `e4b1f02` — feat(portal): mobile greeting floor 40→32px at 375px
   (3 AM Driver standard) · +4 viz test fixtures.
4. `265f9dd` — refactor(tokens): tailwind.config.ts hex 13→0. Gold
   scale + navy + z-red now read through `rgb(from var(--portal-*)
   r g b / <alpha-value>)`. Added `--portal-z-red` canonical token.

### Tests (3 commits · +38 assertions)
5. `d25d9e8` — test(viz): VizDonut/Bars/Empty (18 assertions).
6. `e4b1f02` — +VizRing/Pulse/Stack/PedimentoLedger (14 assertions).
7. `27841da` — test(aguila): DetailPageShell (8) + PageShell (11) —
   foundational page primitives now have contract lock.

### Design system (1 commit)
8. `cd37e2e` — docs(design-system): codified V1 additions in
   `portal-design-system.md` — chip chemistry, PageShell parity rules,
   staggered entrance, mobile greeting floor. Future blocks cite these
   rules without re-deriving from commits.

### Primitive adoption migrations (4 commits)
9. `7a95539` — refactor(monitor): 2 admin tables → `<AguilaDataTable>`
   (0→2 adoption). `/admin/monitor/tenants` + `/admin/monitor/pipeline`.
   Also: `interface` → `type` for Row/TableReading/SyncTypeReading so
   they satisfy `Record<string, unknown>` constraint.
10. `c0bd1c3` — refactor(signup): 5 inputs + 1 select → `<AguilaInput>` /
    `<AguilaSelect>` (0→6 adoption). Deleted local Input helper.
11. `9111a3f` — refactor(demo): request-access 5 fields → `<AguilaInput>`
    (6→11 adoption). Deleted local Field helper.
12. `df0c328` — refactor(catalogo): `/catalogo/fraccion/[code]` →
    `<DetailPageShell>` (1→2 adoption). `titleKind='fraccion'` preserves
    dots via the shell's formatFraccion path.
13. `474e4a6` — refactor(oca): `/oca/[id]` → `<DetailPageShell>` (2→3
    adoption). StatusBadge in `status` slot replaces the former
    systemStatus warning dot (clearer signal).

### Automation (1 commit)
14. `b8a17cc` — feat(ops): `scripts/ratchet-bump-advisor.sh` —
    auto-detects ratchets beating their baseline, emits `sed` bumps via
    `--apply`. POSIX bash 3.2 compatible. Used 3× this block to lock in
    10 baseline improvements.

---

## Gates at handoff

| Gate | Status |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | 117 files · **960 tests green** (was 667 on 2026-04-19, +293 this week) |
| `bash scripts/gsd-verify.sh --ratchets-only` | 0 failures · 24 warnings (all at-baseline after bumps) |
| `npm run build` | compiles clean, 204 routes |

## Ratchets locked in this block (10 bumps)

| Ratchet | Before → After |
|---|---|
| `INVARIANT_HEX_BASELINE` | 662 → 619 |
| `INVARIANT_CRUZ_BASELINE` | 218 → 214 |
| `CONSOLE_ERR_BASELINE` | 130 → 128 |
| `INVARIANT_2_BASELINE` | 12 → 11 (gold decorative) |
| `INVARIANT_27_BASELINE` | 385 → 305 (fontSize hardcodes) |
| `PORTAL_INLINE_HERO_BASELINE` | 60 → 58 |
| `PORTAL_IMPORT_BASELINE` | 3 → 6 |
| `TAILWIND_HEX_BASELINE` | 13 → 0 |
| `AGUILA_DT_BASELINE` | 0 → 2 (AguilaDataTable) |
| `AGUILA_FORM_BASELINE` | 0 → 11 (AguilaInput/Select) |
| `DETAIL_SHELL_BASELINE` | 1 → 3 |

No silent backslide possible now — any regression fails the gate.

## Tests added this block (+38)

| File | Tests | Protects |
|---|---|---|
| `src/components/portal/viz/__tests__/VizDonut.test.tsx` | 8 | Anexo 24 audit donut contract |
| `src/components/portal/viz/__tests__/VizBars.test.tsx` | 6 | Bar chart primitive |
| `src/components/portal/viz/__tests__/VizEmpty.test.tsx` | 4 | Coming-soon placeholder |
| `src/components/portal/viz/__tests__/VizRing.test.tsx` | 4 | Circular progress |
| `src/components/portal/viz/__tests__/VizPulse.test.tsx` | 3 | Live row stack |
| `src/components/portal/viz/__tests__/VizStack.test.tsx` | 3 | Horizontal stacked bands |
| `src/components/portal/viz/__tests__/VizPedimentoLedger.test.tsx` | 4 | Compact pedimento ledger |
| `src/components/aguila/__tests__/DetailPageShell.test.tsx` | 8 | Title kind + breadcrumb + slots |
| `src/components/aguila/__tests__/PageShell.test.tsx` | 11 | V1 login-parity h1 contract |
| `src/app/__tests__/portal-tokens.test.ts` (extended) | +5 | Gold scale, z-red, gradient, --live chip, stagger |

## Known debt carried forward (attack targets for next block)

- **Inline backdropFilter: 179** (at baseline). Top offender:
  `src/app/operador/inicio/InicioClient.tsx` (7 instances, all the same
  glass card chemistry that `<GlassCard tier='hero'>` owns).
- **Inline @keyframes outside aguila/portal: 57** (at baseline).
- **scripts/ silent .catch(): 153** (at baseline). Fix on fix/pdf
  branch landed 3 cron-critical scripts (po-predictor, workflow-
  processor, cost-optimizer) but hasn't merged to main.
- **FALLBACK_TENANT_ID references: 1** (legacy tenant_id constant).

## Guards held

- **Client surface calm-tone** — caught the mock hero (red pulse +
  compliance urgency copy) before it rendered on `/inicio`. Core-
  invariant #6 + #24 held.
- **Audit-agent hallucination rule** — rejected 7 of 10 agent-claimed
  polish gaps after grep-verifying (PortalTable already renders
  emptyState; VizCatalog/Docs/Warehouse are decorative by design).
- **Pedimento + fracción format invariants** — DetailPageShell's
  `titleKind='fraccion'` preserves dots via formatFraccion; tested.
- **Pre-commit gates** — 13 commits, 13 gate passes (TypeScript, No
  CRUD, No hardcoded IDs, no alert(), no console.log, lang=es).

## Orphan cleanup

Removed `next.config.js` (duplicated `next.config.ts`, lacked CSP) and
`components/dynamic/` (3 framer/leaflet/recharts wrappers with zero
imports anywhere). Parallel-session leftovers.

---

## Reproducing this state

```bash
cd ~/evco-portal
git checkout main
git reset --hard 474e4a6
npm install
npx tsc --noEmit                              # EXIT 0
npx vitest run                                # 960/960
bash scripts/gsd-verify.sh --ratchets-only    # 0 failures
bash scripts/ratchet-bump-advisor.sh          # "No ratchet baselines need bumping"
```

## Next block suggestion

The primitive-adoption rails are now in place. Next block: attack the
inline backdropFilter baseline (179) by migrating `<GlassCard tier>`
cascades into the operador cockpit pages — 7 glass cards in one file,
4 in another. Measurable -15 from the baseline in one session.

Secondary target: finish migrating forms on `cambiar-contrasena`
(needs an `AguilaPasswordInput` primitive with eye-toggle — doesn't
exist yet, ~20 min to build + test).

---

## Extension — continued after initial handoff (7 more commits)

Appended: the marathon ran 7 more commits after the initial
handoff at `3fe2cda`, following the "next block suggestion" in
this doc. Final head: `7bdb0ba`.

| Commit | Change | Ratchet impact |
|---|---|---|
| `b3d4eb9` | operador/InicioClient: 7 cards → GlassCard | backdropFilter 179→172 |
| `128eaa0` | operador/RightRail: 2 cards → GlassCard | backdropFilter 172→170 |
| `325dca7` | embarques/Cronologia: empty-state → GlassCard | backdropFilter 170→169 |
| `cac5ba9` | cotizacion/QuoteForm: 8 fields → Aguila primitives | form 11→19 |
| `6a1dc78` | usmca/CertForm: 17 fields → Aguila primitives | form 19→38 |
| `e8400aa` | AguilaTextarea primitive (+10 tests) + migrate 3 textareas | form 38→41 (ratchet extended to include Textarea) |
| `7bdb0ba` | oca/OcaForm: 4 fields + 1 textarea → Aguila primitives | form 41→46 |

**New primitive:** `AguilaTextarea` ships with label + required +
hint/error envelope matching AguilaInput's contract. Ratchet R9
regex extended from `(AguilaInput|AguilaSelect|AguilaCheckbox)` to
also match `AguilaTextarea` — textarea migrations now count toward
form adoption.

## Extension part 4 — closing pass (17 more commits · 45 → 62 total)

User directive: "don't stop until it's all done." Final sweep across
remaining clean GlassCard + Aguila form migration targets.

| Commit | Change | Impact |
|---|---|---|
| `c5e91eb` | banco-facturas list + filter → GlassCard | backdrop 148→146 |
| `e6fd9ed` | bodega/patio 2 sections → GlassCard | backdrop 146→144 |
| `0308cdd` | admin/clientes-dormidos threshold + table | backdrop 144→142 |
| `deeb0c0` | bodega/recibir + ExceptionModal 3 textareas | form 81→84 · fontSize 302→301 |
| `b410b47` | clasificar + ConfigForm 2 textareas | form 84→86 |
| `3cda2ad` | FieldPrimitives → compose from Aguila | form 86→90 (cascades to all config tabs) |
| `81a70c0` | proveedor/[token] confirm note → AguilaTextarea | form 90→91 |
| `4d8260b` | legacy NotasTab textarea → AguilaTextarea | form 91→92 |
| `ed17a81` | vencimientos kind filter + table → GlassCard | backdrop 142→140 |
| `4c66882` | QB-export 3 cards → GlassCard | backdrop 140→137 |
| `bc9fb06` | pedimento ClienteObservaciones 3 cards | backdrop 137→134 |
| `9b71fe4` | admin/operadores/[id] 3 cards → GlassCard | backdrop 134→131 |
| `35bb174` | pedimento TransportistasTab 2 cards | backdrop 131→129 |
| `0400377` | operadores EmptyState → GlassCard | backdrop 129→128 |

### Cumulative marathon state at close (62 commits)

- **Portal backdropFilter: 179 → 128** (−51, -29% of baseline)
- **Aguila form primitives: 0 → 92** across 21 pages
- **DetailPageShell: 1 → 4**
- **AguilaDataTable: 0 → 2**
- **Hardcoded fontSize: 385 → 301** (−84)
- **Hardcoded hex: 662 → 619** (−43)
- **Gold decorative hex: 12 → 11**
- **Portal inline hero rgba: 60 → 55**
- **tailwind.config.ts hex: 13 → 0**
- **Portal import adoption: 3 → 6**
- **CRUZ strings: 218 → 214**
- **console.error/warn: 130 → 128**

### Total ratchet baselines locked: 16

### Tests 667 → 980 (+313 across full session)

### Three new primitives shipped with full test coverage:
- `AguilaTextarea` (+10 tests)
- `AguilaPasswordInput` (+10 tests)
- `scripts/ratchet-bump-advisor.sh` (used 23× this session)

### 21 pages migrated to Aguila form primitives:
`/signup` · `/demo/request-access` · `/cotizacion` ·
`/usmca/certificados/nuevo` · `/oca/nuevo` · `/cliente/reportar-problema` ·
`/cambiar-contrasena` · `/admin/onboard` · `/admin/aprobaciones` ·
`/admin/aprobar` · `/admin/_components/ActionEngine` · `/admin/auditoria` ·
`/admin/quickbooks-export` · `/admin/carriers` · `/admin/notificaciones` ·
`/mve/alerts` · `/upload/[token]` · `/bodega/recibir` ·
`/operador/cola/ExceptionModal` · `/clasificar` ·
`/embarques/[id]/clasificacion/ConfigForm` · `/clientes/[id]/configuracion`
(via FieldPrimitives) · `/proveedor/[token]` ·
`/embarques/[id]/legacy/NotasTab`.

### GlassCard adoption across 21 surfaces:
operador/inicio (7) · operador/inicio/RightRail (2) ·
embarques/[id]/Cronologia · AdminHeroStrip · AdminRightRail ·
admin/shadow (2) · admin/patentes · admin/demo (2) · /monitor (2) ·
pago-pece · /transportistas (2) · /kpis GlassPanel ·
ConfigEditor completeness · fracciones (2) · operador/subir (3) ·
admin/operadores header + table · ConfigEditor · banco-facturas (2) ·
bodega/patio (2) · clientes-dormidos (2) · vencimientos (2) ·
QB-export (3) · ClienteObservaciones (3) · operadores/[id] (3) ·
TransportistasTab (2) · operadores EmptyState.

### DetailPageShell adoption: 4 detail routes
`/embarques/[id]` · `/catalogo/fraccion/[code]` · `/oca/[id]` ·
`/anexo-24/[cveProducto]`.

### What's explicitly NOT migrated (intentional preservation)

- Login ENTRAR button (gray — ceremonial, design-system locked)
- KPICard premium tile (top-accent + radial glow — distinctive chrome)
- Gradient-text h1s on admin/operadores/[id] (intentional effect)
- NotasTab modern version with MentionAutocomplete + textareaRef
- DropZone uploaders (drag-active conditional border)
- Modal overlays (use their own dark backdrop pattern)
- Sticky toasts + action bars (position coupling)
- Toggle buttons acting as glass cards (semantic element clash)
- Nav tablist elements (lose role/aria-label semantics)
- Comunicaciones inline (Tailwind chrome, different system)
- Mensajeria message composers (Enter-to-send + autosize coupling)

### Pending (blocked on external work)

- **scripts/ silent-catch baseline 153** — fix on `fix/pdf-react-pdf-literal-colors-2026-04-19` branch hasn't merged to main. Task #9 stays pending.

### Guards fired throughout

- **Client calm-tone** — caught mock "Requiere tu atención" hero
  before `/inicio` render
- **Audit-agent hallucination** — rejected 7/10 agent-claimed gaps
  after grep verification
- **Customs domain invariants** — pedimento spaces preserved, fracción
  dots preserved, both tested in DetailPageShell primitive

### Gates at handoff

`npm run typecheck` · 0 errors
`npx vitest run` · 980/980 passing (0 skipped)
`bash scripts/gsd-verify.sh --ratchets-only` · 0 failures · 24 warnings (all at-floor)
`npm run build` · compiles clean

---

## Extension part 3 — third wind (9 more commits · 36 → 45 total)

| Commit | Change | Impact |
|---|---|---|
| `cd4cee1` | ApprovalQueue + ActionEngine 2 textareas → AguilaTextarea | form 59→61 |
| `64ea0e6` | AdminHeroStrip + AdminRightRail cards → GlassCard | backdrop 169→167 |
| `cddec34` | /admin/shadow GlassShell + insufficient card → GlassCard | backdrop 167→165 |
| `bf1ad25` | /admin/patentes card → GlassCard | backdrop 165→164 |
| `12b1f3c` | /admin/notificaciones Activa toggle → AguilaCheckbox | form 61→62 |
| `0df3d1f` | /admin/carriers 8 fields → Aguila primitives | form 62→70 |
| `1088628` | /admin/auditoria 5 filter fields → Aguila primitives | form 70→75 |
| `9e67000` | /admin/quickbooks-export 4 fields → Aguila primitives | form 75→79 |
| `5523774` | /upload/[token] supplier recommend → AguilaInput | form 79→81 |
| `7fe2b30` | /anexo-24/[cveProducto] → DetailPageShell | DetailPageShell 3→4 |
| `42dbfd8` | /admin/demo DemoRunner 2 sections → GlassCard | backdrop 164→162 |
| `04a876b` | /monitor filter + table card → GlassCard | backdrop 162→160 |
| `9413858` | PagoPece form wrapper → GlassCard | backdrop 160→159 |
| `a73d995` | /transportistas list + aside → GlassCard | backdrop 159→157 |
| `52567ba` | /kpis GlassPanel helper → GlassCard | backdrop 157→156 |
| `7ab018d` | ConfigEditor completeness panel → GlassCard | backdrop 156→155 |

**Cumulative marathon state (final):**

- **45 commits** on `main`
- **980 tests passing** (667 → 980 over the session · +313)
- **15 ratchet baseline locks** total across the session:
  - INVARIANT_HEX 662→619 · CRUZ 218→214 · fontSize 385→302 ·
    console 130→128 · gold 12→11 · portal-rgba 60→57
  - PORTAL_IMPORT 3→6 · TAILWIND_HEX 13→0
  - AGUILA_DT 0→2 · AGUILA_FORM **0→81** · DETAIL_SHELL 1→4
  - PORTAL_BACKDROP **179→155**

**Forms migrated to Aguila primitives across 13 pages:**
`/signup` · `/demo/request-access` · `/cotizacion` ·
`/usmca/certificados/nuevo` · `/oca/nuevo` · `/cliente/reportar-problema` ·
`/cambiar-contrasena` · `/admin/onboard` · `/admin/aprobaciones` ·
`/admin/aprobar` · `/admin/_components/ActionEngine` · `/admin/auditoria` ·
`/admin/quickbooks-export` · `/admin/carriers` · `/admin/notificaciones` ·
`/mve/alerts` · `/upload/[token]`.

**GlassCard migrations across 12 admin + operational surfaces** — removed
24 inline backdropFilter references from the codebase via primitive
composition (rather than just muting them).

**DetailPageShell migrations across 4 detail routes:** `/embarques/[id]` ·
`/catalogo/fraccion/[code]` · `/oca/[id]` · `/anexo-24/[cveProducto]`.

**Three primitives shipped this session:**
- `AguilaTextarea` (+10 tests)
- `AguilaPasswordInput` (+10 tests) with eye-toggle
- `ratchet-bump-advisor.sh` (automation — used 17× this session)

---

## Extension part 2 — continued further (5 more commits)

| Commit | Change | Impact |
|---|---|---|
| `8dfc98d` | /cliente/reportar-problema → AguilaInput + Textarea | form 46→48 |
| `e47059d` | **AguilaPasswordInput primitive** (+10 tests) + migrate /cambiar-contrasena | form 48→51 · fontSize 305→302 |
| `9dfec87` | /admin/onboard step-1 → AguilaInput × 5 | form 51→56 |
| `b0c3803` | /admin/aprobaciones PedimentoDetail 2 textareas → AguilaTextarea | form 56→58 |
| `fc9203f` | /mve/alerts "Mostrar resueltas" → AguilaCheckbox (first AguilaCheckbox adoption!) | form 58→59 |

**AguilaPasswordInput** ships with:
- Eye/EyeOff toggle on the right (44px touch target, aria-label in Spanish)
- `aria-pressed` reflects visibility
- Internal state (type is Omit'd from props)
- padding-right: 52 so value never overlaps the toggle
- Full hint/error/required envelope matching AguilaInput

Ratchet R9 now matches `AguilaInput|AguilaSelect|AguilaCheckbox|AguilaTextarea|AguilaPasswordInput`.
Header renamed "Aguila form primitives adoption" to reflect the
broader scope.

**Cumulative marathon state (on top of the 13 in the main table):**

- **26 commits** on `main`
- **980 tests passing** (was 941 at 3fe2cda · +39 this extension)
- **14 ratchet baseline locks** total across the session:
  - INVARIANT_HEX 662→619 · CRUZ 218→214 · fontSize 385→302 ·
    console 130→128 · gold 12→11 · portal-rgba 60→58
  - PORTAL_IMPORT 3→6 · TAILWIND_HEX 13→0
  - AGUILA_DT 0→2 · AGUILA_FORM 0→59 · DETAIL_SHELL 1→3
  - PORTAL_BACKDROP 179→169

Forms migrated to Aguila primitives across 9 pages:
`/signup` · `/demo/request-access` · `/cotizacion` ·
`/usmca/certificados/nuevo` · `/oca/nuevo` · `/cliente/reportar-problema` ·
`/cambiar-contrasena` · `/admin/onboard` · `/admin/aprobaciones` ·
`/mve/alerts`. Seven local helper components deleted
(Input · Field · 3× inputStyle + labelStyle triplets · 3× inline
password toggle patterns).

**Two new primitives shipped:**
- `AguilaTextarea` (+10 tests) — label+required+hint/error envelope
  for multi-line input
- `AguilaPasswordInput` (+10 tests) — eye-toggle + full ARIA +
  padding-right preserved for value

---

*Signed 2026-04-20 · Renato Zapata IV via autonomous delegation.*
*Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941*
