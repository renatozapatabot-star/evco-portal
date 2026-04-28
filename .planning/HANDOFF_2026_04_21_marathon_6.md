# HANDOFF — Tuesday 2026-04-21 · MARATHON-6 · Demo Day Final Prep

Session owner: Renato Zapata IV via autonomous delegation.
Branch: `main`.
Mission: final push before showing EVCO Plastics. Lock demo-readiness
+ complete Grok Build prep.

> **Prior marathons:** M2 (funnel shipped), M3 (activity timeline + sales
> assets), M4 (conversion + Grok Handbook + ops polish), M5 (demo-ready
> audit + EVCO playbook). M6 closes the last marginal gaps — operator
> lightning-script, cheat sheet, expanded Grok patterns doc, additional
> outreach templates, WHY comments on load-bearing files.

---

## One-line verdict

**Demo-ready.** Three operator docs land for Tuesday's Ursula walk
(14-min playbook · 3-min script · 7-moments cheat sheet), Grok
Handbook now documents M4+M5 composition patterns + Ursula context,
5 more LinkedIn templates rotate with the original 5, and two
load-bearing files get explanatory headers so Grok understands the
HMAC-session decision on day one. Only remaining action: **PM2
restart on Throne before the demo** (documented since M5, unchanged).

---

## Commits shipped (3 commits · 8dd2b28..bc7a399)

| # | Commit | What |
|---|---|---|
| 1 | `d252e70` | Ursula 3-min script + 7-moments cheat sheet |
| 2 | `bc7a399` | Grok Handbook §18-19 patterns + Ursula context + 5 LinkedIn templates + WHY headers |
| 3 | (pending) | this handoff |

---

## Final state

| Gate | Status |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | **1179 tests passing** (unchanged; no test changes this marathon) |
| `bash scripts/gsd-verify.sh --ratchets-only` | 0 failures · 20 warnings (at-floor) |
| Pre-commit hook | green on every commit |

No new migrations, no new production code. This was a **docs +
reusable-knowledge marathon** — the system was already at 10/10
through M5.

---

## Demo-asset inventory (complete)

Operator can pick the right doc for the room:

| Doc | Length | When to use |
|---|---|---|
| `docs/EVCO_DEMO_PLAYBOOK.md` | 14 min · 379 lines | First live demo · full scripted walkthrough · pre-flight + recovery + tough-Q answers |
| `docs/URSULA_DEMO_SCRIPT_3MIN.md` | 3 min · concise | Second-round check-ins · stakeholder cold-joins · any time <5 min |
| `docs/URSULA_7_MOMENTS.md` | One-pager · cheat sheet | During the demo · glance mid-session to stay on rails |

All three cross-reference each other. Print the cheat sheet on a
letter page and laminate it.

---

## Grok Build Handbook — now complete

`docs/grok-build-handbook.md` (840+ lines post-M6):

- §1–17: stack, design system, primitives, invariants, templates,
  testing, ratchets, sales machine (M4 baseline)
- §18 NEW: Reusable Patterns — five compositions Grok should follow
  verbatim rather than reinvent:
  - 18.1 Three-state conditional component (LeadConvertCard)
  - 18.2 URL-driven filter with debounced search (LeadsFilterBar)
  - 18.3 Cross-entity activity feed (RecentActivityFeed)
  - 18.4 Error + Loading boundaries (CockpitSkeleton + CockpitErrorCard)
  - 18.5 Calm empty-state pattern
- §19 NEW: Ursula Context — who she is, what she touches, what
  she never sees, why calm-tone isn't aesthetic (it's the contract)
- §20 (renumbered): quick-reference links include the 3 demo docs

A new builder can read handbook §19 for 2 minutes and know who
every client surface is ultimately for.

---

## Sales outreach expanded

`scripts/cold-outreach/linkedin-posts.md` now has 10 templates:

| # | Angle | When |
|---|---|---|
| 1 | Launch post | One-time, T-0 |
| 2 | Before/after | High-engagement default |
| 3 | Specific-customer story | Case-in-point |
| 4 | Why we built it | Technical prospects |
| 5 | Capacity inflection | Urgency + scarcity |
| 6 | **SAT Audit Week** | Compliance pain point (NEW M6) |
| 7 | **Data Integrity Moment** | Engineering rigor for CFOs (NEW M6) |
| 8 | **EVCO Case Study Teaser** | Gated on Ursula's approval (NEW M6) |
| 9 | **"85 Años" Storytelling** | Quarterly heritage + modernity (NEW M6) |
| 10 | **AI-Native Not AI-Washed** | Technical decision-makers (NEW M6) |

