# CRUZ NORTH STAR — The 10/10 Audit
## The Definitive Quality Standard
## Generated: April 2, 2026 · Auditor: Claude Opus 4.6 via Chrome
## Baseline: 7.2/10 → Target: 10.0/10

---

## CURRENT SCORES

| Page | Designer | UX | Data | Layout | AVG |
|------|----------|-----|------|--------|-----|
| Dashboard | 7.5 | 7.0 | 8.0 | 7.0 | **7.4** |
| Entradas | 6.5 | 6.5 | 5.5 | 6.5 | **6.3** |
| Tráficos | 7.5 | 8.0 | 7.5 | 7.5 | **7.6** |
| Tráfico Detail | 8.0 | 8.5 | 8.0 | 8.0 | **8.1** |
| Pedimentos | 7.0 | 7.0 | 6.5 | 7.0 | **6.9** |
| Expediente Digital | 7.0 | 7.0 | 7.0 | 7.0 | **7.0** |
| Reportes | 7.0 | 6.5 | 7.0 | 7.0 | **6.9** |
| **Overall** | | | | | **7.2** |

---

## PHASE A — CRITICAL (7.2 → 8.0)

### A1. Fix Mobile Horizontal Overflow
Every page has body width 607-615px exceeding 379px viewport.
```css
/* Add to globals.css */
html, body { overflow-x: hidden; max-width: 100vw; }
```
Then find the elements causing overflow (likely sidebar width calculation or fixed-width elements).
**Impact: +1.0 on Layout for ALL pages**

### A2. Fix Sidebar Client Badge
Shows "MAFESA" when logged in as EVCO on Dashboard. Session state reads wrong on initial render. Likely a cookie read timing issue — the company_id cookie isn't available on first server render.
**Impact: trust-destroying bug**

### A3. Fix React Hydration Error #418
Still present after Day 1 fix attempt. Check:
- Any remaining `new Date()` in render path
- Locale-dependent formatting that differs server vs client
- Any `Math.random()` or `Date.now()` in initial render
**Impact: console error on every page load**

### A4. Resolve Transportista Raw Codes
"2", "3", "108" showing instead of carrier names on /entradas and /traficos/[id].
The `fmtCarrier()` function from `carrier-names.ts` either:
- Isn't being called on these specific fields
- Doesn't have mappings for numeric-only codes (only handles "CARRIER_XX" format?)
- The column in the data uses a different field name than expected
**Impact: +1.0 on Data for Entradas**

### A5. Resolve ALL Remaining PRV_XXXX Codes
Still appearing on /reportes. Day 2 fix worked for tráfico detail but not reportes.
Check: the reportes view query may use a different data path that doesn't join proveedores.
**Impact: makes Reportes page useless to clients**

### A6. JetBrains Mono Consistency — Final Pass
Still missing on:
- Entrada numbers on /entradas
- Pedimento numbers on /pedimentos
- Tráfico numbers on /pedimentos
**Impact: +1.0 on Data for affected pages**

### A7. Pedimento Number Format Decision
INCONSISTENCY FOUND: /expedientes shows "26 24 3596 53180" (full format) while /pedimentos shows "4008476" (raw). Day 2 introduced short format but it wasn't applied everywhere.
**DECISION NEEDED from Renato:**
- Client-facing: show ONLY sequential (5500017)? Or full format (26 24 3596 5500017)?
- Pick ONE and apply everywhere.
**Impact: +0.5 on Data consistency**

### A8. Date Picker Format
All date pickers show mm/dd/yyyy (US format). Mexican customs platform should use dd/mm/yyyy.
Affects: /entradas, /pedimentos, /reportes
**Impact: +0.3 on UX for 3 pages**

### A9. "Generar PDF" Button
Either implement or remove. Grayed-out non-functional button is a dead end.
**Impact: +0.3 on UX/Broken for Reportes**

### A10. Column Sorting on All Tables
No sort capability on /traficos, /entradas, /pedimentos. Click-to-sort headers are expected.
**Impact: +0.5 on UX for 3 pages**

---

## PHASE B — HIGH (8.0 → 8.5)

