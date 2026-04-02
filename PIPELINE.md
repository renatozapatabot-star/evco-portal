# CRUZ PIPELINE — The Full Clearance Lifecycle
## Single Source of Truth — Updated: 2026-04-02
## Renato Zapata & Company · Patente 3596 · Aduana 240

---

> "The first automated clearance software on the border."
> Every step below must work end-to-end before that claim is real.

---

## THE 12 STEPS

```
INTAKE → CLASSIFY → COMPLETENESS → SOLICIT → DRAFT → REVIEW →
TRANSMIT → CROSSING → CLEARANCE → INVOICE → PAYMENT → ARCHIVE
```

---

## STEP 1: INTAKE
**Status: ✅ WORKING**
**Owner: THE LOOM (email-intake) + THE FORGE (portal upload UI)**

Ursula sends documents via email or uploads through portal.

| Component | Status | Details |
|-----------|--------|---------|
| email-intake.js | ✅ online | pm2 ID 18, */15 min, downloads PDFs |
| Gmail OAuth (ai@) | ✅ working | GMAIL_REFRESH_TOKEN_AI confirmed |
| Gmail OAuth (Eloisa) | ✅ working | GMAIL_REFRESH_TOKEN_ELOISA confirmed |
| Gmail OAuth (Claudia) | ✅ working | GMAIL_REFRESH_TOKEN_CLAUDIA confirmed |
| Portal /upload/[token] | ✅ working | Magic link upload page |
| /api/upload route | ✅ working | Handles file storage |

**What's missing:** Nothing critical. Shadow mode for Eloisa/Claudia inboxes pending.

---

## STEP 2: CLASSIFY
**Status: ✅ WORKING**
**Owner: THE FURNACE (Ollama classification)**

CRUZ identifies each document: factura, packing list, BL, COVE, certificate of origin, etc.

| Component | Status | Details |
|-----------|--------|---------|
| doc-classifier | ✅ working | Ollama qwen3:8b, think:false |
| document_classifications table | ✅ live | 1,388 records, growing |
| Confidence thresholds | ✅ set | >0.85 auto, 0.60-0.85 flag, <0.60 OTRO |
| OTRO rate | 🟡 monitor | Target: <20%. Check weekly. |

**What's missing:** Confidence calibration against Tito's corrections. Accuracy dashboard not built yet.

---

## STEP 3: COMPLETENESS
**Status: ✅ WORKING**
**Owner: THE LOOM (completeness-checker)**

CRUZ checks: do we have all 15 required document types for this shipment?

| Component | Status | Details |
|-----------|--------|---------|
| completeness-checker.js | ✅ online | pm2 ID 17, runs 6 AM daily |
| 15-doc checklist logic | ✅ built | Per import type (standard, USMCA, IMMEX) |
| Expediente Digital page | ✅ working | Shows completion % per tráfico |

**What's missing:** Conditional rules per import regime (some types need fewer docs).

---

## STEP 4: SOLICIT
**Status: 🟡 PARTIAL**
**Owner: THE LOOM (solicitud-escalation) + THE FORGE (request UI)**

When documents are missing, CRUZ auto-requests them from the client.

| Component | Status | Details |
|-----------|--------|---------|
| solicitud-escalation.js | 🟡 exists | pm2 ID 5, */30 min, 3 restarts |
| Email template | ❌ needs work | Template exists but not polished |
| Portal solicitation UI | 🟡 basic | Shows missing docs, no one-tap request |
| 4-hour escalation to Telegram | ❌ not built | No response → alert Tito/Renato |
| Magic link for upload | ✅ working | /upload/[token] exists |

**Next action:** Polish email template. Wire 4-hour escalation. Add one-tap "solicitar" button on portal.

---

## STEP 5: DRAFT
**Status: 🟡 PARTIAL — BLOCKED ON CREDITS**
**Owner: THE FURNACE (pedimento-drafter + confidence score)**

CRUZ drafts the pedimento using AI, assigns a confidence score.

| Component | Status | Details |
|-----------|--------|---------|
| pedimento-drafter logic | ✅ built | Uses Anthropic Sonnet |
| pedimento_drafts table | ✅ exists | Schema ready |
| Anthropic SDK | ✅ installed | @anthropic-ai/sdk |
| Anthropic API credits | ❌ $0 balance | BLOCKED — Friday $200 |
| Confidence score algorithm | 🟡 designed | Doc confidence 30%, value match 25%, fracción 25%, gates 20% |
| 9 verification gates | 🟡 designed | Not all implemented yet |

**Next action:** Add Anthropic credits Friday. Test live draft. Build verification gates.

