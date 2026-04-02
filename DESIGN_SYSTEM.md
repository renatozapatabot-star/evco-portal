# CRUZ Design System — Single Source of Truth
## Renato Zapata & Company · Patente 3596 · Est. 1941
## Last updated: 2026-04-02

**This file is the ONLY authority on visual decisions.**
**CLAUDE.md references this file. Do not duplicate tokens in CLAUDE.md.**
**If something looks different on the live portal, update THIS file — not the code.**

---

## THE AESTHETIC

Navy sidebar. Warm off-white content. Gold accents. Professional, institutional,
"fintech not broker from 2008." Think private banking app built by someone
who respects the craft of customs brokerage.

---

## COLOR TOKENS (CSS Variables in globals.css)

### Core Canvas
```css
--navy-900: #0B1623;          /* sidebar background — ONLY the sidebar */
--bg-main: #FAFBFC;           /* content area (warm off-white) */
--bg-card: #FFFFFF;            /* cards */
--border-card: #E5E7EB;        /* card borders */
--shadow-card: 0 1px 3px rgba(0,0,0,0.06);
--shadow-elevated: 0 4px 12px rgba(0,0,0,0.08);
```

### Gold (Brand Accent)
```css
--gold: #C4963C;              /* buttons, CTAs, active nav — ONE JOB ONLY */
--gold-dark: #8B6914;          /* gold TEXT on white backgrounds (WCAG AA 5.2:1) */
--gold-bg: rgba(196,150,60,0.08); /* active nav item background */
--gold-hover: #B8933B;         /* button hover state */
```

