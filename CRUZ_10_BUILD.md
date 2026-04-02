# CRUZ 10/10 PORTAL BUILD
## The Complete Visual Overhaul — April 2026
## Execute in Claude Code on Throne. One session at a time.

---

## PHILOSOPHY

Every page a client can see must feel like the same product.
Right now, some pages feel like v1 prototypes and some feel polished.
The gap is the problem. Consistency IS quality at this scale.

The north star: Stripe's dashboard + Linear's density + Palantir's authority.
The constraint: customs data, Spanish primary, 3 AM driver, 60px touch targets.

---

## BEFORE YOU START ANY SESSION

```bash
cd ~/evco-portal

# 1. Read the design system
cat TAB_2_FORGE.md

# 2. Confirm tsc passes
npx tsc --noEmit

# 3. Confirm what's deployed matches what's in git
git status
```

---

## PHASE 0 — GLOBAL FIXES (apply once, every page benefits)

### Session 0A: Kill Inline Styles Utility

Create a shared CSS module for patterns repeated across 20+ pages.

**File: `src/app/globals.css` additions**

```css
/* ── Page Shell ── */
.page-shell {
  padding: 32px;
  max-width: 1200px;
  margin: 0 auto;
  animation: fadeInUp 200ms var(--ease-enter);
}

@media (max-width: 768px) {
  .page-shell { padding: 16px; }
}

/* ── Section Header ── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

/* ── KPI Grid ── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 768px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}

/* ── KPI Card ── */
.kpi-card {
  background: var(--bg-card);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-xl);
  padding: 20px;
  transition: box-shadow 200ms ease, transform 200ms ease;
}

.kpi-card:hover {
  box-shadow: var(--shadow-elevated);
  transform: translateY(-1px);
}

.kpi-card-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--slate-400);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.kpi-card-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--navy-900);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  margin-top: 4px;
  line-height: 1.2;
}

.kpi-card-note {
  font-size: 11px;
  color: var(--slate-400);
  margin-top: 6px;
}

/* ── Table Shell ── */
.table-shell {
  background: var(--bg-card);
  border: 1px solid var(--border-card);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-card);
  gap: 12px;
  flex-wrap: wrap;
}

/* ── Filter Bar ── */
.filter-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-chip {
  font-size: 12px;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 9999px;
  border: 1px solid var(--border-card);
  background: var(--bg-card);
  color: var(--slate-500);
  cursor: pointer;
  transition: all 150ms ease;
  white-space: nowrap;
}

.filter-chip:hover {
  border-color: var(--slate-300);
  background: var(--slate-50);
}

.filter-chip.active {
  border-color: var(--gold);
  background: var(--gold-bg);
  color: var(--gold-dark);
}

/* ── Staggered entrance ── */
.stagger-1 { animation-delay: 0ms; }
.stagger-2 { animation-delay: 50ms; }
.stagger-3 { animation-delay: 100ms; }
.stagger-4 { animation-delay: 150ms; }
.stagger-5 { animation-delay: 200ms; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Currency display ── */
.currency {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.currency-usd::before { content: '$'; }
.currency-mxn::after { content: ' MXN'; font-size: 0.8em; color: var(--slate-400); }

/* ── Timestamp ── */
.timestamp {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--slate-500);
  white-space: nowrap;
}
```