---

## STEP 6: REVIEW
**Status: 🟡 PARTIAL**
**Owner: THE FORGE (review UI) + THE NEXUS (Telegram approval)**

Tito reviews the draft, corrects if needed, approves via Telegram.

| Component | Status | Details |
|-----------|--------|---------|
| Telegram /aprobar command | ✅ built | Webhook at /api/telegram-webhook |
| TELEGRAM_AUTHORIZED_USERS | ✅ set | 7277519813, 8538502098 |
| 5-second cancellation window | ✅ built | Observable and interruptible |
| Portal review UI | 🟡 basic | Needs inline correction interface |
| Correction logging | ❌ not built | THE critical Karpathy gap |
| corrections table | ❌ not created | Needs: field, original, corrected, reasoning |

**Next action:** Create corrections table. Build inline correction UI. Every Tito correction must be logged automatically — this is the Karpathy fuel.

---

## STEP 7: TRANSMIT
**Status: ❌ NOT BUILT**
**Owner: THE NEXUS (VUCEM integration)**

CRUZ sends the approved pedimento to SAT via VUCEM.

| Component | Status | Details |
|-----------|--------|---------|
| VUCEM SOAP client | ❌ not built | Need sandbox credentials from SAT |
| e.firma handling | ❌ not built | Each client needs their own certificate |
| Transmission log table | ❌ not created | Every attempt must be logged |
| Shadow mode comparison | ❌ not built | Compare CRUZ draft vs Tito's manual for 30 days |
| Retry logic (exponential backoff) | ❌ not built | SAT APIs are unreliable |
| Acuse retrieval | ❌ not built | Async — poll for MNVA number |

**Paths:** Direct SOAP (free, 4-8 weeks) vs API wrapper like Quiana.app (paid, 1-2 weeks)

**Next action:** Get VUCEM sandbox credentials. Start with shadow mode — draft but don't transmit. Compare against Tito's manual transmissions for 30 days.

---

## STEP 8: CROSSING
**Status: ❌ NOT BUILT**
**Owner: THE NEXUS (Aduanet tracking)**

Shipment crosses the bridge. Semáforo assigned (verde/rojo).

| Component | Status | Details |
|-----------|--------|---------|
| Aduanet status polling | ❌ not built | Need Aduanet API access |
| Semáforo tracking | ❌ not built | Verde = pass, Rojo = physical inspection |
| Bridge/lane assignment | ❌ not built | Step 9 in the tráfico timeline |
| crossing-predictor.js | ✅ exists | pm2 ID 20, predictions in crossing_windows |
| CBP bridge wait times | 🟡 broken | CBP API returning null (their end) |

**Next action:** Wire Aduanet credentials (ADUANET_URL, ADUANET_USER, ADUANET_PASSWORD already in .env.local). Build status poller.

---

## STEP 9: CLEARANCE
**Status: ❌ NOT BUILT**
**Owner: THE NEXUS (despacho confirmation)**

Customs clearance confirmed. Shipment is released.

| Component | Status | Details |
|-----------|--------|---------|
| Despacho confirmation logic | ❌ not built | Trigger when Aduanet shows cleared |
| Client notification | ❌ not built | Telegram + portal notification |
| Clearance timestamp logging | ❌ not built | For crossing time analytics |

**Next action:** Depends on Step 8 (Aduanet integration). Build together.

---

## STEP 10: INVOICE
**Status: ❌ NOT BUILT**
**Owner: THE VAULT (invoice generation) + THE NEXUS (e-conta sync)**

Client invoiced for brokerage fees, duties, taxes.

| Component | Status | Details |
|-----------|--------|---------|
| Invoice generation | ❌ not built | Need invoice template + fee calculation |
| e-conta sync | ❌ not built | eConta MySQL at 216.251.68.5:33035 |
| Fee calculation from system_config | 🟡 partial | DTA rates in system_config, but invoice logic not built |
| PDF invoice generation | ❌ not built | Professional CRUZ-branded invoice |

**Next action:** Define fee structure with Tito. Build invoice template. Wire e-conta sync.

---

## STEP 11: PAYMENT
**Status: ❌ NOT BUILT**
**Owner: THE NEXUS (QuickBooks/bank reconciliation)**

Payment tracked. Client paid → pedimento marked paid.

| Component | Status | Details |
|-----------|--------|---------|
| QuickBooks integration | ❌ not built | Bank/payment reconciliation |
| Payment status tracking | ❌ not built | Mark pedimentos as paid/unpaid |
| Overdue payment alerts | ❌ not built | Telegram alert when payment is late |

