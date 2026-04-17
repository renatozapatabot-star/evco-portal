# CRUZ v3 · Command Experience — 10/10 Plan

**Status:** Approved by Renato IV 2026-04-19 as founder
**Scope:** Reimagine CRUZ's primary experience around search-first interaction, unified expediente, and a web-grade (not just customs-grade) design standard.
**Thesis:** The most beautiful brokerage portal is one that doesn't feel like a brokerage portal. It feels like Linear for customs.

---

## Why this, why now

Today's flow takes 4 taps to reach a pedimento from `/inicio`:
`/inicio` → nav tile `Pedimentos` → list scroll → row tap → detail.

Every brokerage portal in the market does exactly this. That's the opportunity: our customers are used to it, so landing them in a 2-tap command experience (⌘K → type → enter) feels magical.

Renato's direction (2026-04-19):
> "Everything should start off with a search like a Google search with an advisal that can lead to the whole expediente. This is the new theme and this is the new standard. Make it a 10/10 design wise not just for a customs portal but a web design and experience. Permission with typography colors font experience everything can be changed if it increases overall experience."

---

## The five shifts

### 1. Search-first landing — `CruzCommand`

A universal command bar anchors every authenticated page, not just /inicio. Glass chemistry (hero tier, backdrop saturate), rounded 14px, 60px tap target, placeholder cycles through hints.

**Interactions:**
- **Idle** — placeholder cycles every 3s: "Busca un pedimento… un embarque… una factura… un SKU… una fracción…"
- **Focused + empty** — drops a glass dropdown with "Acciones rápidas" (last trafico, last pedimento, latest factura, upload doc, ask CRUZ)
- **Typing** — live results from hardened `/api/search`, organized by entity type with icons:
  - `#` prefix or 7-digit match → Pedimento row, enter opens PDF
  - `T-` prefix or known cve_trafico shape → Trafico row, enter goes to /embarques/[id]
  - SKU-like → Anexo 24 part
  - Free text → fuzzy across descripciones, proveedores, fracciones
- **Question mark detection** (`?` in query or 4+ words) → promotes "Ask CRUZ" row to top, enter opens CRUZ chat with the query pre-filled
- **Keyboard** — ⌘K focuses from anywhere, ↑↓ navigates, Enter picks, Esc closes
- **Mobile** — tap expands to full-screen sheet; same keyboard navigation works with Bluetooth keyboards

**Design:**
- Backdrop blur(20px) saturate(1.2), hero-tier glass
- Gold cursor in input on focus
- Subtle "listening" shimmer when CRUZ AI mode active
- Results dropdown renders as glass tertiary tier, stagger-in for each row (60ms per)

### 2. /inicio as a command-first home