### B1. DOCS completion bar tooltips
### B2. Make Entradas rows clickable → linked tráfico
### B3. Add "kg" suffix to peso values in tables
### B4. "TOCA PARA SUBIR" → "SUBE DOCUMENTOS" on desktop
### B5. "Expediente Digital" vs "Expedientes Digitales" singular/plural
### B6. Remove test data "5555555" from Expedientes
### B7. Add loading skeletons (verify they exist on all pages)
### B8. Sparkline card: add context "vs 329 last month"
### B9. Make pedimento chips clickable in Tráficos table
### B10. Add breadcrumb navigation (Inicio > Tráficos > 9254-Y4503)

---

## PHASE C — MEDIUM-HIGH (8.5 → 9.0)

### C1. Add "kg" to all peso values
### C2. Search autocomplete/suggestions
### C3. "No results" state for search queries
### C4. Active filter chips above tables
### C5. Table row hover states
### C6. "Última actualización" timestamp on each page
### C7. "Valor no disponible" explanation tooltip
### C8. Dashboard "Entradas Hoy" redundancy — "0 — Ninguna hoy" → just "Ninguna hoy"
### C9. Consistent KPI card borders (all rows get colored top borders)
### C10. Card shadows for depth

---

## PHASE D — MEDIUM (9.0 → 9.3)

### D1. Notification/alert center (dedicated page)
### D2. "Compartir" button clarification
### D3. Date range presets ("Este mes", "Este año")
### D4. Total value in Pedimentos header
### D5. % change indicators on Dashboard KPIs
### D6. CSV export on Entradas
### D7. Document type filter on Expedientes
### D8. Transport info column on Tráficos table
### D9. Remove or fix World Trade Bridge card
### D10. Status count breakdown on Entradas

---

## PHASE E — DESIGN POLISH (9.3 → 9.5)

### E1. ⌘K command palette verification
### E2. Favorites/starred tráficos
### E3. Inline status change from table
### E4. "Descargar pedimento" action on detail
### E5. Animate progress ring on Completitud Documental
### E6. Linked entradas count on every tráfico row
### E7. Relative time ("hace 2 días") alongside dates
### E8. Interactive chart hover on Reportes
### E9. "Volver arriba" floating button
### E10. Staggered card fade-in animations (50ms per card)

---

## PHASE F — DESIGN SYSTEM PERFECTION (9.5 → 9.7)

### The Apple Standard

**Typography Token System (enforce globally):**
```
H1-Display:   28px DM Sans 600 -0.3px tracking (page titles)
H2-Section:   20px DM Sans 500 (section headers)
Body:          15px DM Sans 400 1.5 line-height (prose)
Body-Small:    13px DM Sans 400 (table cells, descriptions)
Mono-Large:    28px JetBrains Mono 700 tabular-nums (KPI values)
Mono-Table:    13px JetBrains Mono 500 tabular-nums (table numbers)
Label-Caps:    11px DM Sans 600 0.06em tracking uppercase (card labels)
Label-Small:   11px DM Sans 500 (footnotes, timestamps)
```

**Animation System:**
```
Card enter:      fadeInUp 200ms ease-enter, stagger 50ms per card
Progress ring:   fill 800ms ease-out
Status badge:    scale pulse on change 150ms
Sidebar toggle:  slide 200ms ease-enter
Page transition: crossfade 150ms
Tab switch:      underline slide 150ms
```

**Color Derivation from Gold:**
```
Primary gold:    #C4963C (CTAs, active nav)
Amber warning:   #D97706 (derived from gold family)
Gold wash:       rgba(196,150,60,0.06) (selected rows)
Gold gradient:   linear-gradient(135deg, #C4963C, #D4A843) (hero CTA)
Deep gold text:  #8B6914 (WCAG AA on white)
```

**Whitespace Increase:**
- Increase all card padding from 24px → 28px
- Increase sidebar item height from 40px → 44px
- Increase table row padding from 12px → 14px
- Increase section gaps from 24px → 32px

### F1. Standardize border-radius (pick 12px for cards, 8px for buttons)
### F2. Increase sidebar active item contrast
### F3. Larger Z brandmark in sidebar
### F4. Verify greeting time sensitivity
### F5. Standardize card padding (28px everywhere)
### F6. Add dividers between KPI card rows
### F7. Make table headers sticky on scroll
### F8. Session card on login: animate into main card, don't stack

---

## PHASE G — RESPONSIVE REBUILD (9.7 → 9.8)

