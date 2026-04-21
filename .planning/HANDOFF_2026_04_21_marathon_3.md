# HANDOFF — Tuesday 2026-04-21 · MARATHON-3 · High-ROI Sales Engine

Session owner: Renato Zapata IV via autonomous delegation.
Branch: `main`.
Mission: fill the remaining gaps in the Client Acquisition & Demo
Engine so we can start closing deals this week.

> **Prior marathons:** `HANDOFF_2026_04_21_marathon_2.md` shipped the
> full prospect → lead → pipeline funnel. Marathon-3 closed the
> last three gaps:
> 1. Activity timeline on leads (wasn't shipped in M2)
> 2. Sales assets beyond email (LinkedIn posts, demo script, case study)
> 3. PDF polish + `/pitch` prospect-eye pass

---

## One-line summary

Every PATCH to a lead now auto-logs an activity; every call/email/
meeting can be logged manually; `/pitch` + the 1-pager PDF were
polished for prospect-eye consistency; 5 new sales assets are
ready to ship with the campaign.

---

## Commits shipped this block (6 commits · c8cf469..7f9b266)

| # | Commit | What |
|---|---|---|
| 1 | `a9c652a` | lead_activities migration applied to prod + auto-logger on PATCH + POST /activities endpoint |
| 2 | `7def9cc` | LeadActivityTimeline UI + inline "Registrar actividad" form in /admin/leads/[id] |
| 3 | `f8916c0` | 52 test assertions (12 unit + 12 migration + 16 API + 5 auto-log + 7 UI) |
| 4 | `58223da` | LinkedIn posts + demo script + case-study template in scripts/cold-outreach/ |
| 5 | `a235958` | Pitch PDF polish + 3 render smoke tests |
| 6 | `7f9b266` | /pitch prospect-eye pass — hero copy + trust strip + SKU label softening |

Plus `663d56f` earlier in session: applied the leads table migration
from M2 to prod via `supabase db push`.

---

## Final state

| Gate | Status |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **1142 tests passing** (was 1087 at marathon-2 close · +55 net new) |
| `bash scripts/gsd-verify.sh --ratchets-only` | 0 failures · 20 warnings (all at-floor) |
| Pre-commit hook | green on every commit |
| Supabase `schema_migrations` | clean — remote + local in sync |

## New test coverage — 55 assertions

| File | Tests |
|---|---|
| `src/lib/leads/__tests__/activities.test.ts` | 12 |
| `src/lib/leads/__tests__/activities-migration.test.ts` | 12 |
| `src/app/api/leads/[id]/activities/__tests__/route.test.ts` | 16 |
| `src/app/api/leads/[id]/__tests__/autolog.test.ts` | 5 |
| `src/app/admin/leads/[id]/__tests__/LeadActivityTimeline.test.tsx` | 7 |
| `src/app/api/pitch-pdf/__tests__/render.test.tsx` | 3 |

## New database objects

`supabase/migrations/20260421160000_lead_activities_table.sql`
**applied to prod** via `npx supabase db push`:

- `lead_activities` table (id, lead_id, kind, summary, metadata,
  actor_user_id, actor_name, occurred_at, created_at)
- 3 indexes (lead_id+occurred_at DESC · kind · partial actor)
- `ON DELETE CASCADE` on `lead_id` — purging a lead takes its
  timeline with it
- RLS `ENABLE` + `FOR ALL USING (false)` (service-role bypass)
- No trigger — activities are append-only by app convention,
  not enforced at DB level (backfill edge cases would need a
  backdoor)

## How the auto-logger works

`src/lib/leads/activities.ts` exports `diffToActivities(leadId,
before, after, actor)` — computes one row per meaningful change:

- Whitespace-tolerant (`  Juan  ` = `Juan`)
- Null ↔ empty-string treated as unchanged
- Humanized Spanish summaries: `"Etapa: Nuevo → Contactado"`,
  `"Valor mensual estimado: $15,000 MXN → $25,000 MXN"`
- Metadata sidecar preserves raw before/after for audit queries
- MXN formatted manually (not Intl.NumberFormat) so summaries
  stay stable across Node (small ICU) + browser (full ICU)

The PATCH endpoint fires `writeActivities()` best-effort after a
successful update. A timeline write failure NEVER interrupts the
edit flow.

## Manual activity entry

`POST /api/leads/[id]/activities` with body `{ kind, summary,
occurred_at? }`:

- Kind whitelist: `note`, `call`, `email_sent`, `email_received`,
  `meeting`, `demo_sent`
- Summary required (max 1000 chars, trimmed, non-empty)
- `occurred_at` optional (ISO string, can backdate)
- CSRF-protected via middleware (broker/admin sessions carry the
  token automatically)
- Touchpoint kinds (`call`, `email_*`, `meeting`, `demo_sent`)
  opportunistically bump `leads.last_contact_at` so the main
  /admin/leads list stays honest without an explicit edit

## New sales assets (scripts/cold-outreach/)

- `linkedin-posts.md` — 5 founder-voice public post templates:
  launch post, before/after, specific-customer moment,
  why-we-built-it, capacity-constrained inflection. Separate from
  `linkedin-dms.md` (1:1 DMs). Includes cadence, reply strategy,
  tracking sheet spec.

- `demo-script.md` — 3-min Loom walkthrough with timing cues and
  scene directions (which tab, when to hover, when to pause).
  CFO / plant-director / engineering-lead variants. Post-record
  checklist tied to `/admin/leads` activity logging.

- `case-study-template.md` — reusable one-page format + a fully-
  worked EVCO instance (pending Ursula's written approval).
  HARD approval-gate flow. Anti-patterns table.

## Pitch PDF polish

`scripts/cold-outreach/pitch-pdf.tsx`:
- Hero rewritten to match `/pitch` LP: "Despacho aduanal / 10×
  más rápido." + bilingual EN sub
- New delta strip (22 min → 2 min · 2 cells, 26px mono numbers)
  as the primary proof on-page
- Proof row rebalanced: 148,537 SKUs · 98% liberación · 85 años
  (dropped the 3.8s demo-latency metric — prospects didn't
  believe it)
- Ursula Banda testimonial block — quote + attribution
- CTA leads with **`portal.renatozapata.com/demo/live`** as a bold,
  prominent URL (13px Courier-Bold) — not buried in the channels
  grid
- Recipient first-name personalization in the kicker

Render smoke tests (3) verify `%PDF-` magic + minimum byte size
across base, name-less, and all-channels-populated cases.

## `/pitch` prospect-eye pass

Fresh-eyes audit as a CFO of a 500-person manufacturer:
- Reframed "Construido por dos personas con patente 3596" →
  "Sin call centers. Sin intermediarios. Patente 3596 honrada en
  cada pedimento, con IA que hace lo tedioso y dos brokers que
  firman lo importante." (positioning advantage, not a caveat)
- SKUs metric sub was "EVCO Plastics catálogo" — softened to
  "Catálogo vivo · auditable" so the single-client signal
  doesn't leak above the fold
- Added a concrete trust strip above the fold:
  `Onboarding · 48 h  ·  Respuesta < 4 h hábiles  ·  Patente
  propia · 85 años` — specific operational commitments a CFO
  can cite in a board meeting

---

## Security posture (unchanged from M2)

All security invariants from M2 hold. New surfaces added by M3:

| Surface | Auth | CSRF | RLS |
|---|---|---|---|
| `GET /api/leads/[id]/activities` | admin/broker 401 | N/A (GET) | service role |
| `POST /api/leads/[id]/activities` | admin/broker 401 | cookie double-submit | service role |
| `lead_activities` table | — | — | deny-all + service role |

---

## What's intentionally NOT shipped

- **Activity edits/deletes.** By design — the timeline is audit,
  not a scratchpad. Fix a wrong summary by adding a correcting
  note with the right info.
- **Pagination on /activities GET.** Limited to 200 rows; revisit
  if a single lead ever exceeds that (very far off).
- **Activity filtering/search in the UI.** Rendering grouped-by-
  day is enough for the first 20 leads. Add filters when a lead
  has > 50 events.
- **Per-user actor tracking.** HMAC session doesn't carry a user
  id; `actor_name` is the role string (`admin` / `broker`).
  Promote when team > 2.
- **Webhooks to Mensajería / Slack on stage changes.** Human-in-
  the-loop remains absolute until Tito explicitly says "automate
  this one."
- **PDF pricing anchor.** Pricing is commercially sensitive and
  requires Tito's input.

---

## Reproducing the state

```bash
cd ~/evco-portal
git fetch --all
git checkout main
git log --oneline c8cf469..HEAD | wc -l                                   # 6
npm install
npx tsc --noEmit                                                          # 0 errors
npx vitest run                                                            # 1142/1142
bash scripts/gsd-verify.sh --ratchets-only                                # 0 failures
```

---

## Remaining backlog

| # | Task | Blocker |
|---|---|---|
| Task 9 | Reduce scripts/ silent-catch baseline (153→?) | Pending fix/pdf merge from parallel session |
| — | Per-user actor tracking on activities | Not needed until team > 2 |
| — | Activity edit/undo window | Not needed until first real misclick |
| — | Mensajería integration (stage change → notify Anabel / Tito) | Policy: automate only after 5 close cycles |
| — | Lead-to-client promotion flow | Needed before 1st conversion — estimate ~1hr |
| — | Tito approval of EVCO case study | Ursula + Tito sign-off required |
| — | Cal.com booking widget on /pitch | Pending Cal.com vs Calendly choice |

---

## Ready to close a deal

Every piece of the sales machine is now in place:

- Prospect visits `/pitch` → sees tight hero + trust strip + testimonial
- Fills inline form → lands in `/admin/leads` with `source=demo`
- You log the call + demo-send + pricing as activities → full
  auditable history in 1 screen
- Stage moves get auto-logged — accountable without overhead
- 5 sales assets (PDF, emails, LinkedIn DMs, LinkedIn posts,
  demo script, case study template) cover every outreach channel

Next move: run the Tuesday 2026-04-21 campaign, book 3 demos
this week, log every touch as an activity, move stages as deals
progress.

---

*Signed 2026-04-21 · Renato Zapata IV via autonomous delegation.
Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941.*
