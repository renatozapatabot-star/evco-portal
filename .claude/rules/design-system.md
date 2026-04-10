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
