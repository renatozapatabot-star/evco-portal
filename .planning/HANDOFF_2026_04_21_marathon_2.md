# HANDOFF — Tuesday 2026-04-21 · MARATHON-2 · Client Acquisition & Demo Engine

Session owner: Renato Zapata IV via autonomous delegation.
Branch: `main`.
Mission: build the Client Acquisition & Demo Engine so we can start
closing deals immediately while preparing for Grok Build.

> **Complementary doc:** `.planning/SALES_PLAYBOOK.md` — single
> source of truth for operational sales workflows. Read it first.
> This handoff is the shipping log; the playbook is the runbook.

---

## One-line summary

The full prospect → lead → pipeline funnel is live, tested, and
wired: prospect sees `/pitch`, fills the inline form, lands in
`/admin/leads`, gets worked through stage transitions with autosave
edits, closes or gets filed in nurture.

---

## Commits shipped this block (~25 authored)

### Sales primitives + /demo polish

| # | Commit | What |
|---|---|---|
| 1 | `1ad27e8` | /demo polish + 3 primitives (AguilaMetric, AguilaBeforeAfter, AguilaTestimonial) |
| 2 | `90dff4b` | /pitch landing + 24 primitive tests |
| 3 | `094c969` | AguilaCTA primitive + design-gallery sales section |
| 4 | `8257609` | PitchLeadForm inline capture + honeypot + CSRF exemption |
| 5 | `b572d48` | /pitch OpenGraph 1200×630 social image |

### Leads CRM

| # | Commit | What |
|---|---|---|
| 6 | `e6d45b5` | leads table migration + /admin/leads + POST /api/leads |
| 7 | `18e8eac` | /demo/live → attribution log to leads table |
| 8 | `64c9dfa` | /admin/leads/[id] detail + PATCH/GET /api/leads/[id] |
| 9 | `b1f61b5` | NewLeadForm manual capture in /admin/leads |
| 10 | `6ac81b2` | "Ventas" admin nav group + loading + error routes |

### Tests

| # | Commit | What |
|---|---|---|
| 11 | `28083f3` | /api/leads POST tests (12) + post-demo email sequence |
| 12 | `94abf60` | PitchLeadForm + NewLeadForm tests (15) |
| 13 | `ab39754` | LeadDetailClient autosave + stage-pill tests (9) |
| 14 | `e0cd2ee` | Migration-contract test (13) |

### Docs + SEO + PDF

| # | Commit | What |
|---|---|---|
| 15 | `7e15757` | SALES_PLAYBOOK v1 |
| 16 | `8b918ce` | SALES_PLAYBOOK v2 (post-demo cadence + test index + OG) |
| 17 | `6f1b59d` | SALES_PLAYBOOK v3 (/admin/leads/[id] + NewLeadForm) |
| 18 | `09a6326` | /api/pitch-pdf GET + download CTA |
| 19 | `08700e8` | sitemap.ts + robots.ts |

---

## Final state

| Gate | Status |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **1087 tests passing** (was 980 at marathon-1 close) |
| `bash scripts/gsd-verify.sh --ratchets-only` | 0 failures · 20 warnings (all at-floor) |
| Pre-commit hook | green on every commit |

## New test coverage at the sales layer — 107 assertions

| File | Tests |
|---|---|
| `src/lib/leads/__tests__/types.test.ts` | 6 |
| `src/lib/leads/__tests__/migration.test.ts` | 13 |
| `src/app/api/leads/__tests__/route.test.ts` | 12 |
| `src/app/api/leads/[id]/__tests__/route.test.ts` | 18 |
| `src/components/aguila/__tests__/AguilaMetric.test.tsx` | 11 |
| `src/components/aguila/__tests__/AguilaBeforeAfter.test.tsx` | 6 |
| `src/components/aguila/__tests__/AguilaTestimonial.test.tsx` | 7 |
| `src/components/aguila/__tests__/AguilaCTA.test.tsx` | 10 |
| `src/app/pitch/__tests__/PitchLeadForm.test.tsx` | 6 |
| `src/app/admin/leads/__tests__/NewLeadForm.test.tsx` | 9 |
| `src/app/admin/leads/[id]/__tests__/LeadDetailClient.test.tsx` | 9 |

## New primitives (reusable across every future prospect surface)

- `AguilaMetric` — label + big value + tone/unit/icon/sub/href
- `AguilaBeforeAfter` — manual-vs-PORTAL delta strip
- `AguilaTestimonial` — quote + attribution + avatar
- `AguilaCTA` — paired primary + secondary action stack
- All 4 live in `/admin/design` gallery with tone variants

## New routes

**Public (unauthenticated):**
- `/pitch` — case-study landing page w/ inline lead form
- `/pitch/opengraph-image` — 1200×630 PNG for LinkedIn/Slack unfurls
- `/api/pitch-pdf` — on-demand React-PDF render
- `/sitemap.xml` + `/robots.txt` — SEO discovery
- `POST /api/leads` — public lead capture (CSRF-exempt, honeypotted)

