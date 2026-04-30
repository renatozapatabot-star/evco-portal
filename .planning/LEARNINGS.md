# AGUILA — Institutional Memory

Append-only record of architecture decisions, failed patterns, and
client-specific knowledge that should not be re-derived every session.

---

## 2026-04-13 — Theme sweep, v5 language superseded

- `.aduana-dark` class retired. Every authenticated page composes from
  `<PageShell>` + `<GlassCard>` (`src/components/aguila/`).
- Cyan-border rule in `core-invariants.md` (rule 2) was a v5 holdover that
  contradicted the April 2026 silver monochrome sweep. Borders now use
  `BORDER_HAIRLINE` from `src/lib/design-system.ts`. Decorative cyan, blue,
  gold, and navy are banned on authenticated surfaces.
- `design-system.ts` is the single token source of truth; rules docs
  describe intent only, never redefine hex/rgba values.
- Added `--aguila-fs-kpi-mega: 64px` for Catálogo-scale hero numbers
  (`KPITile` `variant="mega"`) and a background-sparkline option
  (`sparkVariant="background"`) matching the Entradas "32" screenshot.
- `AsistenteButton` added as first-class primitive. Client surface
  respects `NEXT_PUBLIC_MENSAJERIA_CLIENT` — renders muted "próximamente"
  state when disabled instead of hiding entirely.
- `CockpitInicio` now renders `AsistenteButton` for all three roles, so
  every cockpit home gets the floating action without per-page wiring.
- Canvas migration pass 1:
  - 17 `.aduana-dark` consumers swapped to `.aguila-dark` (invariant 1
    clean outside `components/aguila/`).
  - 8 pages promoted from flat `BG_DEEP` to `COCKPIT_CANVAS` + `aguila-dark`
    class: `/banco-facturas`, `/reportes`, `/admin/operadores`,
    `/admin/clientes-dormidos`, `/admin/quickbooks-export`, `/admin/demo`,
    `/corredor`, `/bodega/escanear`. All now render the silver radial
    wash that matches the screenshot baseline.
- Phase 4 remaining (deferred to follow-up session):
  - Chrome-migrate `/mve/alerts`, `/riesgo-auditoria`, `/bienvenida`,
    `/bodega/page.tsx`, `/bodega/[inicio,patio,recibir,subir]`,
    `/traficos` list, `/pedimentos` list, `/expedientes` list,
    `/entradas`, `/catalogo`, `/clasificar`, `/usmca`, `/calendario`,
    `/immex`, `/soia`.
  - ~2,299 hardcoded `fontSize: N` values in `src/app/**` (invariant 27
    drift). Requires per-site judgment — not a blind sed sweep. Intended
    pattern: primitives define the scale; app pages consume
    `var(--aguila-fs-*)` instead of pixel literals.
  - Inline card backgrounds (`rgba(255,255,255,0.03)`) on client shells
    like `BancoFacturasClient.tsx` — invariant 26 violations that should
    compose from `<GlassCard>` instead.

---

## 2026-04-17 — Block DD Phase 3 complete, PORTAL cascade live

The PORTAL rebrand (Block DD Phase 1-2, 2026-04-17 morning) shipped
the tokens + the .portal-* CSS + grain overlay + theme switcher but
**not the screens**. Cockpits still rendered the old glass chemistry
because GlassCard / KPITile / the .aguila-dark scope re-declared their
own tokens. Renato asked "my design upgrade looks exactly the same —
what happened" at 2026-04-17 PM. The answer: Phase 3 (screen migration)
had never run.

Strategy that worked — **cascade through three choke points**:

1. **Phase 0 — build React primitives** over the .portal-* CSS so
   consumers can opt in with one import instead of hand-writing
   `<div className="portal-card portal-card--hero">`:
   PortalCard, PortalButton, PortalMetric, PortalBadge, PortalSection,
   PortalModulesGrid, PortalSparkline, PortalInput, PortalLabel,
   PortalTabs, PortalStickyTopbar, PortalTable, PortalListPage,
   PortalTheaterAnimation + typography helpers. Gallery lives at
   `/admin/design`. 30 unit tests green.

2. **Phase 1 — rewrite GlassCard + KPITile + CockpitBanner +
   AguilaFooter internals** to compose the Portal primitives. External
   APIs preserved, so 48+ downstream consumers inherited the new skin
   invisibly. The retired inline chemistry (`rgba(0,0,0,0.4)` +
   `backdrop-filter: blur(20px)` + silver inset edge) stopped being
   load-bearing after this single commit.

