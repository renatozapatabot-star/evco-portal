---
description: CRUZ Design System enforcement rules — cockpit dark theme standard
paths:
  - "src/components/**/*"
  - "src/app/**/page.tsx"
  - "src/app/**/layout.tsx"
  - "tailwind.config*"
---

# CRUZ Design System — Cockpit Standard (April 2026)

These rules encode the cockpit dark theme. All authenticated pages use `.cruz-dark`.
Login is the only light-themed page. See `DESIGN_SYSTEM.md` for full token reference.

## Color Tokens — Cockpit Theme

All portal UI uses `.cruz-dark` CSS variable overrides:
- Page canvas: `#111111` (flat, no gradients)
- Card elevated: `#222222` (the standard card background)
- Card base: `#1A1A1A`
- Borders: `rgba(255,255,255,0.08)` (cards), `rgba(255,255,255,0.06)` (dividers)
- Gold accent: `#C9A84C` — CTAs, active nav. ONE job only.
- Gold text on dark: `#C9A84C` is fine (high contrast against #222222)
- Text primary: `#E6EDF3` (light on dark)
- Text secondary: `#8B949E`
- Text muted: `#6E7681`

Never use light-theme tokens (#FAFAF8, #FFFFFF, #E8E5E0) in authenticated portal pages.
No glassmorphism (backdrop-filter: blur) — solid elevated surfaces only.

## Card Pattern — CockpitCard

```
Background:    var(--bg-elevated) = #222222
Border:        1px solid rgba(255,255,255,0.08)
Top border:    3px solid [urgency color: red/amber/green/gold]
Border radius: 14px
Padding:       16px (tight, Linear-inspired)
Min height:    180px
```

Urgency border colors:
- Red: `rgba(220,38,38,0.7)` — urgent, action required
- Amber: `rgba(217,119,6,0.6)` — monitor, attention needed
- Green: `rgba(22,163,74,0.5)` — healthy, green check badge shown
- Neutral: `rgba(201,168,76,0.4)` — informational, gold accent

## Status Badges on Dark

StatusBadge component adapts via `.cruz-dark` variable overrides:
- Active: `bg-[--amber-50] text-amber-400 border-amber-800`
- Completed: `bg-[--green-50] text-green-400 border-green-800`
- Warning: `bg-[--amber-50] text-orange-400 border-orange-800`
- Error: `bg-[--red-50] text-red-400 border-red-800`
- Pending: `bg-[--slate-100] text-slate-400 border-slate-600`

Use `<StatusBadge status={status} />` always. Never inline badge styles.

## Tables on Dark

- Headers: `var(--bg-elevated)`, `--text-secondary`, 11px uppercase tracking-wider
- Row even: `var(--bg-card)` = #1A1A1A
- Row odd: `rgba(255,255,255,0.02)`
- Row hover: `rgba(255,255,255,0.04)`
- Borders: `rgba(255,255,255,0.06)`
- Numbers: JetBrains Mono
- Every table MUST have an empty state: icon + message + action on dark bg
- Sortable columns show sort indicator

## Typography

- Font: Geist Sans for text, JetBrains Mono for ALL data
- Headings: 18px semibold, `--text-primary`
- Section labels: 11px uppercase tracking-wider, `--text-muted` (Linear signature)
- Body: 14px, `--text-secondary`
- KPI values: JetBrains Mono, 28-32px weight 800, `--text-primary`
- Data: JetBrains Mono, 13px, `--text-primary`

## Spacing (Linear-tight)

- Card padding: 16px
- Card gap: 12px
- Section gap: 16px
- Page padding: 16px mobile, 48px desktop
- 4px base grid. No arbitrary spacing values.

## Mobile

- All layouts must work at 375px width
- Touch targets: 60px minimum (border at 3 AM, not WCAG 44px)
- Tables: horizontal scroll OR card view on mobile
- Cards: single column, sorted by urgency (most urgent top)
- Test at 375px before marking any UI task complete

## Micro-interactions

- Card hover: scale(1.005), border brightens, 150ms (barely perceptible)
- Card tap: scale(0.97), haptic.micro()
- Swipe-to-resolve: translateX with green reveal strip
- Loading: skeleton loaders with dark shimmer (not spinners)
- Entrance: stagger 30ms, translateY(6px), spring animation
- prefers-reduced-motion: disable all springs, instant transitions

## Operational Depth

Every data view must support in-context actions:
- See status at a glance (urgency border + badge)
- Click through to detail (cross-link)
- Take the most common action without leaving (gold action button or swipe)

If a page is read-only with no actions, it's a dashboard, not a tool. CRUZ is a tool.