The 6-nav-tile layout stays (invariant #29) but is **demoted** below the command bar. The hero of /inicio becomes:

```
╔═══════════════════════════════════════════╗
║      ◼ CRUZ · Renato Zapata & Company       ║
║                                                  ║
║   ┌──────────────────────────────────────┐   ║
║   │ 🔍  Busca un pedimento…              ⌘K│   ║
║   └──────────────────────────────────────┘   ║
║                                                  ║
║   · Último cruce: TRF-3847 · hace 2 días       ║
║   · Pedimentos esperando: 0                     ║
║   · Nuevo este mes: 27 SKUs clasificados       ║
║                                                  ║
║   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   ║
║   [6 nav tiles]                                  ║
║   [Morning briefing]                             ║
║   [Actividad strip]                              ║
╚═══════════════════════════════════════════╝
```

Three "what matters right now" facts as a single stripe — replaces the KPI tile strip above the fold. KPI tiles move below the nav, for the auditor moment.

### 3. Unified expediente view

Renato's insight: "we have pedimento embarque and expediente and all these things showing the same thing."

Today's reality: `/pedimentos`, `/embarques/[id]`, `/expedientes` are three nav destinations but they describe one journey (the trafico from creation to cross). The timeline view shipped this session made the journey visible; v3 collapses the three destinations into one surface.

**New model:**
- `/embarques/[id]` becomes the canonical "expediente digital" page
- Above the fold: **cinematic timeline** (just shipped, 7 milestones)
- Below timeline: **3 tabs on glass pill** — `Pedimento · Documentos · Mercancía`
  - `Pedimento` — pedimento number, fechas, DTA/IGI/IVA, download PDF, payment status
  - `Documentos` — required-docs checklist, uploaded files, missing prompts with one-tap upload
  - `Mercancía` — partidas with per-SKU link to Anexo 24, valor breakdown, T-MEC summary
- Each tab slides in with the `--ease-brand` curve over 250ms

**Nav destinations kept for list semantics:**
- `/pedimentos` stays as the list of all pedimentos (filter + search)
- `/expedientes` stays as the list of expedientes (one per trafico; row → tapped goes to `/embarques/[id]?tab=documentos`)
- `/embarques` stays as the list of traficos
- The single detail page handles all three nav destinations

### 4. Typography + color refinement

Minor adjustments only — the 2026 theme base (Geist / JetBrains Mono / silver-on-near-black with gold CTA) is already top-tier. Tune:

- Headline weight `700 → 600` across page titles (Linear/Arc feel: confident without being heavy)
- Body line-height `1.5 → 1.55` (one-notch more breathing room for longer Spanish paragraphs)
- Section labels stay at 10px / 0.12em tracking / semibold (unchanged — already sharp)
- New `--color-cta-gold-hover` = `#F4D47A` + 8% brightness boost on active press
- Add `font-variant-numeric: tabular-nums stacked-fractions` on `.font-mono` so 1/2 renders as a stacked fraction glyph when it shows up (no-op for most content but lands premium for pedimento formulas)
- Inter's `cv11` (alternate simpler i/l) already enabled. Add `ss01` (geometric a) at the `html` root for crisper glyph shapes in all chrome copy.

### 5. Nav treatment

Today's nav is six glass tiles on the home shell. v3 keeps them (invariant #29) but makes them a **persistent nav pill** anchored to the page:

**Desktop** — a pill in the top-bar, visible on every authenticated page:
```
◼ CRUZ    [🔍 search]    · Embarques · Pedimentos · Expedientes · Catálogo · Entradas · Anexo 24    ◉ profile
```

**Mobile** — two-line stack:
1. Top-bar: logo + search icon + profile
2. Bottom floating pill with the 6 nav items as 60px tap pills (swipeable on overflow)

- Active route: gold underline on desktop, gold pill on mobile
- Hover lift: `-2px` with amplified drop shadow (same --ease-brand)
- Tap: scale 0.98 / 90ms

---

## What can ship tonight (Block L–N)

Realistic 3-hour window. Priorities:

1. **Block L — Universal CruzCommand bar** (2 hrs)
   - Build the component, hook to `/api/search`, keyboard shortcut, AI mode routing
   - Mount in DashboardShellClient so it shows on every authenticated page
   - Render in the home hero of `/inicio` as the primary moment

2. **Block M — Expediente tab unification** (45 min)
   - Below the timeline on `/embarques/[id]`, add glass-pill tabs
   - Refactor BelowFold into 3 tab panes
   - `/expedientes?trafico=X` redirects to `/embarques/X?tab=documentos`

3. **Block N — Typography + nav polish** (30 min)
   - `html { font-weight: 400 }` baseline + headline weight tune
   - Nav pill treatment on top-bar when space allows
   - Motion choreography for search → results

4. **Block O — Audit + deploy + report** (30 min)

## What defers to next session

- Full mobile bottom-sheet nav with swipe (v3.1)
- CRUZ AI tool calling integrated into command bar (v3.2)
- Animated transitions between tabs on the expediente page (v3.3)
- Font swap from Geist to Söhne or Grotesk variant (only if Renato asks explicitly after seeing v3)

---

## Success criteria

- 2-tap average from `/inicio` to any detail (measured by clicks in session replay)
- Zero regression on the 6 nav tiles per invariant #29
- Lighthouse performance ≥ 90 mobile
- Chrome walkthrough on iPhone 15 Pro: command bar feels native, timeline reads cinematic, tabs on detail feel unified
- No new SEV-1 leaks (client isolation audit extended through new command bar's search usage)

---

## Permission captured

Renato IV, as CRUZ founder (2026-04-19), granted:
- Typography adjustments within the existing font families
- Color-system tweaks within the silver + gold + semantic palette (no new hues)
- Experience redesigns that preserve invariants #12, #13, #14, #24, #29, #31, #36
- Override of invariant #29's layout if the 6 tiles remain present (reordering/re-treating is allowed)

Tito advisory on anything that changes what a client can see. Renato owns platform decisions.
