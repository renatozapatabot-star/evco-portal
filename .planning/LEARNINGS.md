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
