# Design System — Aduana Premium Cinematic Dark Theme (v2.3)
## Renato Zapata & Company · Patente 3596 · Est. 1941
## Last updated: 2026-04-10

**This file is the ONLY authority on visual decisions.**
**CLAUDE.md references this file. Do not duplicate tokens in CLAUDE.md.**
**If something looks different on the live portal, update THIS file — not the code.**

---

## Overview & Vision

Official design system for **Aduana** — the AI-powered cross-border customs clearance platform.
Ultra-premium, cinematic, luxurious: deep navy backgrounds with refined glassmorphism,
consistent cyan edge glows, volumetric lighting, and a glossy 3D infinity logo.
Gold is used sparingly for high-priority actions only.

**Core Mood**: Sophisticated, intelligent, futuristic logistics OS.
**Brand Symbol**: Translucent infinity logo with circuit details = continuous intelligent flow.

---

## Color System — Semantic Lighting

| Token | Value | Usage |
|-------|-------|-------|
| Background gradient | `#05070B → #0B1220` | All authenticated pages |
| Ambient glow | `radial-gradient(ellipse, rgba(0,229,255,0.05))` | Center of viewport |
| Card/Panel | `rgba(255,255,255,0.04)` | Glass surface |
| Border base | `rgba(255,255,255,0.08)` | Card edges |
| Border hover | `rgba(0,229,255,0.2)` | Active card edges |
| Accent cyan | `#00E5FF` | Intelligence, active, data flow |
| Accent blue | `#3B82F6` | Secondary accent |
| Blue gradient | `linear-gradient(135deg, #00f0ff, #0088ff, #0044cc)` | Logo, progress bars |
| Gold | `#eab308` | CTAs, financial values ONLY |
| Gold hover | `#ca8a04` | Button hover |
| Success green | `#22C55E` | Live, completed |
| Warning amber | `#FBBF24` | Alerts |
| Danger red | `#EF4444` | Risk, urgent |
| Text primary | `#E6EDF3` | Headings, KPIs |
| Text secondary | `#94a3b8` | Labels, descriptions |
| Text muted | `#64748b` | Metadata |

### Semantic Rules
- **Cyan** = system intelligence, live states, active data flow
- **Gold** = high-priority actions, CTAs, financial values ONLY. Never overuse.
- **Green** = success, completed, healthy
- **Red** = alerts, risks, urgent
- Every glow means "data is flowing." No decoration.

---

## Glass Card System

```css
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
background: rgba(255,255,255,0.04);
border: 1px solid rgba(255,255,255,0.08);
box-shadow:
  0 10px 30px rgba(0,0,0,0.4),
  inset 0 1px 0 rgba(255,255,255,0.05),
  0 0 1px rgba(0,229,255,0.12);
border-radius: 20px;
```

### Hover
```css
background: rgba(255,255,255,0.06);
box-shadow:
  0 12px 40px rgba(0,0,0,0.5),
  inset 0 1px 0 rgba(255,255,255,0.08),
  0 0 30px rgba(0,229,255,0.18);
border-color: rgba(0,229,255,0.2);
transform: scale(1.008);
```

### BANNED on authenticated pages
`#222222`, `#1A1A1A`, `#1a2338`, `#111111` — NO opaque card backgrounds.

---

## Typography

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Body text | Inter | 14px | 400 | text-secondary |
| KPI numbers | JetBrains Mono | 22-48px | 800 | white |
| KPI labels | Inter | 10px uppercase | 700 | text-muted |
| Card titles | Inter | 16px | 700 | white |
| Section labels | Inter | 11px uppercase | 700 | text-muted |
| Metadata | JetBrains Mono | 11-12px | 400 | text-muted |

Letter-spacing: 0.08em on all uppercase labels.

---

## Spacing & Layout

- Card padding: 20px
- Card gap: 16px
- Border-radius: 20px (all cards)
- 4px base grid
- Command center: Hero → KPI strip → 4-col action → 4-col reference
- Floating "ADUANA AI" pill: bottom-right, gold gradient

---

## Ambient Background

```css
background:
  radial-gradient(ellipse at 50% 20%, rgba(0,229,255,0.05) 0%, transparent 50%),
  linear-gradient(180deg, #05070B 0%, #0B1220 100%);
```

---

## Mobile (375px minimum)

- Touch targets: 60px minimum (border at 3 AM standard)
- Cards stack vertically, sorted by urgency
- Glass effect preserved (reduce blur to 12px for performance)
- KPI strip: 2x2 grid
- Reference row: behind "Ver más" expandable

---

## Status Badges

Always use `<StatusBadge status={status} />`. Never inline badge styles.
Badges use semi-transparent backgrounds matching glass system.

---

## Strict Rules for All Code

1. Always use cinematic dark glass theme on all authenticated pages.
2. Apply glassmorphism + cyan idle glow to every card.
3. Cyan = intelligence. Gold = action. Green = success. Red = risk.
4. Maintain typography hierarchy — KPIs huge, labels uppercase, metadata muted.
5. NO opaque backgrounds on cards. NO #222222. NO #1A1A1A.
6. 60px touch targets on mobile.
7. JetBrains Mono on ALL numbers and timestamps.
8. All monetary values carry MXN or USD label.
9. No clutter — generous whitespace and clear hierarchy.
10. When in doubt, match the mockup: glass infinity logo, cyan glows, gold CTAs.

---

*Version 2.3 — Cinematic Glass Control Tower*
*Updated: April 2026*
*Priority: Highest*
