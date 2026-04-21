# CRUZ Portal — Roadmap

## Tier 0 — Design Tokens (Complete)
- [x] Canonical `src/lib/design/tokens.ts` created
- [x] Tailwind fontFamily.sans updated (Geist first, DM Sans removed)
- [x] DM_Sans import removed from layout.tsx

## Tier 1 — Critical Fixes (Complete)
- [x] `StatusBadge` component created at `src/components/ui/StatusBadge.tsx`
- [x] `/reportes` and `/financiero` added to client nav (nav-config.ts)
- [x] Route pages verified: /cruces, /calendario, /simulador, /voz all exist as full pages

## Tier 2 — Component Consolidation (Planned)
- [ ] Migrate all inline StatusBadge implementations to `src/components/ui/StatusBadge.tsx`
  - `src/components/cruz/ui-primitives.tsx`
  - `src/components/TraficoDrawer.tsx`
  - `src/components/views/soia-view.tsx`
  - `src/app/documentos-legales/page.tsx`
- [ ] Replace old `src/components/cruz/design-tokens.ts` references with `src/lib/design/tokens.ts`
- [ ] Audit all pages for consistent badge usage

## Tier 3 — Typography Cleanup (Planned)
- [ ] Verify all financial/timestamp displays use JetBrains Mono
- [ ] Audit all date displays for `fmtDate()` usage (no English dates)
- [ ] Remove any remaining `--font-dm-sans` CSS references

## Tier 4 — Performance & Polish (Planned)
- [ ] Bundle size audit per route (target < 200KB JS)
- [ ] Skeleton loaders on all data-fetching pages
- [ ] Empty states audit (icon + message + action on every table)

## Tier 5 — Multi-Tenant Readiness (Planned)
- [ ] White-label dry-run: zero hardcoded `9254` or `EVCO` in production code
- [ ] Client-specific branding from `clients` config table
- [ ] RLS audit on all tables

## Tier 6 — Intelligence Features (Planned)
- [ ] Trade Index page
- [ ] Network intelligence dashboard
- [ ] Predictive compliance alerts (internal only)
- [ ] Enhanced CRUZ AI with 50+ tools