3. **Phase 3 — rewire `.aguila-dark` scope's legacy tokens** to
   `--portal-*` equivalents in globals.css. `.table-shell`,
   `.kpi-card`, `.page-shell`, `.filter-chip` — every consumer of
   `var(--bg-card)`, `var(--border-card)`, `var(--glass-shadow)`
   inherited the new chemistry. One 30-line change cascaded to the
   remaining 60+ list pages that Phase 1 didn't reach through
   GlassCard.

Detail pages (Phase 4): `/embarques/[id]` got the 5-act theater
animation above tabs (filing · acceptance · clearance · exit ·
archived) driven by `trafico.estatus` via `actFromStatus()`. The
active act breathes (gated by prefers-reduced-motion), completed
acts glow silver, upcoming acts ghost. HeroStrip rewritten to use
`<PortalCard tier="hero">`. Tab panel chrome swapped to `<PortalCard>` +
portal tokens. Six tabs (Pedimento · Documentos · Mercancía ·
Cronología · Notas · Comunicación) inherited the new chrome.

Ratchets added (Phase 6):
- `PORTAL_INLINE_HERO_BASELINE=60` — inline `rgba(0,0,0,0.4/.25/.12)`
  count on consumer files. Target 0.
- `PORTAL_BACKDROP_BASELINE=179` — inline `backdropFilter` count
  outside primitives. Target 0.
- `PORTAL_IMPORT_BASELINE=3` — `@/components/portal` imports (↑).
Each ratchet auto-promotes on improvement per the block-discipline
convention.

Numbers before/after:
- Test suite: 637 → 667 (+30 PORTAL primitive tests). All green.
- GlassCard direct consumers: 48 files (unchanged, now cascading).
- `.portal-*` class usage: 4 → 10+ files.
- `@/components/portal` imports: 2 → 3 files (HeroStrip, TraficoDetail,
  + cascade through GlassCard).
- Bundle size: no regression, build compiled successfully in 6.7s.
- Production: deployed to portal.renatozapata.com via `npm run ship`,
  all 6 gates green.

What NOT to do next time:
- Don't create a parallel primitive namespace if one already exists.
  Invariant #25 pushed us toward rewriting `<KPITile>` internals
  rather than building a parallel `<PortalKPITile>`. The cascade
  works because the API contract stays stable.
- Don't chase every inline-style violation page by page. Identify
  the 2-3 token choke points (in globals.css + primitives) and
  redirect them. One `--bg-card → var(--portal-ink-1)` redefinition
  moved 60+ files.
- Don't skip the primitives React wrapper step. CSS-class-only adoption
  plateaued at 4 files because hand-writing `<div className=...>` is
  friction. Build the wrappers + reference gallery + tests first.

What the next block should do:
- Cleanup pass against the three new ratchets — each file that still
  inlines `rgba(0,0,0,0.4)` or `backdropFilter` gets swapped to
  `<PortalCard>`. Ratchets auto-pass on improvement; update the
  baseline in `gsd-verify.sh` when counts drop.
- Playwright screenshot baselines per Tier-1 route (deferred in
  this block — Phase 6 shipped counters only).
- Lighthouse CI on `/login`, `/inicio`, `/embarques`, `/embarques/[id]`.

---

## Block FF · theme/v6-migration primitives + drift cleanup (2026-04-19)

**Context:** Full-scope audit surfaced that only 12/183 authenticated
pages were v6-compliant (6.6%) and that the design system itself had
internal drift — gold hex split across three conflicting definitions
(`#C9A84C` in `tokens.ts` + `tailwind.config.ts` vs canonical `#C9A74A`
in `design-system.ts`), orphan `design-tokens.ts` `statusConfig` with
zero consumers, and no `<AguilaDataTable>` primitive forcing every list
page to reinvent `.portal-table` markup. Planned ~40 hours of work
across 7 phases; executed Phase 0 + Phase 1 + 1/5 Phase 2 structural +
9 drift-tokenization passes across one long marathon.

**What shipped (branch `theme/v6-migration`, 24 commits):**
- Phase 0.1-0.2: Gold consolidated to canonical `#C9A74A` across
  `design-system.ts`, `tokens.ts`, `tailwind.config.ts`. Published
  `--portal-gold-50..800` and `--portal-semaforo-{verde,amarillo,rojo,
  none}-{bg,fg}` tokens in `portal-tokens.css`.