### Gold Rules
- Gold does ONE job: primary CTAs + active nav indicator
- Links: use blue (#2563EB), NEVER gold
- "Salir" button: slate-400, NEVER gold
- Chart bars: gold is fine (brand chart color)
- Text on white: ALWAYS use --gold-dark (#8B6914), NEVER --gold (#C4963C)

### Brand Mark
```css
--z-red: #CC1B2F;             /* Z mark ONLY — nothing else uses this */
```

### Status / Semantic
```css
--success: #16A34A;            /* green — completed, confirmed */
--warning: #D97706;            /* amber — borders/bg ONLY, never text on white */
--warning-text: #92400E;       /* amber text (WCAG AA 7.3:1) */
--danger: #DC2626;             /* red — errors, critical */
--danger-text: #991B1B;        /* red text on white */
--info: #2563EB;               /* blue — links, informational */
```

### Emotional Colors (max 3 visible simultaneously on any screen)
```css
--teal: #0D9488;               /* CERTAINTY — confirmed facts, locked ETAs */
--slate: #475569;              /* WAITING — in progress, on schedule */
--warm-gray: #78716C;          /* ARCHIVED — done, historical */
--plum: #7E22CE;               /* REGULATORY — not urgent today, urgent soon */
```

---

## TYPOGRAPHY

### Font Stack
```css
/* Body — loaded via next/font/google, NOT CDN @import */
font-family: 'DM Sans', var(--font-geist-sans), system-ui, sans-serif;

/* Numeric — ALL financial figures, ALL timestamps, ALL IDs. No exceptions. */
font-family: 'JetBrains Mono', var(--font-jetbrains-mono), monospace;
```

### Scale
```
Display Large:   DM Sans, 28px, weight 700, color text-gray-900
Display Medium:  DM Sans, 24px, weight 600, color text-gray-900
Heading:         DM Sans, 20px, weight 600, color text-gray-900
Subheading:      DM Sans, 14px, weight 500, color text-gray-500, uppercase, tracking-wider
Body:            DM Sans, 15px, weight 400, color text-gray-700, line-height 1.5
Caption:         DM Sans, 12px, weight 400, color text-gray-500
Mono/Data:       JetBrains Mono, 13px, weight 400, color text-gray-900
Mono/Small:      JetBrains Mono, 11px, weight 400, color text-gray-500
```

### Typography Rules
- Base font size: 15px
- Line height: 1.5
- JetBrains Mono on: pedimento numbers, tráfico IDs, monetary values, dates, timestamps, percentages
- DM Sans on: everything else (headings, body text, labels, buttons)
- Never use Inter, Roboto, Arial, or system-ui as primary
- Never load fonts via CDN @import — use next/font only

---

## COMPONENT PATTERNS (Tailwind Classes)

### Sidebar
```
bg-[#0B1623] w-64 fixed h-screen border-r border-[#1a2a3f]
```

### Sidebar Nav Item (inactive)
```
px-3 py-2 rounded-md text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors
```

### Sidebar Nav Item (active)
```
px-3 py-2 rounded-md text-sm text-[#C4963C] bg-[rgba(196,150,60,0.08)]
```

### Page Container
```
bg-[#FAFBFC] min-h-screen pl-64  /* offset for fixed sidebar */
```

### Content Area
```
max-w-7xl mx-auto px-6 py-6
```

### Card
```
bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)]
```

### Card Hover (clickable cards)
```
hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-[#C4963C]/20 transition-all duration-150
```

### Button Primary
```
bg-[#C4963C] hover:bg-[#B8933B] text-white font-medium rounded-lg px-4 py-2 transition-colors duration-150
```

### Button Secondary
```
border border-[#E5E7EB] hover:border-gray-300 text-gray-600 hover:text-gray-900 font-medium rounded-lg px-4 py-2 transition-colors duration-150
```

### Button Danger
```
bg-red-50 text-red-700 hover:bg-red-100 font-medium rounded-lg px-4 py-2 transition-colors duration-150
```

### Input
```
bg-white border border-[#E5E7EB] focus:border-[#C4963C] focus:ring-1 focus:ring-[#C4963C]/30 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2 outline-none transition-colors duration-150 text-[15px]
```

### Table
```
Header:  text-gray-500 text-xs uppercase tracking-wider font-medium
Rows:    border-b border-[#E5E7EB]/50 hover:bg-gray-50/50
Stripe:  even:bg-slate-50/50
Padding: px-4 py-3
Height:  min-h-[48px] per row
```

### Status Badges (global — use StatusBadge component always)
```
En proceso:  bg-amber-50  text-amber-700  border border-amber-200  rounded-full px-2.5 py-0.5 text-xs font-medium
Cruzado:     bg-green-50  text-green-700  border border-green-200  rounded-full px-2.5 py-0.5 text-xs font-medium
Warning:     bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2.5 py-0.5 text-xs font-medium
Error:       bg-red-50    text-red-700    border border-red-200    rounded-full px-2.5 py-0.5 text-xs font-medium
Pending:     bg-gray-50   text-gray-600   border border-gray-200   rounded-full px-2.5 py-0.5 text-xs font-medium
T-MEC:       bg-amber-50  text-[#8B6914] border border-amber-200  rounded-full px-2.5 py-0.5 text-xs font-medium
```

### Skeleton Loading
```
bg-gray-200 animate-pulse rounded-md
```

### Empty State
```
text-center py-12 — always include: icon + message + action button
Never blank white space.
```

### Divider
```
border-t border-[#E5E7EB]
```

---

## SPACING SYSTEM

```
4px base: p-1(4) p-2(8) p-3(12) p-4(16) p-5(20) p-6(24) p-8(32)
No arbitrary values. Use the Tailwind scale.

Card gap:      gap-4 (16px)  or gap-6 (24px)
Section gap:   space-y-6 (24px) or space-y-8 (32px)
Page padding:  px-6 py-6 (24px)
Sidebar width: w-64 (256px)
Max content:   max-w-7xl (1280px)
```

---

## ANIMATION RULES

```
Page load:       fade in 300ms, stagger children by 50ms
Cards:           hover:shadow transition-all duration-150
Buttons:         transition-colors duration-150
Modals:          fade + translateY(4px→0) in 200ms
Loading:         animate-pulse on skeleton elements
Status changes:  transition-colors duration-300
```

### Animation Principles
- Subtle and confident. Never bouncy, never spinning.
- 150ms for micro-interactions (hover, focus)
- 200ms for reveals (modals, dropdowns)
- 300ms for page transitions and status changes
- ease for most transitions, ease-out for entries

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
Max width: 1280px (max-w-7xl)

KPI cards:       grid-cols-2 on mobile, grid-cols-4 on desktop
Tables:          horizontal scroll on mobile, full width on desktop
Sidebar:         hidden on mobile → bottom nav or hamburger
Touch targets:   60px on mobile, 44px on desktop
```

---

## REFERENCE COMPONENT

This is the quality bar. Every component must match this specificity.

```tsx
import { cn } from '@/lib/utils'

type TraficoStatus = 'en_proceso' | 'cruzado' | 'detenido' | 'cancelado'

type TraficoCardProps = {
  trafico: string
  pedimento: string
  status: TraficoStatus
  clientName: string
  valorUsd: number
  fechaCruce: string | null
  onClick: () => void
}

const statusConfig: Record<TraficoStatus, { bg: string; text: string; border: string; label: string }> = {
  en_proceso: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'En Proceso' },
  cruzado:    { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', label: 'Cruzado' },
  detenido:   { bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-200',   label: 'Detenido' },
  cancelado:  { bg: 'bg-gray-50',  text: 'text-gray-600',  border: 'border-gray-200',  label: 'Cancelado' },
}

export function TraficoCard({
  trafico,
  pedimento,
  status,
  clientName,
  valorUsd,
  fechaCruce,
  onClick,
}: TraficoCardProps) {
  const s = statusConfig[status]

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full bg-white border border-[#E5E7EB] rounded-xl p-5 text-left',
        'hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-[#C4963C]/20',
        'transition-all duration-150 group'
      )}
    >
      {/* Header: Pedimento + Status */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-['JetBrains_Mono'] text-[15px] font-medium text-gray-900">
          {pedimento}
        </span>
        <span className={cn(
          s.bg, s.text, 'border', s.border,
          'rounded-full px-2.5 py-0.5 text-xs font-medium'
        )}>
          {s.label}
        </span>
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <p className="text-sm text-gray-500">{clientName}</p>
        <div className="flex items-center justify-between">
          <span className="font-['JetBrains_Mono'] text-[13px] text-gray-900">
            ${valorUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
          </span>
          <span className="font-['JetBrains_Mono'] text-[11px] text-gray-400">
            {fechaCruce
              ? new Date(fechaCruce).toLocaleDateString('es-MX')
              : 'Sin cruce'}
          </span>
        </div>
      </div>
    </button>
  )
}
```

---

## WHAT NEVER TO DO

- NEVER use dark/black backgrounds outside sidebar and login/CRUZ AI screens
- NEVER use Inter, Roboto, Arial, or system fonts as primary
- NEVER use purple gradients or blue as primary accent
- NEVER hardcode hex colors in components — use CSS variables or Tailwind tokens
- NEVER create separate CSS files — Tailwind utilities only
- NEVER inline badge styles — use StatusBadge component
- NEVER leave empty states as blank white space

---

*CRUZ Design System · Renato Zapata & Company · Patente 3596*
*Last verified against live portal: 2026-04-02*