Plus rotation calendar (Tue AM / Thu AM / quarterly / post-win) and
30-day-no-repeat rule.

---

## WHY comments added

Two load-bearing files got explanatory headers so Grok understands
the "why this is unusual" before touching them:

1. **`src/lib/session.ts`** — explains HMAC-over-Supabase-Auth choice,
   the `admin`/`internal` companyId non-matching trick (core-invariant
   #31), and the consequences for tenant-scoped code.

2. **`src/middleware.ts`** — documents the 6-step responsibility
   pipeline (CSRF → token-gated → public marketing → SEO → auth →
   admin-role-check) and a safe-addition checklist.

`src/lib/cockpit/safe-query.ts` already had excellent documentation
(v9.4 header from Block DD) — no change needed.

---

## What's intentionally NOT shipped

- **/inicio + /pitch surface polish.** Audited clean — surfaces were
  already 10/10 through M2-M5 (Block DD, M3 trust strip, M3
  prospect-eye pass). No marginal-improvement commits.
- **Additional primitives.** The 30+ primitives in `src/components/aguila/`
  cover every composition need. Grok should extend existing ones
  rather than add new unless a genuinely distinct pattern emerges.
- **Case-study live publication.** Template + worked-example exist
  (`scripts/cold-outreach/case-study-template.md`). HARD gate: Ursula's
  written approval in `.planning/case-studies/evco-approval.txt`.
  Pending her reaction to the demo.

---

## Reproducing the state

```bash
cd ~/evco-portal
git fetch --all
git checkout main
git log --oneline 8dd2b28..HEAD                     # 3 commits
npm install
npx tsc --noEmit                                    # 0 errors
npx vitest run                                      # 1179/1179
bash scripts/gsd-verify.sh --ratchets-only          # 0 failures
```

---

## The one action before demo day (unchanged from M5)

```bash
ssh throne
pm2 restart all && pm2 save
# wait 15 min
curl portal.renatozapata.com/api/health/data-integrity?tenant=evco
# expect verdict: "green"
```

If still red after PM2 restart, reschedule the demo. Stale data
behind a freshness banner is survivable but not ideal for first
impression with EVCO.

---

## Pending backlog (not blocking demo)

| # | Task | Blocker |
|---|---|---|
| Task 9 | Reduce scripts/ silent-catch baseline (153→?) | Pending fix/pdf merge |
| — | PM2 auto-restart resilience on Throne | Operator · outside repo |
| — | Anthropic credit top-up | Billing · required for CRUZ AI demo |
| — | Contract template for EVCO sign-off | Tito input |
| — | CRUZ AI smoke-test pre-demo | Add to playbook §0 pre-flight |
| — | `.planning/case-studies/` dir + EVCO approval workflow | Pending Ursula OK after demo |

---

## The complete demo-day checklist (one page)

Operator reads this the morning of the demo:

1. **60 min before:** `ssh throne && pm2 restart all && pm2 save`
2. **30 min before:** `curl portal.renatozapata.com/api/health/data-integrity?tenant=evco` → verify green
3. **15 min before:** open 3 browser tabs (login, pitch, integrity JSON)
4. **5 min before:** re-read `docs/URSULA_7_MOMENTS.md`
5. **During:** glance at `docs/URSULA_DEMO_SCRIPT_3MIN.md` or follow `docs/EVCO_DEMO_PLAYBOOK.md` depending on time available
6. **Within 1 hour after:** log `email_sent` activity in `/admin/leads/[lead-id]` with outcome summary
7. **Within 1 hour after:** one-line Telegram to Tito with outcome
8. **Same day:** if she asked for PDF → send `/api/pitch-pdf?firm=EVCO&name=Ursula&download=1`
9. **Same day:** move lead stage per her reaction (qualified / negotiating / won / lost)
10. **Same day:** update `.planning/HANDOFF_<date>.md` with what landed

---

## Success criteria

From `docs/URSULA_7_MOMENTS.md`:

> **"Yo quiero abrir esto a las 11 PM."**
>
> That's the sentence. If she says anything close — literally or in
> vibe — we won. If not, find the one missing thing and ship it
> next week.

That's the single metric for Tuesday. Every piece of code, every
doc, every primitive in this repo is calibrated toward that moment.

---

*Signed 2026-04-21 · Renato Zapata IV via autonomous delegation.
Patente 3596 · Aduana 240 · Laredo, Texas · Est. 1941.*
