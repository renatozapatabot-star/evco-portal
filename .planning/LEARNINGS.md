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
