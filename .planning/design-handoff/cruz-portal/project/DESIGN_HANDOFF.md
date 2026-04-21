# CRUZ Design System — Handoff Guide

**For:** Claude Code, connecting this theme to the live `renatozapata.com` portal.
**Version:** 1.0 · Abril 2026
**Owner:** Renato Zapata & Co · Agente Aduanal · Patente 3596

---

## What this package is

A complete, production-ready visual language for the CRUZ client portal. Dark, mission-control vibe with editorial serif headlines, monospace for all data, and emerald reserved exclusively for "live / healthy" signals.

Everything lives in **CSS variables** — no design tokens buried in JSX. Swap the two stylesheets into your project and every CRUZ primitive is themed correctly.

---

## File map

```
styles/
  tokens.css          ← the source of truth. Colors, type, spacing, motion, radius.
  components.css      ← reusable class primitives (cruz-btn, cruz-card, cruz-badge, …)

src/
  primitives.jsx            ← <Icon>, <Sparkline>, <Ticker>, <Badge>, <CruzMark>
  screen-login.jsx          ← full login screen reference
  screen-dashboard.jsx      ← dashboard shell, hero, modules grid
  screen-dashboard-extras.jsx  ← <CrucesMap>, <Anexo24Table>, <OnboardingTour>
  screen-detail-system.jsx  ← Pedimento detail + Design System reference page
  tweaks.jsx                ← live theme-switcher panel

CRUZ Portal.html      ← the live prototype that wires it all together
```

---

## Step 1 — Drop tokens into your codebase

Copy `styles/tokens.css` and `styles/components.css` into your project's global styles folder. In Next.js:

```
app/
  globals.css   ← import 'tokens.css' and 'components.css' at the top
  layout.tsx    ← add <body className="cruz-grain"> for the film-grain overlay
```

```css
/* globals.css */
@import './tokens.css';
@import './components.css';
```

In the `<head>` of your root layout, load the three fonts we committed to:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,200;9..144,300;9..144,400;9..144,500&family=Inter+Tight:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
```

That's it — every page in the portal now inherits the CRUZ theme. Your existing React components will render against the dark canvas without changes; if you're on Tailwind, skip to Step 3.

---

## Step 2 — Use the tokens

**Always reference tokens via `var(--cruz-*)`.** Never hardcode hex values.

```css
/* ✅ Correct */
.my-card { background: var(--cruz-ink-3); border: 1px solid var(--cruz-line-1); color: var(--cruz-fg-1); }

