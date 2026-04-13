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
