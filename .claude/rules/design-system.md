---
description: CRUZ Design System enforcement rules from the 23-section audit
paths:
  - "src/components/**/*"
  - "src/app/dashboard/**/*"
  - "src/app/**/page.tsx"
  - "src/app/**/layout.tsx"
  - "tailwind.config*"
---

# CRUZ Design System v5.0 Rules

These rules encode the v5.0 spec. Warm light canvas, gold accent, Geist typography. **Any dark-mode references from earlier sessions are superseded.** Dark palette (#0A0A0A) is for PDF reports only.

## Color Tokens — No Exceptions

v5.0 warm canvas (portal UI):
- Page background/canvas: `#FAFAF8` (warm white)
- Card/surface: `#FFFFFF` with `border border-[#E8E5E0]`
- Elevated surface: `#FFFFFF` with shadow-sm
- Border: `#E8E5E0` (warm gray)
- Accent/Primary (gold): `#C9A84C` — primary buttons, active nav, branding, links
- Accent hover: `#B8933B`
- Text primary: `#1A1A1A`
- Text secondary: `#6B6B6B`
- Text muted: `#9B9B9B`

Dark palette (`#0A0A0A`, `#111111`, `bg-slate-950`) is for **PDF report generation only** (EVCO audit skill). Never use dark palette classes in portal components.

If you need a color not in this list, add it to `tailwind.config.ts` as a design token first. Never use arbitrary Tailwind values in component files without defining the token.

## Status Badges — Global Mapping

This mapping is enforced across every page. No per-page custom colors:

| Status | Tailwind | Use |
|--------|----------|-----|
| Active / En tránsito | `bg-amber-50 text-amber-700 border border-amber-200` | Tráfico active, in-transit |
| Completed / Liberado | `bg-green-50 text-green-700 border border-green-200` | Cleared, paid, done |
| Warning / Observación | `bg-orange-50 text-orange-700 border border-orange-200` | MVE approaching, partial docs |
| Error / Rechazado | `bg-red-50 text-red-700 border border-red-200` | Failed, rejected, overdue |
| Pending / En revisión | `bg-gray-50 text-gray-600 border border-gray-200` | Awaiting action |

Use the `<StatusBadge status={status} />` component. Never inline badge styles.

## Tables

- Every table MUST have an empty state: icon + message + CTA button.
- Column headers: `text-gray-500 text-xs font-medium uppercase tracking-wider`.
- Row hover: `hover:bg-[#F5F4F0]` (warm hover, not cold gray).
- No empty columns. If a column has no data for the current view, hide it or show "—".
- Sortable columns show sort indicator. Default sort must be meaningful (most recent first, highest priority first).
- Table borders: `border-[#E8E5E0]`. Not slate or gray defaults.

## Cards and Containers

- Card pattern: `bg-white border border-[#E8E5E0] rounded-lg p-4 shadow-sm` (or p-6 for larger cards).
- No nested cards with the same background. Inner elements use `bg-[#FAFAF8]` or subtle gold accent border.
- Card spacing between cards: `gap-4` minimum.

## Typography

- Font family: `Geist` for all UI text. `Geist Mono` for data.
- Headings: `font-semibold text-[#1A1A1A]`. Page titles: `text-2xl`. Section titles: `text-lg`.
- Body: `text-sm text-[#6B6B6B]`.
- Data values (pedimento numbers, fracciones, amounts): `font-mono` (Geist Mono).
- Amounts/currency: right-aligned, `font-mono tabular-nums`.

## Spacing

4px grid. Use only: `p-1 p-2 p-3 p-4 p-6 p-8`. Same for margin and gap.
No arbitrary spacing values.

## Mobile

- All layouts must work at 375px width.
- Touch targets: minimum 44px × 44px.
- Tables on mobile: horizontal scroll with sticky first column, OR card view.
- Navigation: bottom nav on mobile, sidebar on desktop.
- Test: resize browser to 375px before marking any UI task complete.

## Micro-interactions

- Loading states: skeleton loaders matching the layout shape, not spinners.
- Error states: inline error with retry action, not just red text.
- Success feedback: brief toast notification, auto-dismiss 3s.
- Transitions: `transition-colors duration-150` on interactive elements.

## Operational Depth (the gap between "dashboard" and "tool")

Every data view must support in-context actions. A tráfico card should let the user:
- See status at a glance (badge)
- Click through to detail (cross-link)
- Take the most common action without leaving the page (quick action button)

If a page is read-only with no actions, it's a dashboard, not a tool. CRUZ is a tool.