### G1. Fix mobile card clipping on Dashboard
### G2. Stack KPI bar vertically on mobile (show all 4, not 2)
### G3. Touch targets 60px minimum everywhere (breadcrumbs are 20px)
### G4. Swipe gestures on mobile cards
### G5. Persistent bottom tab navigation on mobile
### G6. Pull-to-refresh on mobile
### G7. Increase font size in mobile card views
### G8. Safe area insets for notched phones
### G9. Landscape optimization
### G10. iPad split view at 1024px

---

## PHASE H — ACCESSIBILITY & i18n (9.8 → 9.9)

### H1. ARIA labels on status badges
### H2. ARIA labels on DOCS completion bars
### H3. Color contrast check (gray subtitle text)
### H4. Focus outlines on keyboard nav
### H5. Skip navigation link verification
### H6. `<time>` elements with datetime attribute
### H7. `lang="es"` on HTML root
### H8. Screen reader page transition announcements
### H9. `aria-current="page"` on active sidebar link
### H10. High-contrast mode support

---

## PHASE I — DATA & BUSINESS LOGIC (9.9 → 10.0)

### I1. Show MXN values where applicable (duties, taxes)
### I2. Dual-currency display: "$445K USD (≈$8.0M MXN)"
### I3. Consistent number formatting ($2.6M vs $276,603.31 — pick a rule)
### I4. Add fracción arancelaria to pedimento/tráfico detail
### I5. Days-in-status on badges ("En Proceso · 3 días")
### I6. Document upload date on Expedientes
### I7. Sparkline per tráfico in table
### I8. Proveedor grouping on Entradas and Tráficos
### I9. Cruce time estimate from bridge data
### I10. Audit trail: who uploaded what, when

---

## PHASE J — THE SAAS VISION

### J1. White-Label Theme Engine
Primary color, secondary color, logo upload, company name, patente, aduana as configurable variables per tenant. Already partially done (cookie-based multi-tenant).

### J2. Multi-Client Management Dashboard
Global dashboard showing metrics across ALL clients. Client switcher. Per-client drill-down. Think Shopify Partner Dashboard → Individual Store.

### J3. Role-Based Access
- Admin (brokerage staff — full access)
- Client Manager (one per client — their data only)
- Client Viewer (read-only)
- Carrier (sees only assigned tráficos)
- Customs Agent (pedimento-specific views)

### J4. API & Webhooks
REST API for clients to pull data into their ERP. Webhook notifications for status changes.

### J5. Push Notifications
Tráfico status changes → push notification on phone + optional email.

### J6. ⌘K Supercharged Search
Type "Y4503" → instant tráfico + status + docs + timeline in overlay. Natural language: "tráficos cruzados esta semana."

### J7. Camera Document Scanning
One tap → camera → auto-crop → auto-classify → auto-assign to tráfico via OCR.

### J8. Analytics & Benchmarking
Compare brokerage performance against anonymized industry benchmarks. Competitive moat.

### J9. SLA Monitoring
Real-time border wait times, customs office hours, holiday schedules.

### J10. Onboarding Tour
First-time user walkthrough highlighting key features.

---

## EXECUTION ESTIMATE

| Phase | Score Impact | Est. Hours | Priority |
|-------|-------------|------------|----------|
| A (Critical) | 7.2 → 8.0 | 6-8h | THIS WEEK |
| B (High) | 8.0 → 8.5 | 4-6h | THIS WEEK |
| C (Med-High) | 8.5 → 9.0 | 4-6h | NEXT WEEK |
| D (Medium) | 9.0 → 9.3 | 4-6h | NEXT WEEK |
| E (Polish) | 9.3 → 9.5 | 3-4h | WEEK 3 |
| F (Design System) | 9.5 → 9.7 | 6-8h | WEEK 3 |
| G (Responsive) | 9.7 → 9.8 | 6-8h | WEEK 4 |
| H (Accessibility) | 9.8 → 9.9 | 4-6h | WEEK 4 |
| I (Data/Logic) | 9.9 → 10.0 | 8-10h | MONTH 2 |
| J (SaaS Vision) | Platform | 40-60h | MONTH 2-3 |

**Total to 9.5: ~30 hours (2 weeks)**
**Total to 10.0: ~60 hours (1 month)**
**Total with SaaS: ~120 hours (3 months)**

---

*"A 10 never exists — just something we always strive for."*
*The gap between 9.2 and 9.8 is where craft lives.*
*The gap between 9.8 and the theoretical 10 is where obsession lives.*
*Both are productive.*

— CRUZ North Star, April 2, 2026
