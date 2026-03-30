---
description: >
  Complete build quality sequence for CRUZ portal. Covers all three gates:
  pre-build stress test, pre-deploy code quality (ten-out-of-ten + critique-loop),
  and post-deploy visual verification (Claude in Chrome). Run the full sequence
  after every build prompt before moving to the next step. Use when starting
  a build, finishing a component, deploying to Vercel, or auditing the live
  portal. Also triggers on: "run the sequence", "full quality check", "is this
  ready to ship", "pre-deploy check", "run audit", "quality gate".
argument-hint: [0 | 1 | 1.5 | 2 | 3 | final]
---

# CRUZ Build Quality Sequence

## THE COMPLETE SEQUENCE (every build prompt, no exceptions)

```
GATE 1 — PRE-BUILD      stress-test the build document
         ↓
GATE 2 — BUILD          write the code
         ↓
GATE 3 — PRE-DEPLOY     ten-out-of-ten → critique-loop Lean mode
         ↓
GATE 4 — DEPLOY         git push → Vercel green checkmark
         ↓
GATE 5 — POST-DEPLOY    /audit in Claude in Chrome
         ↓
         fix all failures → next prompt
```

Pre-deploy catches code quality before it ships.
Post-deploy catches visual regressions after it ships.
Both are required. Skipping either accumulates debt.

---

## GATE 1 — STRESS TEST (before writing any code)

Use the `stress-test` skill on the build document.
Ask: *"Stress test CRUZ_MONDAY_BUILD.md Session 3"*

What it catches:
- SQL column names that don't match the actual schema
- Missing env vars the script assumes exist
- Import paths that resolve to nothing
- Function signatures defined one way, called another
- Sections that depend on a previous section that hasn't run yet

**Pass condition:** No RED findings. YELLOW findings documented.
**If RED:** Fix the document before writing any code.

The 15 minutes here saves 2 hours debugging at 10 PM.

---

## GATE 3 — PRE-DEPLOY QUALITY (after code is written, before git push)

Run both tools. In order.

### Step A: ten-out-of-ten

Use the `ten-out-of-ten` skill. Domain: `frontend`.
Ask: *"Rate this component 10/10 — domain frontend"* and paste the code.

CRUZ-specific checks it enforces:
- Design system tokens only (no hardcoded hex outside tailwind.config)
- JetBrains Mono on ALL financial figures and timestamps
- Empty state exists for every table and list
- WCAG AA contrast — gold text uses #8B6914 not #C9A84C on light bg
- Touch targets ≥ 44px on mobile
- No dark palette classes in portal components
- StatusBadge component used, never inline badge styles
- client_code filter present on every Supabase query

**Pass condition:** Score ≥ 9.0, or only CRAFT gaps remaining.
**If below 9.0:** Apply fixes and re-rate before moving to critique-loop.

### Step B: critique-loop (Lean mode)

Use the `critique-loop` skill. Domain: `frontend`. Mode: `Lean`.
Ask: *"Run critique loop Lean mode on this — frontend domain"*

What Opus catches that ten-out-of-ten misses:
- Accessibility violations (aria-labels, focus rings, reduced motion)
- Race conditions in async data fetching
- XSS risk in any rendered string (especially CRUZ AI output)
- N+1 Supabase queries hiding in component renders
- Cross-client data exposure in query patterns

**Pass condition:** Opus score ≥ 8.5. No CRITICAL findings.
**If Opus finds CRITICAL:** Fix before deploying. No exceptions.

**Cost:** Lean mode ~$0.17–0.31. Run it. The deploy cost of a bug is higher.

---

## GATE 5 — POST-DEPLOY VISUAL AUDIT

Portal: evco-portal.vercel.app
Login: evco2026

Paste the appropriate prompt into Claude in Chrome after Vercel goes green.

---

## AUDIT 0 — BASELINE (before any code changes)

```
Go to evco-portal.vercel.app, log in with evco2026.
Navigate every page in the sidebar. Report:
- Total pages that load vs 404
- Any dark mode remnants (dark backgrounds, light text on dark)
- Any broken layouts or empty white screens
- Current sidebar state and nav item count
- Any TypeScript or console errors visible
This is the baseline. Everything found here existed before the build.
```

---

## AUDIT 1 — AFTER UI PASS (Prompt 1)

