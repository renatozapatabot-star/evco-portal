---
description: Critical invariants from CRUZ audit sessions. These caused real regressions when violated. Loads on every file touch.
paths:
  - "**/*"
---

# Core Invariants — CRUZ

These rules load on every file edit. They exist because violating them caused real design/security regressions during CRUZ development.

1. **No hardcoded colors.** Every color in the portal must use v5.0 design system tokens (warm canvas `#FAFAF8`, gold accent `#C9A84C`, border `#E8E5E0`, defined in `tailwind.config`). Hardcoded hex values outside of `tailwind.config` or the design system file = violation. Dark palette (`bg-slate-950`, `#0A0A0A`) is for PDF report generation ONLY — never in portal UI components.

2. **Badge consistency across ALL pages.** Status badges must use the same color mapping everywhere: blue=active, green=completed, amber=warning, red=error, gray=pending. The badge inconsistency between tráficos and pedimentos pages was flagged in three separate critique sessions.

3. **Every table has an empty state.** No blank white space when a table has zero rows. Must show: icon + descriptive message + primary action button. Empty columns on the tráficos page were a recurring critique.

4. **Cross-link entities.** Tráficos link to their pedimentos and expedientes. Pedimentos link back to their tráfico. Documents link to their parent entity. The missing cross-linking between tráficos ↔ expedientes/entradas was identified as the gap between "dashboard" and "operational tool."

5. **Sanitize all AI output before rendering.** CRUZ AI responses go through DOMPurify or equivalent before `dangerouslySetInnerHTML`. The XSS risk in CRUZ AI was flagged as a security gap that blocked the 9+ rating.

6. **RLS on every Supabase table, tested in the migration file.** If you create or modify a table, the same PR must include the RLS policy AND a comment showing the expected behavior. Cross-client data leakage is catastrophic for a customs brokerage.

7. **44px minimum touch targets on mobile.** Every clickable element must meet WCAG touch target guidelines. This was part of the final gap analysis for mobile usability.