- Phase 0.3: `formatFraccion()` gained 10-digit NICO-suffixed support
  (XXXX.XX.XX.NN) + 18 regression tests locking core-invariant #8.
- Phase 0.4: `<SemaforoPill>` dropped inline rgba for `var(--portal-
  semaforo-*)` — palette change now cascades without hunting.
- Phase 0.5: `<AguilaDataTable>` primitive with 9 column types
  (text/pedimento/fraccion/currency/semaforo/status/number/date/custom)
  composing `<PortalTable>` + auto-routing the cell-renderers. 8 tests
  via `renderToStaticMarkup` (mirrors `<PortalTable>` test pattern
  because `vi.mock('next/navigation')` + `@testing-library/react` does
  not reliably resolve Next's hooks).
- Phase 0.6: `<DetailPageShell>` + `<AguilaBreadcrumb>` unified `[id]`
  route chrome. `titleKind` drives pedimento/fraccion/id formatting;
  `sidebar` yields 2-col at ≥1024px and single-col below.
- Phase 0.7: `<AguilaInput>` + `<AguilaSelect>` + `<AguilaCheckbox>`
  form envelope with label + hint + error. `forwardRef`-aware.
- Phase 0.8: `<StatusBadge>` added `variant='dark'` (new default)
  reading through `--portal-status-*` tokens. Back-compat `variant=
  'light'` kept for warm-white legacy callers.
- Phase 1: 5 new ratchets in `gsd-verify.sh` — tailwind-hex (floor 27),
  inline-@keyframes-outside-design-system (floor 57), and
  positive-direction adoption counters for the 3 new primitives.
- Phase 2: `/status` rewrite + 9 drift tokenization commits across
  `/anomalias`, `/health`, `/usmca/certificados`, `/simulador`,
  `/usmca` + `/oca` ApproveActions, `/comunicaciones`, `/kpis`,
  `/oca`, `/catalogo/CatalogoTable`, `/clasificar/BulkTab`,
  `/clasificar/ClasificarNuevoTab`.

**Ratchet deltas (all locked):**
- INVARIANT_HEX_BASELINE: 2722 → 2658 (−64 inline hex)
- INVARIANT_2 (gold): 18 → 17
- INVARIANT_CRUZ: 218 → 217

What Block FF proved:
- **Primitives-first cascades better than page-first.** One
  `--portal-semaforo-verde-bg` token redirect in Phase 0.4 landed at
  8 consumer files transparently. Hand-editing the same rgba in every
  consumer would have been 10× the work.
- **Back-compat by aliasing beats rename churn.** `GOLD` still exports
  the same value it did pre-rebrand because it resolves to
  `ZAPATA_GOLD_BRIGHT`. Zero consumer breaks despite a canonical-hex
  swap underneath.
- **Mechanical hex → token swaps scale linearly** with page count when
  the target token already exists. Each drift-cleanup commit takes
  3-8 minutes including typecheck. 9 commits dropped hex by ~45.
- **The `renderToStaticMarkup + vi.mock('next/navigation')` pattern**
  is the right test shape for primitives that wrap PortalTable et al.
  `@testing-library/react` fights with Next's hooks unreliably.

What Block FF did NOT attempt (deferred):
- `<AguilaModal>` — blocked on Phase 5.2 (`/cliente/reportar-problema`
  heavy lift). Deferred from Phase 0.7 because it wasn't yet needed.
- `<AguilaWizard>` — blocked on Phase 5.4 (`/admin/onboard` rewrite).
- `/proveedor/[token]` — blocks on Tito's explicit approval (external
  supplier contract). Carve out with `// @theme-exempt:
  supplier-contract` marker when Phase 5.5 ships.
- Phase 3 codemod (`scripts/codemod-theme-v6.js`, jscodeshift) — the
  remaining 67 partial-drift pages are 90% mechanical. A single
  codemod run should drop hex count by ~500 in one commit.
- Phase 4 detail routes (`/embarques/[id]`, `/pedimentos/[id]`,
  `/expedientes/[id]`) adopting `<DetailPageShell>`. Highest visibility
  target; recommend sequencing before Phase 3 for ROI.

**The parallel-session branch-thrashing incident** — see
`.claude/rules/parallel-sessions.md`. Codified 2026-04-19.
Short version: never run two autonomous Claude sessions on sibling
branches in the same working directory; every commit-cycle costs 3-5×
more due to branch-swap reverts.