**Admin (admin/broker only):**
- `/admin/leads` — pipeline dashboard
- `/admin/leads/[id]` — single-lead detail w/ autosave + stage pills
- `GET /api/leads/[id]` — fetch
- `PATCH /api/leads/[id]` — whitelist update
- Admin nav: new "Ventas" group, icon Target, child: "Pipeline de leads"

## New database objects

`supabase/migrations/20260421150251_leads_table.sql`:

- `leads` table (20 columns, UUID PK, audit timestamps, trigger)
- 5 indexes (stage, source, next_action_at, owner, created_at DESC)
- `leads_touch_updated_at()` trigger function (bumps stage_changed_at
  on stage change only)
- RLS `ENABLE` + `FOR ALL USING (false)` (service-role bypass)

**Pending manual step:** `npx supabase db push` to apply in prod.

## Cold-outreach assets (updated)

Already-shipped campaign infra in `scripts/cold-outreach/` — this
block added:

- `post-demo-sequence.md` — 3-email cadence for `stage='demo-viewed'`
  leads (T+0 thank-you, T+3 pricing, T+7 soft nudge w/ case study)

## Security posture

| Surface | Auth | CSRF | RLS |
|---|---|---|---|
| `/pitch`, `/demo` | public | N/A (GET) | N/A |
| `POST /api/leads` | public | **exempt** (honeypotted) | deny-all + service role |
| `GET /api/pitch-pdf` | public | N/A (GET) | N/A |
| `/admin/leads` | admin/broker redirect | cookie-based | deny-all + service role |
| `GET /api/leads/[id]` | admin/broker 401 | N/A | service role |
| `PATCH /api/leads/[id]` | admin/broker 401 | cookie double-submit | service role |

## Funnel attribution

Every hit to `/demo/live` writes an anon row to `leads`:
- `firm_name = 'Demo visitor (anónimo)'`
- `source = 'demo'`
- `source_url = referrer` (origin+pathname, query stripped)
- `stage = 'demo-viewed'`
- dedup: 1h window per referrer

When the same prospect later fills the `/pitch` form, a named lead
row is inserted separately. Both rows coexist, telling the full
story: anon visit T-n days ago → named conversion today.

## What's intentionally NOT shipped

- **Email open/click tracking.** No pixels, no link rewriting. First
  5 close cycles are qualitative — Renato IV reads every reply.
- **CRM automation (auto-emails, auto-stage-moves).** Every stage
  transition is a human decision. Automate only after 5 close
  cycles prove the rules.
- **Per-user ownership on leads.** owner_user_id column exists but
  the UI doesn't write/enforce it yet. Shared pipeline for now
  (2-person team). Ship assignment when team > 2.
- **Captcha.** Honeypot is the only bot defense. Upgrade if we see
  > 10 spam rows/day.
- **Public lead status check.** A prospect cannot query their own
  lead status — by design. The conversation happens in Mensajería
  or email, not via a public API.

## Reproducing the state

```bash
cd ~/evco-portal
git fetch --all
git checkout main
git log --oneline --grep="Co-Authored-By: Claude Opus 4.7" 3fe2cda..HEAD | wc -l   # ≈ 25
npm install
npx tsc --noEmit                                                                    # 0 errors
npx vitest run                                                                      # 1087/1087
bash scripts/gsd-verify.sh --ratchets-only                                          # 0 failures
```

## Remaining backlog

| # | Task | Blocker |
|---|---|---|
| Task 9 | Reduce scripts/ silent-catch baseline | Pending fix/pdf merge from parallel session |
| — | Lead ownership / round-robin | Not needed until team > 2 |
| — | Lead activity timeline (touches, calls, emails) | Low-ROI for manual workflow; revisit after 20+ leads |
| — | Calendar link / booking widget | Pending Cal.com or Calendly choice from Tito |
| — | Lead import from CSV (Apollo export → DB) | After first campaign cycle |

---

## Ready for Grok Build

Every primitive shipped this block is:
- Token-routed (no inline hex, design-token comments where unavoidable)
- Calm-tone safe (no compliance anxiety on client-facing surfaces)
- Tested (107 sales-layer assertions)
- Documented in SALES_PLAYBOOK.md
- Visually previewed in `/admin/design`

Grok Build can walk in, open `/admin/design`, see every primitive in
its tone variants, and start composing marketing surfaces without
re-deriving the design system. The sales-asset primitives compose
cleanly with the existing cockpit primitives (GlassCard, PageShell,
DetailPageShell, AguilaInput, AguilaSelect, AguilaTextarea,
AguilaDataTable) — the entire system is one kit.

---

*Signed 2026-04-21 · Renato Zapata IV via autonomous delegation.
Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941.*
