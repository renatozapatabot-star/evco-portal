# HANDOFF — Tuesday 2026-04-21 · MARATHON-4 · Grok-Ready Acquisition Engine

Session owner: Renato Zapata IV via autonomous delegation.
Branch: `main`.
Mission: production-ready Client Acquisition Engine + foundations for
Grok Build when it arrives.

> **Prior marathons:** HANDOFF_2026_04_21_marathon_2.md (funnel),
> HANDOFF_2026_04_21_marathon_3.md (activity timeline + sales assets
> + PDF polish). Marathon-4 closed the last conversion gap + added
> the Grok Handbook.

---

## One-line summary

Prospect → Lead → Client is now a complete round-trip: one click
creates the tenant row, stamps the lead with provenance, logs the
event on the timeline. Pipeline view has stage filter chips + search.
Grok Build can walk in tomorrow and ship on day one.

---

## Commits shipped (8 commits · 4fb4e9e..2fe453f)

| # | Commit | What |
|---|---|---|
| 1 | `cbfef7e` | lead → client conversion (endpoint + UI), `qualified` stage, `AguilaStagePills` primitive |
| 2 | `d4d527b` | stage filter chips + firm search on /admin/leads |
| 3 | `77e0291` | Grok Build Handbook at `docs/grok-build-handbook.md` (646 lines) |
| 4 | `fac478b` | 37 tests + gate updates for test-fixture exemption |
| 5 | `189bcaa` | placeholder fix for multi-tenant isolation ratchet |
| 6 | `7988e12` | marathon-4 handoff (this file) |
| 7 | `df196e2` | recent activity feed + conversion hero metric + CSV export |
| 8 | `2fe453f` | AguilaCTA + AguilaStagePills demos in /admin/design gallery |

---

## Final state

| Gate | Status |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **1179 tests passing** (was 1142 at M3 close · +37 net new) |
| `bash scripts/gsd-verify.sh --ratchets-only` | 0 failures · 20 warnings (all at-floor) |
| Pre-commit hook | green on every commit |
| Supabase schema | in sync |

## New test coverage — 37 assertions

| File | Tests |
|---|---|
| `src/app/api/leads/[id]/convert/__tests__/route.test.ts` | 21 |
| `src/components/aguila/__tests__/AguilaStagePills.test.tsx` | 6 |
| `src/app/admin/leads/[id]/__tests__/LeadConvertCard.test.tsx` | 8 |
| `src/lib/leads/__tests__/types.test.ts` (delta) | +2 |

## New database objects

`supabase/migrations/20260421170000_leads_conversion_fields.sql`
**applied to prod**:

- `leads.client_code_assigned text` — nullable until conversion,
  then holds the `companies.company_id` of the created tenant
- `leads.converted_at timestamptz` — timestamp of conversion event
- 2 partial indexes (both `WHERE … IS NOT NULL`)

## New primitives

### `<AguilaStagePills>` — `src/components/aguila/AguilaStagePills.tsx`

Generic pill row for any discrete stage set. Extracted from
LeadDetailClient; reusable for OCA approval, onboarding progress,
workflow status, and future pipeline surfaces.

```tsx
<AguilaStagePills
  stages={[{ value: 'draft', label: 'Borrador' }, { value: 'approved', label: 'Aprobado', sub: '3' }]}
  current="draft"
  onChange={(next) => mutate({ stage: next })}
  saving={savingStage}      // null | T — shows clock icon on that pill
  disabled={locked}          // optional — disables every pill
  overflow="wrap" | "scroll" // mobile overflow behavior
/>
```

A11y: `role="radiogroup"` + `role="radio"` per pill + `aria-checked`.
Test fixture pattern: `getByRole('radio', { name: /^Nuevo$/ })`.

## New routes

- `POST /api/leads/[id]/convert` — admin/broker only
  - Validates slug ([a-z0-9-], 3-40, no consec dashes, lowercases)
  - Validates clave (\d{1,10}) or null
  - Loads lead · refuses if lead missing (404)
  - Idempotent: returns existing tenant if already converted
  - Refuses duplicate company_id (CONFLICT — prevents hijack)
  - Creates `companies` row with lead fields mapped
  - Stamps lead with `client_code_assigned + converted_at + stage='won'`
  - Rolls back companies insert if lead update fails
  - Emits `system` activity on timeline: "Convertido a cliente · tenant X"

## New UI

### `LeadConvertCard.tsx` on `/admin/leads/[id]`

Three-state component:

1. **Pre-won + not-converted:** renders nothing. Hidden.
2. **Won + not-converted:** inline form
   - `company_id` slug field auto-filled from `firm_name` via slugify
   - Clave GlobalPC (optional, digit-only input strip)
   - Language (es default / en)
   - Inline validation on slug (3-40 chars, format)
   - "Crear tenant" button (disabled when invalid)
3. **Already converted:** silver-green success banner
   - Company name + tenant slug (mono) + conversion date
   - "Ver en monitor →" link to `/admin/monitor/tenants`

### Stage filter chips + search on `/admin/leads`

`LeadsFilterBar.tsx` (client component):
- Chip row: **Todas | Nuevo | Contactado | Calificado | Demo agendado |
  Demo visto | Negociando | Ganado | Perdido | Nurture** (9 + 1)
- Each chip shows per-stage count (global, not filter-scoped)
- Active chip uses `portal-btn--primary`; inactive `--ghost`
- URL-driven: `?stage=won&q=acme` — shareable links
- Search input: debounced 220ms, matches `firm_name` OR `contact_name`
- Clear-search X button when text non-empty
- Server component reads `searchParams` and filters before rendering

## Stage pipeline (canonical — post-M4)

9 stages, in the standard funnel order:

