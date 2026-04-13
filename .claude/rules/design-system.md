---
description: ADUANA Cinematic Glass System — design enforcement rules
paths:
  - "src/components/**/*"
  - "src/app/**/page.tsx"
  - "src/app/**/layout.tsx"
  - "tailwind.config*"
---

# ADUANA Design System — Cinematic Glass Control Tower (April 2026)

All authenticated pages use `.aduana-dark` class with true glassmorphism.
Login page has its own dark theme (same palette, different layout).

## Color System — Semantic Lighting

```
Background gradient:  #05070B → #0B1220 (with radial cyan glow at center)
Glass cards:          rgba(255,255,255,0.04) + backdrop-blur(20px)
Borders:              rgba(255,255,255,0.08)
Accent cyan:          #00E5FF (system intelligence / active states)
Accent blue:          #3B82F6 (secondary)
Gold:                 #eab308 (actions / CTAs / financial only)
Success green:        #22C55E
Warning amber:        #FBBF24
Danger red:           #EF4444
Text primary:         #E6EDF3
Text secondary:       #94a3b8
Text muted:           #64748b
```

## Semantic Lighting Rules

- **Cyan** = system intelligence, live states, active data flow
- **Gold** = high-priority actions, CTAs, financial values ONLY
- **Green** = success, completed, live/healthy
- **Red** = alerts, risks, urgent
- Never use cyan for decoration. Every glow means "data is flowing."

## Glass Card System

```css
backdrop-filter: blur(20px);
background: rgba(255,255,255,0.04);
border: 1px solid rgba(255,255,255,0.08);
box-shadow:
  0 10px 30px rgba(0,0,0,0.4),
  inset 0 1px 0 rgba(255,255,255,0.05),
  0 0 1px rgba(0,229,255,0.12);  /* subtle cyan idle glow */
border-radius: 20px;
```

**Hover state:**
```css
background: rgba(255,255,255,0.06);
box-shadow:
  0 12px 40px rgba(0,0,0,0.5),
  inset 0 1px 0 rgba(255,255,255,0.08),
  0 0 30px rgba(0,229,255,0.18);
border-color: rgba(0,229,255,0.2);
```

## NO opaque card backgrounds on authenticated pages.
`#222222`, `#1A1A1A`, `#1a2338` are BANNED. Use `rgba(255,255,255,0.04)` or CSS var.

## Typography

- Font: Inter (body) + JetBrains Mono (all data/numbers)
- KPI labels: 10px uppercase, letter-spacing 0.08em, text-muted color
- Large numbers: font-weight 800, pure white
- Secondary metadata: 60% opacity

## Spacing

- Card padding: 20px (tight control-room density)
- Card gap: 16px
- Border-radius: 20px (premium rounded)
- 4px base grid

## Mobile

- 375px minimum width
- Touch targets: 60px minimum
- Cards stack vertically, sorted by urgency
- Glass effect preserved (reduce blur to 12px if performance)

## Status Badges on Dark

Use `<StatusBadge status={status} />` always. Never inline badge styles.
Badges use semi-transparent backgrounds matching the glass system.

---

## AGUILA Cockpit Standard (April 2026)

Every internal-facing cockpit (Operator, Owner, Admin) composes from the
official primitives in `src/components/aguila/`. Local reimplementations
of KPI cards, activity lists, or exception counts are banned going forward —
the standard exists so a quality bump in one primitive cascades to every
cockpit at once.

### Required primitives

| Pattern | Primitive | Import |
|---|---|---|
| Numeric KPI with trend | `<KPITile>` | `@/components/aguila` |
| Mini 7-day trend chart | `<Sparkline>` (composed inside `KPITile`) | `@/components/aguila` |
| % change vs prior period | `<DeltaIndicator>` (composed inside `KPITile`) | `@/components/aguila` |
| Exception/queue count card | `<SeverityRibbon>` on a glass card | `@/components/aguila` |
| Activity / audit feed | `<TimelineFeed>` | `@/components/aguila` |
| "State of the day" header | Greeting + status dot + `LiveTimestamp` | inline pattern in `InicioClient` |

### KPITile contract