Gate: `npx tsc --noEmit` (CSS-only, won't break anything)

---

### Session 0B: Sidebar Polish

**File: `src/components/cruz/Sidebar.tsx`**

Audit checklist:
- [ ] Logo mark: 30×30 gold square with "Z" — matches login Z-mark style
- [ ] Company name shows dynamic `company_name` from cookie, not hardcoded
- [ ] Active nav item: gold left border + gold text + gold-bg background
- [ ] Hover: subtle white overlay, not jarring
- [ ] Footer: "Patente 3596 · Aduana 240" in JetBrains Mono
- [ ] "Salir" link: slate-400, NOT gold
- [ ] Mobile: sidebar collapses to 64px with icon-only mode
- [ ] Nav sections: uppercase 10px labels with letter-spacing
- [ ] Scroll: nav area scrolls independently, logo + footer stay fixed
- [ ] No gold on the "Salir" button — it's a destructive action

---

### Session 0C: TopBar Polish

**File: `src/components/cruz/TopBar.tsx`**

Audit checklist:
- [ ] Search bar: slate-100 bg, 280px, rounded-md, placeholder "Buscar tráfico..."
- [ ] Status badge: green dot + "En línea" (or amber/red if issues)
- [ ] Date: JetBrains Mono, format "Mié 2 Abr 2026"
- [ ] Right side: notifications icon + status + date — no clutter
- [ ] Border-bottom: 1px slate-200
- [ ] Sticky: top-0, z-30, white bg
- [ ] Mobile: hamburger menu icon replaces search, slides sidebar in

---

## PHASE 1 — CLIENT-FACING PAGES (highest priority)

### Session 1: Login Page ✅ DONE
File delivered. Deploy with:
```bash
cp ~/Downloads/login-page.tsx src/app/login/page.tsx
npx tsc --noEmit && vercel --prod
```

---

### Session 2: Dashboard (`src/app/page.tsx`)

**Three role views. Fix each independently.**

#### ClientInicioView (`src/components/views/client-inicio-view.tsx` — 431L)
This is what EVCO/MAFESA see. Must be perfect.

Fixes needed:
- [ ] Replace ALL inline styles with CSS classes from Phase 0
- [ ] KPIs: use `.kpi-grid` + `.kpi-card` classes
- [ ] KPI values: `.kpi-card-value` (JetBrains Mono, tabular-nums)
- [ ] Status banner: use `.status-banner.ok` class from globals.css
- [ ] Stagger animation on KPI cards (`.stagger-1` through `.stagger-4`)
- [ ] Empty state: use `EmptyState` from `@/components/ui/EmptyState`
- [ ] Loading state: use `DashboardSkeleton` from `@/components/skeletons/DashboardSkeleton`
- [ ] Bridge times: vertical accordion on mobile, cards on desktop
- [ ] Recent tráficos: table with clickable rows, gold left border on hover
- [ ] All monetary values: JetBrains Mono + explicit MXN/USD label

#### AdminView (in `page.tsx`)
- [ ] Same treatment — CSS classes, JetBrains Mono on numbers
- [ ] Dot color animation only for non-green status
- [ ] CTA button: `.btn-primary` not inline gold

#### BrokerView (in `page.tsx`)
- [ ] Greeting: DM Sans 22px, not inline font-family
- [ ] Date: JetBrains Mono
- [ ] Action queue: use border-left color coding from globals.css
- [ ] Stat cards: `.kpi-grid` + `.kpi-card` pattern
- [ ] Loading skeleton: match card shapes

Gate: `npx tsc --noEmit && vercel --prod`
Audit: Log in as EVCO, MAFESA, and broker. Check all three views.

---

### Session 3: Tráficos List (`src/app/traficos/page.tsx` — 413L)

Fixes needed:
- [ ] Page shell: `.page-shell` class
- [ ] Filter chips: `.filter-bar` + `.filter-chip` classes
- [ ] Table: `.table-shell` wrapper
- [ ] Tráfico IDs: JetBrains Mono (`.trafico-id` class exists)
- [ ] Status badges: use global badge classes, not inline colors
- [ ] Currency columns: `.currency` class
- [ ] Row hover: gold left border (`.clickable-row` class exists)
- [ ] Zebra striping: `.row-even` / `.row-odd`
- [ ] Mobile: card layout instead of table (use `MobileTraficoCard`)
- [ ] Empty state: proper `EmptyState` component
- [ ] Loading: `SkeletonRow` with correct column count
- [ ] Pagination: bottom toolbar, not infinite scroll
- [ ] Search: debounced input in table toolbar

Gate: `npx tsc --noEmit && vercel --prod`

---

### Session 4: Tráfico Detail (`src/app/traficos/[id]/page.tsx` — 1,172L)

**This is the big one. Split into tab components first.**

Step 1 — Extract tabs:
```
src/components/trafico/TabGeneral.tsx
src/components/trafico/TabDocumentos.tsx
src/components/trafico/TabFinanciero.tsx
src/components/trafico/TabTimeline.tsx
src/components/trafico/TabProveedores.tsx
```

Step 2 — Polish each tab:
- [ ] General: status badge, pedimento pill, key facts in 2-column grid
- [ ] Documentos: completeness bar, missing docs highlighted
- [ ] Financiero: all currency in JetBrains Mono with MXN/USD labels
- [ ] Timeline: 12-step vertical timeline with gold active dot
- [ ] Proveedores: supplier cards with invoice totals

Step 3 — Page chrome:
- [ ] Sticky header with tráfico ID + status badge
- [ ] Tab bar: horizontal, gold underline on active tab
- [ ] Share button: uses `window.location.origin` (already fixed)
- [ ] Mobile: tabs become vertical accordion or swipeable

Gate: `npx tsc --noEmit && vercel --prod`
Audit: Open 3 different tráficos, check all tabs.

---

### Session 5: Expedientes (`src/components/views/expedientes-view.tsx` — 942L)

Fixes needed:
- [ ] Split: extract table + filters into separate components
- [ ] Completeness %: JetBrains Mono, color-coded (green >80%, amber 50-80%, red <50%)
- [ ] Document dots: use `.docs-bar` + `.docs-dot` from globals.css
- [ ] Table: `.table-shell` pattern
- [ ] Search + filter: `.table-toolbar` + `.filter-bar`
- [ ] Mobile: card layout showing tráfico + completeness % + missing count
- [ ] Loading: shimmer skeleton matching table layout

Gate: `npx tsc --noEmit && vercel --prod`

---

### Session 6: Financiero (`src/app/financiero/page.tsx` — 549L)

Fixes needed:
- [ ] KPI cards: total importado, DTA, IGI, IVA — all JetBrains Mono
- [ ] Currency: every single number has explicit MXN or USD
- [ ] Table: pedimento-level financial breakdown
- [ ] Totals row: bold, top border, same font
- [ ] Charts: gold as primary bar color, slate for secondary
- [ ] Mobile: KPIs 2×2, table scrolls horizontally

Gate: `npx tsc --noEmit && vercel --prod`

---

### Session 7: Proveedores (`src/components/views/proveedores-view.tsx` — 213L)

Fixes needed:
- [ ] Supplier cards: name, country, total value, shipment count
- [ ] Sort by value (default) or shipment count
- [ ] Values: JetBrains Mono
- [ ] Click → filtered tráficos list for that supplier
- [ ] Top supplier highlighted with gold left border

Gate: `npx tsc --noEmit && vercel --prod`

---

### Session 8: Reportes (`src/components/views/reportes-view.tsx` — 541L)

Fixes needed:
- [ ] Report list: cards with title, date range, download button
- [ ] PDF generation: gold accent bar (already in audit PDF template)
- [ ] Date pickers: proper calendar widget, not raw input
- [ ] Loading state while PDF generates

Gate: `npx tsc --noEmit && vercel --prod`

---

## PHASE 2 — SECONDARY PAGES

### Session 9: Entradas list + detail
### Session 10: Cumplimiento
### Session 11: Documentos hub + subir + plantillas
### Session 12: USMCA
### Session 13: MVE
### Session 14: Calendario
### Session 15: Comunicaciones

Each follows the same pattern:
1. Replace inline styles with CSS classes
2. JetBrains Mono on all numbers/timestamps
3. Proper loading skeleton
4. Proper empty state
5. Mobile card layout where table doesn't fit
6. Status badges use global badge classes
7. Entrance animation (`.page-content` class)
8. `npx tsc --noEmit` gate

---

## PHASE 3 — INTERNAL PAGES

### Session 16: Broker command center
### Session 17: Admin panel + onboard
### Session 18: Drafts list + review
### Session 19: CRUZ AI chat
### Session 20: Voz (voice)

Lower priority — clients never see these. Fix for consistency but don't block on 10/10.

---

## PHASE 4 — MOBILE AUDIT

After all pages are polished, run a full mobile pass:

```
For every page:
- [ ] Open at 375px width in Chrome DevTools
- [ ] All touch targets >= 60px (CRUZ standard, not 44px WCAG)
- [ ] Tables → card layout on mobile
- [ ] KPI grids → 2 columns
- [ ] No horizontal scroll
- [ ] Bottom nav visible and functional
- [ ] Text readable without zoom
- [ ] Forms: inputs at 16px font (no iOS zoom)
```

---

## PHASE 5 — FINAL AUDIT

```
Claude in Chrome prompt:

"Go to portal.renatozapata.com, log in with evco2026.
Navigate every sidebar item. For each page, check:

1. Background is warm off-white (#FAFBFC), not pure white or gray
2. All numbers use JetBrains Mono (monospace, tabular)
3. All currency shows MXN or USD explicitly
4. Status badges use consistent colors (not custom per-page)
5. Gold is only used for: primary CTA, active nav, chart accent
6. No inline styles visible in DOM (check with DevTools)
7. Loading state exists (navigate away and back)
8. Empty state exists (filter to zero results)
9. Mobile layout works at 375px
10. Page entrance animation plays (subtle fadeInUp)

Score each page 1-10. List every violation.
Then log out and repeat with mafesa2026."
```

---

## THE CLAUDE CODE SESSION PROMPT

Paste this at the start of each session on Throne:

```
Read ~/evco-portal/TAB_2_FORGE.md completely.
Then read ~/evco-portal/CRUZ_10_BUILD.md and find Session [N].

Execute every checkbox in that session. Rules:
- Replace inline styles with CSS classes (globals.css variables)
- JetBrains Mono on ALL numbers, ALL timestamps, ALL currency
- Every monetary value shows explicit MXN or USD
- Entrance animation on page load (fadeInUp)
- Proper loading skeleton matching the page layout
- Proper empty state using EmptyState component
- Mobile responsive at 375px with 60px touch targets
- npx tsc --noEmit MUST pass before showing me any code
- Deploy with: vercel --prod
- Do NOT change any data fetching logic

Show me each file change. I'll test on portal.renatozapata.com.
```

---

## ESTIMATED TIMELINE

| Phase | Sessions | Hours | Days |
|-------|----------|-------|------|
| Phase 0 (globals) | 3 | 2-3h | Day 1 morning |
| Phase 1 (client pages) | 7 | 8-10h | Day 1-2 |
| Phase 2 (secondary) | 7 | 4-5h | Day 2-3 |
| Phase 3 (internal) | 5 | 3-4h | Day 3 |
| Phase 4 (mobile) | 1 | 2h | Day 3 |
| Phase 5 (audit) | 1 | 1h | Day 3 |
| **Total** | **24** | **~22h** | **~3 days** |

---

## DEFINITION OF DONE

The portal is 10/10 when:

1. Every client-facing page scores 9.0+ on the ten-out-of-ten rubric
2. Zero inline styles on any client-facing page
3. JetBrains Mono on 100% of numbers/timestamps/currency
4. Every page has a loading skeleton, empty state, and error state
5. Mobile works at 375px with 60px touch targets
6. Claude in Chrome audit passes with zero CRITICAL findings
7. EVCO and MAFESA both look identical in layout, different in data
8. Tito opens the portal at 11 PM, sees certainty, closes the app, sleeps

---

*Three focused passes beat ten unfocused ones.*
*Ship at 9.5. Never ship at 8.5 when one more pass reaches 9.5.*
