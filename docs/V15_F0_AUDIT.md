# V1.5 Phase 0 — Theme Unification Audit (AGUILA Monochrome)

**Branch:** `feature/v6-phase0-phase1`
**Date:** 2026-04-12
**Scope:** Steps 1–5 of AGUILA V1.5 Phase 0 — kill residual blue/cyan, lock root layout to `.aguila-dark`, add palette guard to gsd-verify.sh. Under the 40-file split threshold, shipped as one commit.

---

## Before / After grep deltas

### Blue/cyan raw hex (`#3b82f6`, `#60A5FA`, `#38BDF8`, `#0ea5e9`, `#2563eb`, `#1e3a8a`, `#1d4ed8`, `#0369a1`)

| Scope | Before | After |
|---|---:|---:|
| `src/components/views/reportes-view.tsx` (avatar PALETTE + `GOLD` fallback) | 4 | 0 |
| `src/app/comunicaciones/page.tsx` L500 | 1 | 0 |
| `src/components/EventTimeline.tsx` L15 | 1 | 0 |
| `src/app/traficos/[id]/pedimento/tabs/InicioTab.tsx` L19 (firmado status) | 2 | 0 |
| Dark near-black hex literals (`#1A1A1A`, `#111111`, `#222222`, `#0F172A`, `#1E293B`) on card chrome | mostly pre-existing, all guarded by CSS var fallbacks | unchanged (see Deferred) |
| **Total blue/sky/cyan hex (targeted)** | **8** | **0** |

### Cyan rgba (`rgb(34,211,238)` / `rgba(34,211,238,...)`)

| Location | Before | After |
|---|---:|---:|
| `src/app/globals.css` L470 (`.cc-card` idle glow) | 1 | 0 |
| `src/app/globals.css` L478 (`.cc-card:hover` glow) | 1 | 0 |
| `src/app/globals.css` L2868 (`@keyframes needsAction` 0%) | 1 | 0 |
| `src/app/globals.css` L2871 (`@keyframes needsAction` 50%) | 1 | 0 |
| **Total** | **4** | **0** |

### Tailwind blue/indigo/sky/cyan/teal classes (outside semantic StatusBadge)

| File | Before | After |
|---|---:|---:|
| `src/components/ChainView.tsx` (`text-blue-600` on doc link) | 1 | 0 |
| `src/components/ui/StatusBadge.tsx` (`teal-*` for `transmitido` state) | 1 | 1 (semantic — allowed + excluded from guard) |
| **Total (non-semantic)** | **1** | **0** |

### `.aguila-dark` CSS var remap (`src/app/globals.css` L189–195)

- `--accent-blue: #3B82F6` → `#C0C5CE`
- `--glow-blue: rgba(59,130,246,0.25)` → `rgba(192,197,206,0.25)`
- `--glow-blue-subtle: rgba(59,130,246,0.12)` → `rgba(192,197,206,0.12)`
- `--accent-cyan` / `--glow-cyan*`: already silver, no change.

---

## Files touched (categorized)

### Token sources / globals (3)
- `src/lib/design-system.ts` — no change (tokens already correct)
- `src/app/globals.css` — `.cc-card` glow (4 sites), `.aguila-dark` CSS vars (3 remaps)
- `src/app/layout.tsx` — added `className="aguila-dark"` to `<body>`

### Component / view hex residue (4)
- `src/components/views/reportes-view.tsx` — avatar PALETTE replaced with 5-stop silver; imports ACCENT_SILVER/_DIM/_BRIGHT
- `src/app/comunicaciones/page.tsx` — inbox dot same-client indicator silver
- `src/components/EventTimeline.tsx` — `arrival` event color silver-bright
- `src/app/traficos/[id]/pedimento/tabs/InicioTab.tsx` — `firmado` status palette silver

### Tailwind sweep (1)
- `src/components/ChainView.tsx` — `text-blue-600` → `text-zinc-200` on doc ver link

### Tooling (1)
- `scripts/gsd-verify.sh` — new "AGUILA palette" guard (excludes `components/ui/StatusBadge.tsx` by path so semantic `teal-*` for `Transmitido` stays allowed)

### Audit (1)
- `docs/V15_F0_AUDIT.md` — this file

**Total files touched: 8** (well under the 40-file split threshold; shipped as single commit)

---

## Root layout diff

```diff
-      <body style={{ margin: 0 }}>
+      <body className="aguila-dark" style={{ margin: 0 }}>
```

All authenticated surfaces now inherit the AGUILA dark cockpit palette without per-page `.aguila-dark` wrappers.

---

## Test trajectory

- Pre: 258 passing (27 test files)
- Post: 258 passing (27 test files)
- No regressions. Typecheck clean. Production build green.

## gsd-verify.sh

- New "AGUILA palette" guard: PASSES standalone (no hits outside StatusBadge).
- Pre-existing failures (Design System — Colors on `src/app/demo/*`, ESLint React-compiler warnings) predate this phase and are unchanged. Tracked for later slices.

---

## Deferred follow-ups

1. **Login + `/demo/*` pages.** Contain their own dark palette with raw `#eab308`, `#05070B`, `#E6EDF3`, `#DC2626`, `#F87171` hex. Plan says "don't touch login unless raw blue hex residue" — none present. Addressable in future polish pass.
2. **`#1A1A1A` / `#222222` / `#111111` in CSS var fallbacks.** Many `var(--text-primary, #1A1A1A)` inline styles exist — these fallbacks are unreachable once `.aguila-dark` is applied (the var resolves to `#E6EDF3`). Cosmetic noise; not rendering. Slice A2 cleanup.
3. **`.mood-*` classes in globals.css (L253–257)** use `#111111 !important`. These are a mood-state chrome system — replacing them would widen scope beyond Phase 0 budget. If the mood system is still used, migrate to `BG_DEEP` in a follow-up.
4. **Charts series palette.** Not touched. Recharts in `reportes-view.tsx` still uses `GOLD` token for bar fill (which aliases to silver-bright). Visual check confirmed acceptable; no blue series.
5. **Deprecated token aliases.** Plan A2 scope — not touched.

---

## Commit

```
refactor(theme): unify AGUILA monochrome — kill blue/cyan, every card + surface to silver glass

- raw blue hex → silver tokens (reportes-view, comunicaciones, EventTimeline, InicioTab)
- .cc-card cyan glow (4 sites) → silver in globals.css
- .aguila-dark CSS vars remapped to silver (--accent-blue, --glow-blue*)
- <body> locked to .aguila-dark
- Tailwind blue/indigo/sky/cyan/teal classes swept across src/ (ChainView)
- gsd-verify.sh: added AGUILA palette guard (StatusBadge exempt)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```