- Sparkline is 7 points (last 7 daily buckets from a 14-point series)
- Delta pill compares `current` (last-7 total) vs `previous` (prior-7 total)
- `inverted={true}` flips the tone for metrics where down is good
  (atrasados, failed workflow events, aging A/R)
- `urgent={true}` renders the number in RED + 2s opacity pulse (respects `prefers-reduced-motion`)
- Every tile is clickable (`href` prop) and lands on a filtered destination
  that already exists — cockpits do NOT invent drill-down routes

### SeverityRibbon contract

- 3px left-edge ribbon rendered as `position: absolute` inside a card that
  is `position: relative` + `overflow: hidden`
- Never renders as a card border — glass borders stay neutral per
  core-invariants rule 2
- Tones: `healthy` (green), `warning` (amber), `critical` (red).
  Use `severityFromCount(n, { warn, crit })` helper for count-based thresholds

### Client surface exclusion

Client-facing surfaces (Shipper portal, `/track/[token]`, `/share/[trafico_id]`,
`/cliente/**`) never render `<DeltaIndicator>` or `<SeverityRibbon>` — they
show certainty, not anxiety. Sparklines on the Shipper surface are allowed
only for confirmed-positive metrics (on-time rate, crossings completed).
See core-invariants rule 24.

### Monochrome discipline

