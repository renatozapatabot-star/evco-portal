# CRUZ Design System — Single Source of Truth
## Renato Zapata & Company · Patente 3596 · Est. 1941
## Last updated: 2026-04-08

**This file is the ONLY authority on visual decisions.**
**CLAUDE.md references this file. Do not duplicate tokens in CLAUDE.md.**
**If something looks different on the live portal, update THIS file — not the code.**

---

## THE AESTHETIC

Dark cockpit. Gold accents. Linear-inspired.

Dense information display. Quiet when healthy (small green badges),
loud when urgent (red borders, urgency pulses). Monospace on all data.
Gold is the only accent color — used sparingly for CTAs.

Think: Linear meets Bloomberg Terminal, built by someone who respects
the craft of customs brokerage. Not a dashboard. A command center.

**Key principles:**
- Every authenticated page uses the dark cockpit theme (`.cruz-dark`)
- Login is the only light-themed page
- No glassmorphism — solid elevated surfaces only
- Animations: subtle, spring-based, 30ms stagger between cards
- Dense spacing — cockpit, not magazine layout

---

## COLOR TOKENS (CSS Variables in globals.css)

### Cockpit Theme (primary — applied via `.cruz-dark` class)
```css
--bg-main: #111111;              /* page canvas */
--bg-card: #1A1A1A;              /* card base */
--bg-elevated: #222222;          /* elevated cards (the standard card bg) */
--bg-hover: #2A2A2A;             /* hover state */
--border-card: rgba(255,255,255,0.08);  /* card borders */
--border: rgba(255,255,255,0.06);       /* subtle dividers */
--text-primary: #E6EDF3;         /* primary text (light on dark) */
--text-secondary: #8B949E;       /* secondary text */
--text-muted: #6E7681;           /* muted/tertiary text */
--shadow-card: 0 1px 3px rgba(0,0,0,0.3);
--shadow-elevated: 0 4px 12px rgba(0,0,0,0.4);
```

### Light Theme (login page only)
```css
--bg-main: #FAFAF8;              /* warm off-white canvas */
--bg-card: #FFFFFF;              /* white cards */
--border-card: #E8E5E0;          /* warm gray borders */
--text-primary: #1A1A1A;
--text-secondary: #6B6B6B;
--text-muted: #737373;
```

### Gold (Brand Accent)
```css
--gold: #C9A84C;                /* buttons, CTAs, active nav — ONE JOB ONLY */
--gold-dark: #8B6914;            /* gold TEXT on light backgrounds (WCAG AA 5.2:1) */
--gold-bg: rgba(196,150,60,0.15); /* active nav item background (cockpit) */
--gold-hover: #B8933B;           /* button hover state */
```