```
Go to evco-portal.vercel.app, log in with evco2026.
Audit every page. Report everything that looks wrong:
- CRUZ logo visible in sidebar with correct crimson Z mark
- Sidebar has exactly 13 nav items with correct Spanish labels
- KPI values use large Geist sans-serif font, not monospace
- Alert bar is collapsed to ~40px, expandable on click
- ⌘K opens the command palette
- No dark mode on any page (no dark backgrounds, no light-on-dark text)
- Cotización page is full light theme
- Tráficos table shows relative timestamps (e.g. "hace 2 horas")
- Expedientes page shows real coverage percentage, not 0%
- All cards use warm white canvas (#FAFAF8), not pure white or gray
- Gold accent (#C9A84C) used correctly on active nav and primary buttons
- No hardcoded dark colors surviving from old theme
List every failure with the page name and what specifically is wrong.
```

---

## AUDIT 1.5 — AFTER INTEGRATION PASS (Prompt 1.5)

```
Go to evco-portal.vercel.app, log in with evco2026.
Check live data integration on every page. Report:
- Dashboard KPIs show real numbers from Supabase, not placeholder text
- Tráficos table loads actual rows (should show 30+ rows)
- Expedientes coverage bar shows real percentage (~97.8%)
- Crossing intelligence shows real bridge wait times
- CRUZ AI chat responds when you type a message
- No loading spinners stuck permanently on any page
- No "Error fetching data" or similar error messages
- No empty tables that should have data
- Financial summary shows real MXN/USD figures
List every page where data is not loading correctly.
```

---

## AUDIT 2 — AFTER MOBILE PASS (Prompt 2)

```
Go to evco-portal.vercel.app, log in with evco2026.
Simulate 375px mobile viewport on every page. Report:
- Any content that overflows horizontally
- Any buttons or tap targets visually smaller than 44px
- Any tables that don't have horizontal scroll
- Any text that's too small to read (under 14px effective)
- Whether the bottom navigation works and all items are reachable
- Whether the sidebar is hidden on mobile and replaced by bottom nav
- Whether the dashboard is readable without zooming
- Any page where mobile layout is completely broken
Report each failure with page name and specific element.
```

---

## AUDIT 3 — FINAL (before client sees it)

```
Go to evco-portal.vercel.app, log in with evco2026.
Full audit against the three CRUZ standards.

STANDARD 1 — 11 PM EXECUTIVE:
Open the dashboard. Without clicking anything, can you tell
in 3 seconds whether operations are normal or there's a problem?
What do you see first? Is it reassuring or alarming?

STANDARD 2 — SAT AUDIT:
Pick any tráfico from the tráficos table. Can you trace:
- Which pedimento it corresponds to?
- What documents are attached?
- What the declared value was?
- Who filed it and when?
Is the audit trail complete and visible?

STANDARD 3 — 3 AM DRIVER:
On mobile (375px), starting from the dashboard, how many taps
does it take to find the current status of a specific tráfico?
Is it under 10 seconds with one hand?

Report every failure against any of the three standards.
Also report anything that looks unprofessional, alarming, or confusing
that a client (Ursula Banda, plant manager) would notice on first use.
```

---

## PASS CONDITIONS (all gates)

| Gate | Tool | Pass condition | Fail = |
|------|------|---------------|--------|
| 1 | stress-test | 0 RED findings | Fix doc before coding |
| 3A | ten-out-of-ten | Score ≥ 9.0 | Fix and re-rate |
| 3B | critique-loop | Opus ≥ 8.5, 0 CRITICAL | Fix before deploy |
| 5-0 | Chrome | Baseline documented | Always passes |
| 5-1 | Chrome | 0 dark mode survivors | Fix, re-audit |
| 5-1.5 | Chrome | All data loads | Fix, re-audit |
| 5-2 | Chrome | 0 mobile overflows | Fix, re-audit |
| 5-3 | Chrome | All 3 standards pass | Fix, re-audit |

Target score after Gate 5-3: **8.8–9.0**

---

## THE RULE

No build ships to the next prompt without all 5 gates passing.

```
Prompt 1 → Gates 1-5 → Prompt 1.5 → Gates 1-5 → Prompt 2 →
Gates 1-5 → Prompt 3 → Gates 1-5 → SHIP
```

Gate 3 (pre-deploy) and Gate 5 (post-deploy) are both required.
One catches code quality. The other catches visual regressions.
Skipping either is how bugs reach Ursula.

---

## AUDIT 0 — BASELINE (before any code changes)

```
Go to evco-portal.vercel.app, log in with evco2026.
Navigate every page in the sidebar. Report:
- Total pages that load vs 404
- Any dark mode remnants (dark backgrounds, light text on dark)
- Any broken layouts or empty white screens
- Current sidebar state and nav item count
- Any TypeScript or console errors visible
This is the baseline. Everything found here existed before the build.
```