Sparklines default to `ACCENT_SILVER` (#C0C5CE). Semantic tones (green/amber/red)
are reserved for status signals on numbers where direction has meaning.
Cyan is deprecated — `ACCENT_CYAN` is a back-compat alias resolving to silver.
Reject any advice to add blue/gold/navy decorative color.

### Verification

```bash
# Local KPI re-implementations are banned after Wave D consolidation:
grep -rn "fontSize: 48" src/app/
# → every match must be inside src/components/aguila/ or an explicit exception

# Client-surface anxiety leak:
grep -rn "DeltaIndicator\|SeverityRibbon" src/app/cliente src/app/track src/app/share
# → must return zero
```

---

## AGUILA v6 — Unified Cockpit Language (April 2026)

After Wave A/B/C polished individual surfaces, screenshots showed three
cockpits still drifted (Shipper / Owner Eagle / Operator-root looked like
three different apps). v6 consolidates the chrome through a single
primitive set so every authenticated cockpit reads as the same product.

### Mandatory primitives

Every authenticated page composes from these. Inline reimplementations
violate core-invariants rules 26–27.

| Pattern | Primitive | Notes |
|---|---|---|
| Page wrapper (canvas + header) | `<PageShell>` | Renders `aguila-dark` + `COCKPIT_CANVAS`; consistent greeting + LiveTimestamp slot |
| Glass card chrome | `<GlassCard>` | THE one card — `BG_ELEVATED` + 20px blur + token border + glass shadow |
| Section label | `<SectionHeader>` | 10px uppercase + count pill + optional action link |
| KPI tile (number + sparkline + delta) | `<KPITile>` | Composes `<GlassCard>` |
| Severity left-edge | `<SeverityRibbon>` | Composes inside `<GlassCard severity={...}>` |
| Activity feed | `<TimelineFeed>` | Vertical dashed rail + pulsing top dot |
| State of day strip | `<StateOfDayStrip>` | Above-hero status sentence |

### Typography contract

Hardcoded `fontSize: NNN` in `src/app/**` is banned. Use the CSS
variables published in `globals.css`:

```
--aguila-fs-kpi-hero    48px   primary KPI number
--aguila-fs-kpi-large   44px   secondary KPI counter
--aguila-fs-kpi-mid     28px   tile total
--aguila-fs-kpi-compact 32px   compact KPITile number
--aguila-fs-kpi-small   18px   inline numeric refs
--aguila-fs-title       24px   page greeting h1
--aguila-fs-section     14px   section title
--aguila-fs-body        13px   body copy
--aguila-fs-label       10px   uppercase label
--aguila-fs-meta        11px   timestamps / chips
--aguila-ls-label       0.08em uppercase tracking
--aguila-ls-tight       -0.03em display number tracking
--aguila-gap-section    32px
--aguila-gap-card       16px
--aguila-gap-stack      12px
--aguila-radius-card    20px
--aguila-radius-compact 16px
```

### Motion contract

Three named utility classes in `globals.css`. All gated by
`prefers-reduced-motion: reduce`.

- `.aguila-stagger-in` — entrance animation (240ms, `--ease-enter`)
- `.aguila-pulse` — KPI urgent pulse (2s opacity)
- `.aguila-dot-pulse` — status / timeline dot pulse (2s scale + opacity)

Inline `@keyframes` definitions outside `@/components/aguila/` violate v6.

### Surface differentiation by content, not chrome

Same chrome everywhere. Surfaces differ in *content discipline*:

- **Shipper** — sparse data, positive-direction sparklines only,
  no `<DeltaIndicator>`, no `<SeverityRibbon>` (invariant 24)
- **Owner Eagle** — dense data, severity ribbons OK, full delta + timeline
- **Operator** — task-focused, "Todo al corriente" zero-states via
  `<EmptyState tone="calm">`, all internal-tier signals allowed

### New surfaces

Any new authenticated page MUST start from `<PageShell>` and compose
content from the listed primitives. A new chrome variant is added by
extending `<GlassCard>` props, NOT by creating a parallel component.

---

## AGUILA v7 — Unified Cockpit Composition (April 2026)

v6 unified *chrome*. v7 unifies *layout and content architecture*.
The three cockpits (`/inicio`, `/operador/inicio`, `/admin/eagle`)
now compose from a single primitive — `<CockpitInicio>` — with
role-specific data slots.

### Layout contract (every cockpit, every role)

```
CockpitBanner (role-aware brand trio)
──────────────────────────────────────
Greeting h1 + summary line + LiveTimestamp
──────────────────────────────────────
HERO — 4 KPITile cards (role-shaped)
──────────────────────────────────────
NAV — 6 SmartNavCard tiles (UNIFIED_NAV_TILES, locked)
      each with 20px sparkline
──────────────────────────────────────
2-COL MAIN
┌─ estadoSections (role-specific) ───┬─ Actividad reciente (role-scoped)
```

Stacks single-column below 1024px.

### Role-scoping table

| Surface | Role gate | Nav counts | Activity feed source | Hero tone |
|---|---|---|---|---|
| `/inicio` | `role === 'client'` | `eq('company_id', session.companyId)` everywhere | `getClienteNotifications` (client-scoped) | silver only — no deltas, no severity |
| `/operador/inicio` | `role ∈ {admin, broker, operator}` | ops-wide where relevant | `operational_decisions` last 10 | silver, deltas allowed, urgent pulse allowed |
| `/admin/eagle` | `role ∈ {admin, broker}` | broker's patente scope | `workflow_events` last 20 **unfiltered** (owner sees everything) | silver, deltas allowed, severity allowed |

### Six nav cards — icons locked

| Key | Label | Route | Icon |
|---|---|---|---|
| traficos | Tráficos | /traficos | Truck |
| pedimentos | Pedimentos | /pedimentos | FileText |
| expedientes | Expedientes | /expedientes | FolderOpen |
| catalogo | Catálogo | /catalogo | Book |
| entradas | Entradas | /entradas | Package |
| clasificaciones | Clasificaciones | /clasificar | Tags |

Changing this list requires Tito + Renato IV sign-off
(core-invariants rule 29).

### Data fetch contract

`src/lib/cockpit/fetch.ts` exports `bucketDailySeries`, `sumRange`,
`startOfToday`, `daysAgo`. All three cockpit pages use these helpers
so series shape is identical. Series queries cap at `.limit(2000)`
rows — bucketing happens in JS. Replace with an RPC if a single
client exceeds this cap.

### Verification

```bash
# Every cockpit imports the composition and the nav constant:
grep -rn "UNIFIED_NAV_TILES\|CockpitInicio" src/app/inicio src/app/operador/inicio src/app/admin/eagle
# → expected 3+ matches per surface

# Client surface never leaks internal-tier signals:
grep -rn "DeltaIndicator\|SeverityRibbon\|tone=\"amber\"\|tone=\"red\"" src/app/inicio
# → 0 matches
```