```
new · contacted · qualified · demo-booked · demo-viewed ·
negotiating · won · lost · nurture
```

The new `qualified` stage represents "this lead is a fit" — real
company, right industry/volume, decision-maker identified. Tests
enforce the order (qualified between contacted + demo-booked).

## Grok Build Handbook

`docs/grok-build-handbook.md` (646 lines, 18 sections):

1. In one paragraph (what this is)
2. Table of contents
3. Stack + repo layout
4. PORTAL v1 design system (tokens over hex, 3 glass tiers)
5. aguila primitive cheat sheet (30+ primitives, one-line usage)
6. Invariants that never bend (15 load-bearing)
7. How to add a new admin page (copy-paste template)
8. How to add a new public/marketing page (template)
9. How to add a new API endpoint (template + CSRF notes)
10. How to add a new Supabase migration (commands + idempotency)
11. Tenant isolation (READ THIS)
12. Lead → client conversion flow (end-to-end)
13. Testing + gates
14. Ratchet system
15. Sales machine end-to-end (assets + surfaces + APIs)
16. When NOT to ship (12 anti-patterns)
17. Useful shortcuts
18. Quick-reference links

**The handbook is the single doc a new builder reads to be
productive on day one.** Updated as the repo evolves.

### Addendum — operational dashboard polish (commits 7 + 8)

Three surfaces added after the initial handoff that close daily-ops
gaps:

**Recent activity feed on `/admin/leads`** — `RecentActivityFeed.tsx`.
Last 15 activities across ALL leads, joined with `firm_name`.
Kind-iconed rows link to `/admin/leads/[id]`. Humanized relative time
("hace 3 h", "hace 2 d", "hace un momento"). Morning standup view.

**Conversion hero metric** — new `<AguilaMetric>` in the hero row:
"Convertidos · N · NN% del total". Visible above-the-fold sales funnel
health signal. Paired with existing Total / Acciones / Demo vistos /
Ganados metrics.

**CSV export** — `GET /api/leads/export` admin/broker-only. Streams 26
columns (raw enum + human label + all context fields + conversion
fields). Honors `?stage=` + `?q=` so "export current view" is one
click. Filename `leads-{stage?}-{YYYY-MM-DD}.csv`. Board-reporting
leverage + future-CRM migration insurance.

**/admin/design gallery** — AguilaCTA + AguilaStagePills demos added.
StagePillsDemo is an interactive island (`'use client'`) so the
gallery can host callback-requiring primitives without becoming a
full client component.

---

## Security posture (new surfaces)

| Surface | Auth | CSRF | RLS |
|---|---|---|---|
| `POST /api/leads/[id]/convert` | admin/broker 401 | cookie double-submit | service role (bypasses RLS) |
| `GET /api/leads/export` | admin/broker 401 | N/A (GET) | service role (bypasses RLS) |

Guardrails:
- Slug must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` — prevents SQL
  identifier injection downstream
- Unique company_id check before insert — prevents hijacking an
  active tenant by converting a lead into its slug
- Rollback on lead update failure keeps companies + leads consistent
- Idempotent on re-run

---

## What's intentionally NOT shipped

- **Full onboarding checklist** (RFC confirmed, GlobalPC clave
  received, credentials sent, RLS tested). Would be a 5-step
  checklist state machine on the convert card. Current flow assumes
  team tracks these as manual activities — still auditable.
- **Auto-invite to portal after conversion.** No magic-link email
  auto-sent. Credentials remain a human-authorized step per the
  CLAUDE.md approval gate.
- **Unconvert / revert conversion.** The `companies` row is created
  but never deleted by app code (rollback only fires on transaction
  failure, not manual revert). Intentional — tenant creation is a
  one-way door for auditability.
- **Kanban drag-between-stages view.** The chip filter is enough for
  the first 50 leads. Kanban ROI only makes sense at 200+ lead
  volumes.
- **Per-user ownership filter** (e.g. "show only my leads"). Team is
  still 2 people; noise.

---

## Reproducing the state

```bash
cd ~/evco-portal
git fetch --all
git checkout main
git log --oneline 4fb4e9e..HEAD | wc -l                         # 5
npm install
npx tsc --noEmit                                                # 0 errors
npx vitest run                                                  # 1179/1179
bash scripts/gsd-verify.sh --ratchets-only                      # 0 failures
```

---

## Pending backlog

| # | Task | Blocker |
|---|---|---|
| Task 9 | Reduce scripts/ silent-catch baseline (153→?) | Pending fix/pdf merge |
| — | First real conversion (EVCO lead → evco tenant linked retroactively?) | Decide if EVCO legacy-tenant gets a lead row for history |
| — | Case study: get Ursula's written approval | Human workflow |
| — | Cal.com booking widget on /pitch | Cal.com vs Calendly choice |
| — | Mensajería hook on conversion event | Automation gate — after 5 close cycles prove the rules |

---

## Ready for Grok Build

Every piece Grok will need to ship on day one:

- **Handbook at `docs/grok-build-handbook.md`** — one read, productive
- **41+ primitives in `src/components/aguila/`** — composition, not
  reimplementation
- **Ratchet-gated consistency** — violations fail loudly
- **3 marathon handoffs** — M2, M3, M4 — explain the shipping cadence
- **1179 regression fences** — hard to break what's shipped
- **Complete sales machine** — prospect → lead → pipeline → client
- **One canonical SQL migration pattern** — copy/paste works
- **Token-pure design system** — no hex, no inline glass, no fontSize
  literals outside primitives

Grok walks in, reads handbook §§ 3-5 (stack + tokens + primitives),
opens `/admin/design` gallery, and composes the next 10 marketing
surfaces in 1 session. That's the moat.

---

*Signed 2026-04-21 · Renato Zapata IV via autonomous delegation.
Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941.*