**Next action:** Determine if QuickBooks is the right tool or if e-conta handles this. Ask Tito.

---

## STEP 12: ARCHIVE
**Status: 🟡 PARTIAL**
**Owner: THE VAULT (expediente storage + audit trail)**

Full expediente stored. Every document, every action, every timestamp. SAT audit-ready.

| Component | Status | Details |
|-----------|--------|---------|
| expediente_documentos table | ✅ exists | Document storage with file_url |
| Supabase Storage bucket | ✅ exists | "expedientes" bucket, private |
| Audit trail (pipeline_log) | ✅ working | 2,915 entries |
| Complete expediente view | 🟡 partial | Shows docs but not all 15 types |
| Immutable append-only log | 🟡 needs verification | Should never delete, only append |

**Next action:** Verify immutability. Build full expediente PDF export for SAT audit.

---

## TAB OWNERSHIP MAP

| Tab | Steps Owned | Primary Focus |
|-----|-------------|---------------|
| THE ORACLE | ALL (oversight) | Sequencing, priorities, strategy |
| THE FORGE | 1, 4, 6 | Upload UI, solicitation UI, review UI |
| THE VAULT | 10, 12 | Invoice generation, archive, audit trail |
| THE LOOM | 1, 3, 4 | email-intake, completeness, solicitation automation |
| THE NEXUS | 7, 8, 9, 10, 11 | VUCEM, Aduanet, e-conta, QuickBooks |
| THE TOWER | ALL (monitoring) | Health checks, alerts, incident response |
| THE FURNACE | 2, 5, 6 | Classification, drafting, confidence, corrections |
| THE HUNT | — | Client acquisition (feeds new clients into Step 1) |

---

## THE CRITICAL PATH

These five must happen in order. Everything else is important but not essential.

```
1. MAFESA live (Step 1-3 working for client #2)          ← THIS WEEK
2. Solicitation automation (Step 4 complete)               ← NEXT WEEK
3. Pedimento drafting live (Step 5 — needs credits)        ← FRIDAY+
4. Shadow mode accuracy (Step 5-6 measured for 30 days)    ← MAY
5. VUCEM transmission (Step 7 — the gap that closes it)    ← JUNE
```

After these five, Steps 8-11 follow naturally. Step 12 is ongoing.

---

## KARPATHY INTEGRATION

The learning loop touches Steps 2, 5, and 6:

```
Step 2 (CLASSIFY):  Every classification feeds accuracy metrics
Step 5 (DRAFT):     Every draft gets a confidence score
Step 6 (REVIEW):    Every Tito correction is training data

correction logged → pattern detected → rule created → next draft better
                                                        ↓
                                            fewer corrections needed
                                                        ↓
                                            confidence threshold rises
                                                        ↓
                                            autonomous transmission enabled
```

**The Furnace is not a separate feature. It IS the pipeline getting smarter.**

---

## CAZA / HUNT INTEGRATION

THE HUNT feeds NEW clients into Step 1:

```
Ghost client identified → Tito calls → client signs →
portal created → first email arrives → Step 1 begins →
pipeline processes → Furnace learns → next client is faster
```

**Current HUNT state:** 46 clients in pipeline, 8 ghost clients identified, 4 competitor patentes mapped. Real intelligence, not mock data.

---

## SCORING

| Step | Score | Target |
|------|-------|--------|
| 1. Intake | 9/10 | 10/10 |
| 2. Classify | 8/10 | 9.5/10 |
| 3. Completeness | 8/10 | 9/10 |
| 4. Solicit | 4/10 | 9/10 |
| 5. Draft | 3/10 (blocked) | 9/10 |
| 6. Review | 5/10 | 9/10 |
| 7. Transmit | 0/10 | 9/10 |
| 8. Crossing | 1/10 | 8/10 |
| 9. Clearance | 0/10 | 8/10 |
| 10. Invoice | 0/10 | 8/10 |
| 11. Payment | 0/10 | 7/10 |
| 12. Archive | 6/10 | 9/10 |
| **OVERALL** | **3.7/10** | **8.8/10** |

**Steps 1-3 are strong. Steps 4-6 are close. Steps 7-11 are the mountain.**

---

## UPDATE PROTOCOL

After any build session:
1. Update the status emoji (✅ 🟡 ❌) for affected components
2. Update the score for affected steps
3. Update "Next action" with what comes after
4. Commit: `git add PIPELINE.md && git commit -m "pipeline: update step X status"`

This file is the map. THE ORACLE reads it every morning.

---

*CRUZ — Cross-Border Intelligence*
*Patente 3596 · Aduana 240 · Est. 1941*
*The first automated clearance software on the border.*
