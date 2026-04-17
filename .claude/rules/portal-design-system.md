# PORTAL Design System — canonical rules (Block DD · 2026-04-17)

Ported verbatim from `/tmp/portal_design/cruz-portal/project/DESIGN_HANDOFF.md`
with renames `--cruz-*` → `--portal-*` and `.cruz-*` → `.portal-*`. This file
supersedes the v5/v6 `design-system.md` for every surface migrated in Block DD.
`design-system.md` remains authoritative for legacy surfaces until each is
ported to the PORTAL primitives.

---

## The six principles

1. **Los números son el producto.** Tabular, big, confident. Instrument Serif
   for hero headlines, Geist Mono for dense data.
2. **Emerald has one job.** `--portal-green-*` is reserved for "live / healthy"
   signals only. Never for hovers, never for decoration, never for a button
   that isn't confirming a live state.
3. **Surfaces stack.** Five levels of ink (`--portal-ink-0..5`), hairlines at
   6–16% alpha via `--portal-line-*`. Everything has intentional depth.
4. **Ambient motion.** Pulses, scan lines, breathing sparklines. The system
   is alive — subtly. All animations gated by `prefers-reduced-motion: reduce`
   OR `[data-motion="off"]` on `<html>`.
5. **Monospace for metadata.** Patentes, fractions, IDs, timestamps — anything
   ID-shaped renders in Geist Mono via `.portal-num` / `.portal-tabular`.
6. **Tradition + precision.** "Est. 1941" belongs in footers and logins. The
   wordmark is PORTAL in Instrument Serif at `letter-spacing: 0.24em` on
   hero surfaces, `0.5em` on nav.

---

## Token contract

Every color, spacing, radius, shadow, duration, and font-size on every
new surface routes through `--portal-*` variables defined in
`src/app/portal-tokens.css`. Hardcoded hex values on new surfaces are a
ratchet violation — route through a token or add the `// design-token`
inline comment explaining the intentional exception.

The legacy alias layer at the bottom of `portal-tokens.css` maps every
`--aguila-*` / `--cruz-*` variable to its `--portal-*` equivalent. Existing
consumers keep working; do not rename them as part of Block DD.

---

## Theme-swap contract

Five `data-*` attributes on `<html>` drive live theme swaps. Defaults
selected in `src/lib/portal/theme.ts`:

| Attribute | Values | Default |
|---|---|---|
| `data-accent` | emerald / teal / lime | emerald |
| `data-bg` | void / near / blueprint | void |
| `data-density` | compact / comfortable / spacious | comfortable |
| `data-type` | editorial / grotesque / mono-all | editorial |
| `data-motion` | on / off | on (auto-off under `prefers-reduced-motion: reduce`) |

The `portal_theme` cookie (parsed by `parsePortalTheme`) persists user
choices. `POST /api/portal/theme` writes the cookie. `ThemeSwitcher`
(admin/broker-only) is the canonical picker.

---

## Class primitives (apply anywhere)

- `.portal-btn` + `--primary | --ghost | --accent` + `--sm | --lg | --icon`
- `.portal-card` + `--raised | --interactive | --hero`
- `.portal-badge` + `--live | --info | --warn | --alert`
- `.portal-input`, `.portal-label`
- `.portal-table` with `.num` cells for mono numerics
- `.portal-progress` + `.portal-progress__fill`
- `.portal-pulse`, `.portal-scan`, `.portal-grain` (effects)
- `.portal-eyebrow`, `.portal-meta`, `.portal-num` / `.portal-tabular`
- `.portal-kbd` for keyboard key visuals
- `.portal-ticker`, `.portal-metric`, `.portal-row`, `.portal-spark`

---

## Brand wordmark contract

- "PORTAL" in Instrument Serif, `font-weight: 400`, `font-style: normal`
- `letter-spacing: 0.24em` on login / hero; `0.5em` on nav-compact variants
- Hero sizes: `--portal-fs-5xl` (112px) desktop, `--portal-fs-3xl` (56px) mobile
- Gradient fill: silver (`#E8EAED → #C0C5CE → #7A7E86`) only;
  gold gradient is retired for the wordmark

Internal `AguilaWordmark` component is the single render site; filename
preserved but `WORDMARK_TEXT = 'PORTAL'`.

---

## Grain overlay

`<body class="portal-grain">` adds the SVG turbulence-noise film overlay
defined in `portal-tokens.css`. This is on every authenticated surface
starting Block DD. The overlay respects `prefers-reduced-motion` and is
static (non-animating) by default.

---

## Enforcement

1. `grep -rn "#[0-9a-fA-F]\{6\}" src/app` ratchet — no new hex values.
2. `grep -rn "fontSize: [0-9]" src/app` ratchet — use `var(--portal-fs-*)`
   or inline `// WHY:` comment.
3. `grep -rn "\\bCRUZ\\b" src/app src/components` — matches only in JSDoc
   headers, identifier names, and real carrier business names.
4. `grep -rn "--cruz-" src/app src/components` — zero matches (design
   tokens renamed) except the legacy alias block in `portal-tokens.css`.
5. New `portal-tokens.test.ts` snapshot guards the token file against
   silent drift.

---

*Codified in Block DD · 2026-04-17. Every future surface migration follows
this file first and `.claude/rules/block-discipline.md` second.*