---

## AUDIT 1 — AFTER UI PASS (Prompt 1)

```
Go to evco-portal.vercel.app, log in with evco2026.
Audit every page. Report everything that looks wrong:
- CRUZ logo visible in sidebar with correct crimson Z mark
- Sidebar has exactly 13 nav items with correct Spanish labels
- KPI values use large Geist sans-serif font, not monospace
- Alert bar is collapsed to ~40px, expandable on click
- ⌘K opens the command palette
- No dark mode on any page (no dark backgrounds, no light-on-dark text)
- Cotización page is full light theme
- Tráficos table shows relative timestamps (e.g. "hace 2 horas")
- Expedientes page shows real coverage percentage, not 0%
- All cards use warm white canvas (#FAFAF8), not pure white or gray
- Gold accent (#C9A84C) used correctly on active nav and primary buttons
- No hardcoded dark colors surviving from old theme
List every failure with the page name and what specifically is wrong.
```

---

## AUDIT 1.5 — AFTER INTEGRATION PASS (Prompt 1.5)

```
Go to evco-portal.vercel.app, log in with evco2026.
Check live data integration on every page. Report:
- Dashboard KPIs show real numbers from Supabase, not placeholder text
- Tráficos table loads actual rows (should show 30+ rows)
- Expedientes coverage bar shows real percentage (~97.8%)
- Crossing intelligence shows real bridge wait times
- CRUZ AI chat responds when you type a message
- No loading spinners stuck permanently on any page
- No "Error fetching data" or similar error messages
- No empty tables that should have data
- Financial summary shows real MXN/USD figures
List every page where data is not loading correctly.
```

---

## AUDIT 2 — AFTER MOBILE PASS (Prompt 2)

```
Go to evco-portal.vercel.app, log in with evco2026.
Simulate 375px mobile viewport on every page. Report:
- Any content that overflows horizontally
- Any buttons or tap targets visually smaller than 44px
- Any tables that don't have horizontal scroll
- Any text that's too small to read (under 14px effective)
- Whether the bottom navigation works and all items are reachable
- Whether the sidebar is hidden on mobile and replaced by bottom nav
- Whether the dashboard is readable without zooming
- Any page where mobile layout is completely broken
Report each failure with page name and specific element.
```

---

## AUDIT 3 — FINAL (before client sees it)

```
Go to evco-portal.vercel.app, log in with evco2026.
Full audit against the three CRUZ standards.

STANDARD 1 — 11 PM EXECUTIVE:
Open the dashboard. Without clicking anything, can you tell
in 3 seconds whether operations are normal or there's a problem?
What do you see first? Is it reassuring or alarming?

STANDARD 2 — SAT AUDIT:
Pick any tráfico from the tráficos table. Can you trace:
- Which pedimento it corresponds to?
- What documents are attached?
- What the declared value was?
- Who filed it and when?
Is the audit trail complete and visible?

STANDARD 3 — 3 AM DRIVER:
On mobile (375px), starting from the dashboard, how many taps
does it take to find the current status of a specific tráfico?
Is it under 10 seconds with one hand?

Report every failure against any of the three standards.
Also report anything that looks unprofessional, alarming, or confusing
that a client (Ursula Banda, plant manager) would notice on first use.
```


---

## PASS CONDITIONS (all gates)

| Gate | Tool | Pass condition | Fail = |
|------|------|---------------|--------|
| 1 | stress-test | 0 RED findings | Fix doc before coding |
| 3A | ten-out-of-ten | Score ≥ 9.0 | Fix and re-rate |
| 3B | critique-loop | Opus ≥ 8.5, 0 CRITICAL | Fix before deploy |
| 5-0 | Chrome | Baseline documented | Always passes |
| 5-1 | Chrome | 0 dark mode survivors | Fix, re-audit |
| 5-1.5 | Chrome | All data loads | Fix, re-audit |
| 5-2 | Chrome | 0 mobile overflows | Fix, re-audit |
| 5-3 | Chrome | All 3 standards pass | Fix, re-audit |

Target score after Gate 5-3: **8.8–9.0**

---

## THE RULE

No build ships to the next prompt without all 5 gates passing.

```
Prompt 1 → Gates 1-5 → Prompt 1.5 → Gates 1-5 → Prompt 2 →
Gates 1-5 → Prompt 3 → Gates 1-5 → SHIP
```

Gate 3 (pre-deploy) and Gate 5 (post-deploy) are both required.
One catches code quality. The other catches visual regressions.
Skipping either is how bugs reach Ursula.
