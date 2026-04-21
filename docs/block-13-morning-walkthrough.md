# Block 13 — Morning Walkthrough (Subjective Items)

Deferred from Phase 2. For Renato's review on 2026-04-09.

## Cockpit Polish (Subjective)

- [ ] Touch targets: Some WorkflowCard action buttons are 44px (WCAG). CRUZ standard is 60px. Review whether all card buttons need upsizing for the 3 AM Driver standard.
- [ ] BrokerView narrative text: The `dashboardStory()` function could produce more dynamic text with client-specific insights. Currently generic.
- [ ] KPI cards: Could show trend arrows (up/down vs yesterday). Data exists in `trafico_timeline` but not surfaced.
- [ ] Morning brief component (`morning-briefing.tsx`) exists but is not wired to the cockpit. Decide: surface on operator cockpit as a collapsible section?
- [ ] Part 5 skill cards show "proximamente" — track when each skill has enough data to go live.

## Medium/Minor Audit Findings (from Phase 1)

- [ ] `/documentos` EmptyState: currently uses inline text. Should use `<EmptyState />` component for consistency. (AMBER)
- [ ] English string in LEGAL_DOCS array fixed ("USMCA certificates on file" → Spanish). Verify no other English strings remain.
- [ ] `/garantia` page: static marketing content, now admin-only. Consider if it should be client-visible.

## Credentials Follow-Up

- [ ] Monitor `operator_actions` for `view_page` entries from newly activated accounts within 48 hours
- [ ] Follow up via WhatsApp if no login within 72 hours
- [ ] Track trial_clients.login_count for conversion metrics
