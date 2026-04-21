# CRUZ Handler Wiring Sprint
**Prepared:** 7 April 2026
**Owner:** Renato Zapata IV
**Duration:** 4 weeks (calendar will likely run 6-8 weeks — that's fine)
**Goal:** Take the 7-workflow pipeline from "1 email processed end-to-end" to "100+ EVCO emails processed end-to-end with human approval only on exceptions"

## Why this exists

On 7 April 2026, a fleet audit revealed that CRUZ has a fully-architected event-driven workflow system that's been mostly invisible. It includes:

- A 7-workflow chain (`intake → classify → docs → pedimento → crossing → post_op → invoice`)
- 9 chain rules wired in `workflow_chains` Supabase table
- A polling event processor (`workflow-processor.js`) running 24/7 in PM2
- 5,464 events historically logged in `workflow_events`
- 25 handler slots defined in `workflow-processor.js`, **most of them stubs that return `{ success: true }` without doing real work**
- Tenant isolation enforced at the emit layer
- Decision logging via the Operational Brain

The architecture is built. The handlers are hollow. **Wiring them is the highest-leverage work on the platform** because it transforms CRUZ from "components that need manual orchestration" into "an autonomous pipeline with human approval gates."

This is not Block 3, Block 4, Block 5 or any of the original 10 blocks. This sprint replaces them.

## Current status (updated 10 April 2026)

**All 25 handler slots now have real implementations. Zero stubs remain.**

Wired on 10 April 2026:
- intake: email_processed, document_attached (acknowledge + chain)
- docs: document_received (records doc, chains to completeness), completeness_check (validates 6 required docs), solicitation_needed (creates solicitudes + Telegram alert), solicitation_sent (audit trail)
- pedimento: expediente_complete (verifies draft, triggers duties/approval), duties_calculated (checks draft, emits ready_for_approval), approved (updates draft status, chains to crossing)
- crossing: pedimento_paid (queries bridge times, recommends crossing), crossing_complete (updates traficos to Cruzado)
- post_op: crossing_complete (calculates operation score 0-100)
- invoice: operation_accumulated (logs to Operational Brain, end of chain)

Also fixed: `predictive-classifier.js` — `tc` undefined bug and regime-based T-MEC removal.

**Next step:** End-to-end testing with real EVCO data.

## The premise

When this sprint completes, the following sentence is true:

> An EVCO supplier emails ai@renatozapata.com with an invoice. CRUZ classifies the products, checks documents, requests anything missing in Spanish from Ursula, calculates duties, prepares a draft pedimento, drops it in front of Tito to approve. Tito approves. The pedimento gets filed. Crossing gets scheduled. Post-op scoring runs. The accumulated cost flows to invoicing. **Tito's only intervention was tapping approve.**

Today: 1 email has flowed through this pipeline.
Sprint goal: 100+ emails per week, with EVCO as the pilot.

## Pre-conditions (must be true before starting)

These have to be green or this sprint stalls:

- [x] All 25 handler slots wired (completed 10 April 2026)
- [x] `predictive-classifier.js` bugs fixed (completed 10 April 2026)
- [ ] Block 1 (observability foundation) shipped — `job_runs` table, `/health` page, watchdog firing on stale jobs
- [ ] `auto-classifier.js` Fix 2 (polymer discrimination) and Fix 3 (description-vs-history consistency) shipped, accuracy verified at ≥85% on a 50-row EVCO eyeball test
- [ ] EVCO 631-row classification backfill complete, Tito has reviewed at least 50 classifications and signed off
- [ ] The 3 stopped PM2 crons (`cruz-crossing`, `cruz-closeout`, `cruz-touch-monitor`) restarted and producing health rows

## The map

Verified handler inventory (from workflow-processor.js read on 10 April 2026):

| Workflow | Event Handler | Status | Implementation |
|---|---|---|---|
| `intake` | `email_processed` | WIRED | Acknowledge + chain |
| `intake` | `document_attached` | WIRED | Acknowledge + chain |
| `classify` | `product_needs_classification` | REAL (pre-existing) | Spawns auto-classifier.js per product |
| `classify` | `classification_complete` | REAL (pre-existing) | Calculates duties, upserts pedimento_drafts |
| `classify` | `needs_human_review` | REAL (pre-existing) | Queues in notification-batcher |
| `docs` | `document_received` | WIRED | Records doc in expediente_documentos, chains to completeness |
| `docs` | `completeness_check` | WIRED | Validates 6 required docs, emits complete or solicitation |
| `docs` | `expediente_complete` | REAL (pre-existing) | Validates completeness via document-types lib |
| `docs` | `solicitation_needed` | WIRED | Creates documento_solicitudes, Telegram alert |
| `docs` | `solicitation_sent` | WIRED | Audit trail logging |
| `pedimento` | `expediente_complete` | WIRED | Checks draft, triggers duties or approval |
| `pedimento` | `duties_calculated` | WIRED | Verifies draft completeness, emits ready_for_approval |
| `pedimento` | `ready_for_approval` | REAL (pre-existing) | Sends Telegram with score |
| `pedimento` | `approved` | WIRED | Updates draft status, Telegram confirmation |
| `crossing` | `pedimento_paid` | WIRED | Queries bridge times, recommends crossing |
| `crossing` | `dispatch_ready` | REAL (pre-existing) | Sends Telegram with carrier + bridge |
| `crossing` | `crossing_complete` | WIRED | Updates traficos to Cruzado, Telegram alert |
| `post_op` | `crossing_complete` | WIRED | Calculates operation score (0-100) |
| `post_op` | `operation_scored` | REAL (pre-existing) | Extracts score |
| `invoice` | `operation_accumulated` | WIRED | Logs to Operational Brain, end of chain |
| `invoice` | `invoice_ready` | REAL (pre-existing) | Sends Telegram approval request |

## Sprint plan — remaining work

### Phase 1: End-to-end testing (Week 1 remaining work)

**Day 1 — Manual event test**
- Insert a row into `workflow_events` with `workflow='intake'`, `event_type='email_processed'`, payload containing real EVCO product data
- Watch `workflow-processor.js` pick it up within 30 seconds
- Verify the chain fires through all 7 workflows
- Check each handler fires, logs decisions, and chains correctly

**Day 2 — Live email test**
- Send an email to ai@renatozapata.com with a real EVCO invoice
- Verify email-intake.js emits `intake.email_processed`
- Watch classification trigger, docs check, duties calculation
- Verify Tito receives Telegram approval prompt

**Day 3 — Eyeball results**
- Did every handler fire?
- Did operational_decisions get new rows?
- What was the total time from email to approval prompt?
- What was the AI cost?
- Output: one-page report for Tito

### Phase 2: Tito demo + sign-off

- Show Tito the chain working on a real trafico
- Get his "está bien" or his list of changes
- Adjust approval surface based on feedback

### Phase 3: Volume test

- Process 10 EVCO emails in a single day
- Monitor for: silent failures, chain stalls, duplicate events, cost overruns
- Verify `/health` page shows green for all handlers

## Sprint exit criteria

- [x] All 25 handler slots have real implementations
- [x] `predictive-classifier.js` bugs fixed
- [ ] Sending an email to ai@renatozapata.com triggers automatic classification of all line items
- [ ] Missing documents trigger automatic Spanish-language solicitations within 5 minutes
- [ ] Complete expedientes trigger automatic duties calculation
- [ ] Tito receives a Telegram approval prompt with totals, risks, and approve/reject/modify buttons
- [ ] Approval triggers transport assignment and crossing window recommendation
- [ ] Crossing completion triggers operation scoring and invoice accumulation
- [ ] At least 1 real EVCO trafico has completed the full chain
- [ ] `/health` page shows green for all 25 handlers
- [ ] Total time from email arrival to Tito's approval prompt is under 10 minutes
- [ ] Total AI cost per shipment is logged and under $0.10

## What this sprint does NOT do

- Does not classify the 655K backlog (separate decision, separate budget)
- Does not address the 158 ghost scripts (tomorrow problem)
- Does not address the 315K null-description products (Block 0, separate sprint)
- Does not refactor the workflow-emitter or decision-logger (they work)
- Does not build a new Operational Brain UI (just keeps logging)
- Does not onboard MAFESA (EVCO is the pilot — MAFESA is post-sprint)
- Does not touch the 10 archived scripts (they're archived for a reason)
- Does not migrate the 6 crontab production scripts to PM2 (they work, leave them)
- Does not build new portal screens (the portal is at 9.5/10, leave it)

## Risk register

**Risk 1: Handler logic hides edge cases.** Wiring is done but real-world data may trigger paths not covered by the handler logic. Mitigation: the end-to-end test with real EVCO data will surface these.

**Risk 2: Tito doesn't trust the chain.** If he says "I want to look at every line item myself," the autonomy gain disappears. Mitigation: demo with real money on the line. Adjust the approval surface based on what he wants to see.

**Risk 3: Ursula gets annoyed by automated solicitations.** Mitigation: get Ursula's actual feedback on tone and clarity before scaling.

**Risk 4: A handler silently fails and the chain stalls.** Block 1's observability foundation is the mitigation. Without `/health` and the watchdog, a stuck chain looks identical to no traffic.

**Risk 5: Chain events don't propagate correctly.** The `chainNext()` function relies on `workflow_chains` table having the right rows. Verify all 9 chain rules are present and enabled.

## After the sprint

When the exit criteria are met:

1. **Tito demo + sign-off.** The "está bien" moment.
2. **Update CRUZ_CONTEXT.md.** New status: pipeline 10/10.
3. **Run the same chain for MAFESA.** Should take 1-2 days, not 4 weeks.
4. **Decision: full classification backfill.** Now that the chain works, the $1,020 backfill makes sense.
5. **Tomorrow's roadmap.** How do we onboard a third client? How do we open the chain to MCP consumers?

## Why this changes everything

CRUZ is a 9/10 set of components held together by what was 2/10 wiring. The handler wiring sprint is the highest-leverage move on the platform. When the end-to-end test passes, CRUZ becomes the autonomous customs pipeline the morning handoff envisioned.

**Patente 3596 honrada. Aduana 240. Est. 1941.**