What the next block should do:
- Build `scripts/codemod-theme-v6.js` jscodeshift codemod with three
  transforms: literal retired-gold hex → `var(--portal-gold-500)`,
  `{amount.toLocaleString(...)}` → `<PortalNum>` wrap, raw `<div style={{
  background: 'rgba(255,255,255,0.04)', backdropFilter... }}>` →
  `<GlassCard tier="secondary">`. `--dry-run` → diff review → `--apply`.
- Phase 4 before Phase 3: migrate `/embarques/[id]`, `/pedimentos/[id]`,
  `/expedientes/[id]` to `<DetailPageShell>`. Three commits, moves R9
  from 0 to 3, and those are the three most client-visible detail pages.
- Complete Phase 2 remainders (`/alertas-internas`, `/excepciones`,
  `/banco-facturas`) as dedicated sessions — each 200-800 LOC client
  component needs its own focused pass.
- Retire the warm-white `canvas: '#FAFAF8'`, `bg-primary: '#FAFAF8'`,
  `bg-card: '#FFFFFF'`, `textColor.primary: '#1A1A1A'` extends in
  `tailwind.config.ts`. Pre-v6 values kept only for back-compat. R7
  tailwind-hex ratchet catches the regression.
- Delete orphan `src/components/aguila/design-tokens.ts` (`statusConfig`
  + `TraficoStatus` type have zero consumers). Move the type to
  `@/types/supabase` if retained.


---

## 2026-04-24 · V1 Clean Visibility audit — 3 deferred FLAGs

After PR #1 (V1 reset, b29e627) merged, a three-subagent audit
(security-auditor / aduanero / reviewer) found 5 BLOCKs and 6 FLAGs.
PR #2 (b8da4ba) hotfixed all 5 BLOCKs and 3 FLAGs. The remaining 3
FLAGs are deferred here for the next session:

**FLAG-01 — `src/app/api/auditoria-pdf/pdf-document.tsx:193,242`**
The audit PDF strips the `DD AD PPPP ` prefix and renders only the
7-digit sequential pedimento number. May be intentional column-width
truncation, may be a format compliance issue under Art. 59-A Ley
Aduanera. Owner: Tito to review whether the audit PDF format is SAT-
acceptable as-is. Action if regulatory issue: revert truncation; widen
the column or wrap. Action if approved: add inline comment documenting
that the truncation is intentional and Tito-approved with date.

**FLAG-02 — `src/lib/pedimentos/clearance.ts` vs `src/lib/cockpit/success-rate.ts` divergence**
`CLEARED_STATUSES` includes `Entregado` + `Completo`; `SUCCESS_ESTATUSES`
includes `Desaduanado` instead. Zero rows in current data for any of
the three on Patente 3596 (only Cruzado / E1 / Pedimento Pagado / En
Proceso emit). Future client (MAFESA, Tier-1) may emit `Desaduanado`
and the cockpit success-rate KPI would diverge from the /pedimentos
list page Cleared/Not cleared label. Action: align both sets to one
canonical list, with a comment citing the inventory-statuses.js output
date the list was validated against. Run before MAFESA activation.

**FLAG-03 — `.claude/rules/design-system.md` v7 section stale**
Says "Six nav cards" with `traficos / pedimentos / expedientes /
catalogo / entradas / clasificaciones`. Now five cards per V1 reset.
Doc-only drift; a future Claude session reading this file will be
misled toward the prior tile list. Action: append `[SUPERSEDED
2026-04-24 by founder-overrides.md]` marker above the table, OR update
the table to match `UNIFIED_NAV_TILES`. Owner: Renato IV at next polish
pass.

**Process learning:** running `gsd-verify --ratchets-only` is NOT
sufficient pre-merge; the full `gsd-verify.sh` catches drift the
ratchet-only mode silently passes. Update the ship.sh Gate 1 to run
the full suite, with a dedicated `--ship-gates` mode that exits
non-zero only on NEW failures (delta vs main).

**Process learning #2:** subagent-only audits scale beyond what the
operator can review by hand. The 3-subagent panel (security-auditor /
aduanero / reviewer) on this audit found 5 BLOCKs that no single agent
caught — F1b internal-role bypass was security-auditor; fecha_cruce
miss was aduanero; scroll-lock + 60px were reviewer. Use the parallel
panel pattern on every future ship-gate audit, not just on
controversial changes.