### Gold Rules
- Gold does ONE job: primary CTAs + active nav indicator
- Links: use blue (#2563EB), NEVER gold
- "Salir" button: muted text, NEVER gold
- Chart bars: gold is fine (brand chart color)
- Text on dark: gold (#C9A84C) is fine — high contrast against #222222
- Text on light: ALWAYS use --gold-dark (#8B6914), NEVER --gold

### Brand Mark
```css
--z-red: #CC1B2F;               /* Z mark ONLY — nothing else uses this */
```

### Status / Semantic
```css
--success: #16A34A;              /* green — completed, confirmed */
--warning: #D97706;              /* amber — borders/bg, never text on white */
--warning-text: #92400E;         /* amber text (WCAG AA 7.3:1) */
--danger: #DC2626;               /* red — errors, critical */
--danger-text: #991B1B;          /* red text on white */
--info: #2563EB;                 /* blue — links, informational */
```

### Status on Dark (`.cruz-dark` overrides)
```css
--green-50: #0D2818;   --green-100: #1A4D2E;
--amber-50: #2D1F0A;   --amber-100: #4D3510;
--red-50: #2D1216;     --red-100: #4D2024;
```

### Urgency System (card top borders)
```css
Red:     rgba(220,38,38,0.7)     /* urgent — action required */
Amber:   rgba(217,119,6,0.6)     /* monitor — attention needed */
Green:   rgba(22,163,74,0.5)     /* healthy — all good */
Neutral: rgba(201,168,76,0.4)    /* informational — gold accent */
```

### Emotional Colors (max 3 visible simultaneously on any screen)
```css
--teal: #0D9488;                 /* CERTAINTY — confirmed facts, locked ETAs */
--slate: #475569;                /* WAITING — in progress, on schedule */
--warm-gray: #78716C;            /* ARCHIVED — done, historical */
--plum: #7E22CE;                 /* REGULATORY — not urgent today, urgent soon */
```

---

## TYPOGRAPHY

### Font Stack
```css
/* Body — loaded via next/font, NOT CDN @import */
font-family: 'Geist Sans', var(--font-geist-sans), system-ui, sans-serif;

/* Numeric — ALL financial figures, ALL timestamps, ALL IDs. No exceptions. */
font-family: 'JetBrains Mono', var(--font-jetbrains-mono), monospace;
```

### Scale (Linear-inspired — tight, dense)
```
Display:     Geist Sans, 28px, weight 700, color --text-primary
Title:       Geist Sans, 18px, weight 600, color --text-primary
Heading:     Geist Sans, 16px, weight 600, color --text-primary
Section:     Geist Sans, 11px, weight 500, uppercase, tracking-wider, color --text-muted
Body:        Geist Sans, 14px, weight 400, color --text-secondary, line-height 1.5
Caption:     Geist Sans, 12px, weight 400, color --text-muted
Mono/Data:   JetBrains Mono, 13px, weight 400, color --text-primary
Mono/Large:  JetBrains Mono, 28-32px, weight 800, color --text-primary (KPI values)
Mono/Small:  JetBrains Mono, 11px, weight 400, color --text-muted
```

### Typography Rules
- Base font size: 14px (dense, not generous)
- Line height: 1.5 for body, 1.1 for KPI numbers
- JetBrains Mono on: pedimento numbers, trafico IDs, monetary values, dates, timestamps, percentages, KPI values
- Geist Sans on: everything else (headings, body text, labels, buttons)
- Never use DM Sans, Inter, Roboto, Arial, or system-ui as primary
- Never load fonts via CDN @import — use next/font only

---

## COCKPIT CARD PATTERN (CockpitCard)

The primary UI element. Every metric, action, and data view lives inside a cockpit card.

```
Background:    var(--bg-elevated) = #222222
Border:        1px solid rgba(255,255,255,0.08)
Top border:    3px solid [urgency color]
Border radius: 14px
Padding:       16px (Linear-tight)
Min height:    180px
Shadow:        0 2px 12px [urgency shadow color]
```

### Card urgency states:
- **Red** (urgent): red top border, red shadow glow, urgency pulse animation
- **Amber** (monitor): amber top border, amber shadow
- **Green** (healthy): green top border, green check badge top-right, 85% opacity if no data
- **Neutral** (info): gold top border, no badge

### Card anatomy:
1. Icon + Label header (16px semibold, white)
2. KPI value (JetBrains Mono, 26-32px, white, gold text-shadow)
3. Subtitle (13px, muted)
4. Action buttons (gold pills, 12px bold)

### Green check badge:
- 18px circle, green bg, white checkmark icon
- Position: top-right corner of card
- Only visible when urgency = green or neutral

---

## COCKPIT TABLE PATTERN (CockpitTable)

For data lists inside the cockpit aesthetic.

```
Background:    transparent (inherits dark canvas)
Header:        var(--bg-elevated), --text-secondary, 11px uppercase tracking-wider
Row even:      var(--bg-card) = #1A1A1A
Row odd:       rgba(255,255,255,0.02)
Row hover:     rgba(255,255,255,0.04)
Border:        border-bottom rgba(255,255,255,0.06)
Numbers:       JetBrains Mono
Status:        StatusBadge with .cruz-dark overrides
Empty state:   icon + message + action on dark background
```

---

## COCKPIT PAGE LAYOUT

```
Page wrapper:  .cruz-dark class (applies all dark token overrides)
Background:    #111111 (flat, no gradients)
Padding:       16px mobile, 48px desktop
Max width:     1200px centered
Grid:          12-column CSS grid, gap 12px
               Critical cards (red/amber): span 6 cols
               Normal cards (green/neutral): span 3 cols
               Mobile: single column, sorted by urgency (most urgent top)
```

---

## SPACING SYSTEM (Linear-tight)

```
4px base: p-1(4) p-2(8) p-3(12) p-4(16) p-5(20) p-6(24) p-8(32)
No arbitrary values. Use the Tailwind scale.

Card padding:   16px (tight)
Card gap:       12px
Section gap:    16px
Page padding:   16px (mobile) / 48px (desktop)
Max content:    1200px
```

---

## ANIMATION RULES (Linear-inspired)

```
Card entrance:   stagger 30ms, translateY(6px→0), 200ms spring
Card hover:      scale(1.005), border brightens, 150ms
Card tap:        scale(0.97), 100ms
Swipe resolve:   translateX → 300, fade out, 300ms
Pull refresh:    gold spinner, proportional rotation
Page transition: fade + translateY(4px→0), 160ms
Numbers:         count-up spring animation on KPI values
Tab indicator:   gold underline slides with layout animation
```

### Animation Principles
- Subtle and confident. Never bouncy or flashy.
- prefers-reduced-motion: disable all springs, use instant transitions
- framer-motion for gestures and layout animations
- CSS transitions for hover/focus micro-interactions

---

## TOUCH TARGETS

- Desktop interactive elements: min 44px
- Mobile interactive elements: min 60px (this is the border at 3 AM, not WCAG)
- Table row click targets: full row width, min-h-[48px]

---

## RESPONSIVE BREAKPOINTS

```
Mobile:    375px minimum (test everything here)
Tablet:    768px
Desktop:   1024px+
Max width: 1200px

Cards:       1-col mobile (urgency-sorted), 12-col grid desktop
Tables:      horizontal scroll on mobile, full width on desktop
Sidebar:     hidden on client portal, visible on operator portal
Touch:       60px on mobile, 44px on desktop
```

---

## STATUS BADGES (global — use StatusBadge component always)

On dark backgrounds, badges use `.cruz-dark` overrides:
```
En proceso:  bg-[--amber-50]  text-amber-400  border-amber-800
Cruzado:     bg-[--green-50]  text-green-400  border-green-800
Warning:     bg-[--amber-50]  text-orange-400 border-orange-800
Error:       bg-[--red-50]    text-red-400    border-red-800
Pending:     bg-[--slate-100] text-slate-400  border-slate-600
T-MEC:       gold pill (same amber tokens)
```

---

## WHAT NEVER TO DO

- NEVER use light-theme cards in authenticated pages (login is the only light page)
- NEVER use glassmorphism (backdrop-filter: blur) on portal cards — solid surfaces only
- NEVER use Inter, Roboto, DM Sans, Arial, or system fonts as primary
- NEVER use purple gradients or blue as primary accent
- NEVER hardcode hex colors in components — use CSS variables
- NEVER inline badge styles — use StatusBadge component
- NEVER leave empty states as blank space (icon + message + action)
- NEVER use radial gradients on page backgrounds — flat #111111 only

---

*CRUZ Design System · Renato Zapata & Company · Patente 3596*
*Last verified against live portal: 2026-04-08*