/* ❌ Wrong — you lose theming, accent swap, density swap */
.my-card { background: #16171c; border: 1px solid rgba(255,255,255,0.06); color: #f8f9fa; }
```

### The token families

| Family | Examples | Use for |
|---|---|---|
| `--cruz-ink-0..5` | void → card hover | Backgrounds, surfaces |
| `--cruz-fg-1..5` | titles → quietest | Text |
| `--cruz-green-1..5` | emerald scale | **Only** "live / healthy" |
| `--cruz-ice-1..4` | cool blue | Secondary info |
| `--cruz-amber`, `--cruz-red` | warn / alert | Reserved for real alerts |
| `--cruz-line-1..3` | hairline → focus | Borders |
| `--cruz-fs-micro..5xl` | 10px → 112px | Type scale |
| `--cruz-s-1..11` | 4px → 96px | Spacing on 4px grid |
| `--cruz-r-1..5`, `--cruz-r-pill` | 4px → pill | Radii |
| `--cruz-shadow-1..3`, `--cruz-shadow-glow` | Elevation |
| `--cruz-ease-out`, `--cruz-dur-1..4` | Motion curves + timing |

---

## Step 3 — Tailwind users

Map Tailwind's theme to the CRUZ tokens in `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        ink: { 0: 'var(--cruz-ink-0)', 1: 'var(--cruz-ink-1)', 2: 'var(--cruz-ink-2)', 3: 'var(--cruz-ink-3)', 4: 'var(--cruz-ink-4)', 5: 'var(--cruz-ink-5)' },
        fg:  { 1: 'var(--cruz-fg-1)',  2: 'var(--cruz-fg-2)',  3: 'var(--cruz-fg-3)',  4: 'var(--cruz-fg-4)',  5: 'var(--cruz-fg-5)' },
        emerald: { 1: 'var(--cruz-green-1)', 2: 'var(--cruz-green-2)', 3: 'var(--cruz-green-3)' },
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans:    ['Inter Tight', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: 'var(--cruz-r-2)',
        lg: 'var(--cruz-r-4)',
        pill: 'var(--cruz-r-pill)',
      },
    }
  }
}
```

Now `bg-ink-1 text-fg-1 border-line-1 font-display` all work.

---

## Step 4 — Grab components, don't rebuild them

The primitives in `src/primitives.jsx` (`<Icon>`, `<Sparkline>`, `<Ticker>`, `<Badge>`, `<CruzMark>`) are framework-agnostic React. Port them as-is into your Next.js / Vite / whatever project. They reference CSS variables — zero style-in-JS coupling.

The larger screen components (`DashboardScreen`, `CrucesMap`, `Anexo24Table`, `OnboardingTour`) are **reference implementations** — copy the layout and JSX, then swap mock data for your real API calls.

### Class primitives you can apply anywhere

- `.cruz-btn` + `--primary | --ghost | --accent` + `--sm | --lg | --icon`
- `.cruz-card` + `--raised | --interactive | --hero`
- `.cruz-badge` + `--live | --info | --warn | --alert`
- `.cruz-input`, `.cruz-label`
- `.cruz-table` with `.num` cells for mono numerics
- `.cruz-progress` + `.cruz-progress__fill`
- `.cruz-pulse`, `.cruz-scan`, `.cruz-grain` (effects)
- `.cruz-eyebrow`, `.cruz-meta`, `.cruz-num` / `.cruz-tabular`
- `.cruz-kbd` for keyboard key visuals
- `.cruz-avatar`

---

## Step 5 — The six design principles (keep this nearby)

1. **Los números son el producto.** Tabular, big, confident. Display serif for heroes, mono for dense data.
2. **Emerald has one job.** "Live / healthy" only. Never for hovers, never for decoration.
3. **Surfaces stack.** Five levels of ink, hairlines at 6–16% alpha. Everything has intentional depth.
4. **Ambient motion.** Pulses, scan lines, breathing sparklines. The system is alive — subtly.
5. **Monospace for metadata.** Patentes, fractions, IDs, timestamps — anything ID-like is mono.
6. **Tradition + precision.** Est. 1941 belongs in footers and logins. Weight without noise.

---

## Step 6 — Working with Claude Code

Point Claude Code at this project and tell it something like:

> "Use `styles/tokens.css` as the design-system source of truth. Reference every color, space, and radius via `var(--cruz-*)` — never hardcode. Primitives live in `src/primitives.jsx`. Reference screens are in `src/screen-*.jsx`. Follow the six principles in `DESIGN_HANDOFF.md`. The brand is Renato Zapata & Co · Patente 3596. Emerald is reserved for 'live / healthy' states only."

When you ask Claude Code to build a new screen (e.g. "build the Expedientes module"), tell it which reference screen to mirror — "follow the pattern of `screen-dashboard.jsx`, use `<CrucesMap>` as the density/visualization reference, use `Anexo24Table` for the table treatment."

---

## Step 7 — Tweaks as a staging tool

The `tweaks.jsx` panel (toggle in the toolbar) lets you preview accent swaps, density, and type pairing **live** on the prototype. Use it to decide before committing. The values it writes are valid JSON between the `EDITMODE-BEGIN/END` markers in `CRUZ Portal.html`.

---

## Quick answers

**"Can I change the accent from emerald to teal?"**
Yes — `<html data-accent="teal">` or `data-accent="lime"`. Everything re-themes.

**"Can I tighten density?"**
`<html data-density="compact">`. Spacing tokens collapse.

**"Dark only?"**
For now, yes. A light mode would require redefining `--cruz-ink-*` and `--cruz-fg-*` — straightforward but deliberate work.

**"Accessibility?"**
Text contrast passes WCAG AA at `fg-1..3` on any `ink-*`. `fg-4/5` are label-only. Don't use them for body copy.

---

## Contact points baked into the system

- Est. 1941 line
- Patente 3596 · Aduana 240 meta chips
- "La frontera, en claro." — brand tagline (swap `Sin Fronteras` alt in copy if preferred)
- CRUZ wordmark: Fraunces 200, `letter-spacing: 0.24em` on hero, `0.5em` on nav

---

That's the whole package. The prototype at `CRUZ Portal.html` is both the spec and the sandbox. Screenshot any screen for stakeholder review; hand the tokens + this guide to Claude Code to build the rest.
