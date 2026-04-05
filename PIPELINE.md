# CRUZ PIPELINE — The Full Clearance Lifecycle
## Single Source of Truth — Updated: 2026-04-05
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
**Owner: email-intake.js + portal upload UI**

Documents arrive via email or portal upload. Shadow reader observes.

| Component | Status | Details |
|-----------|--------|---------|
| email-intake.js | ✅ online | Sonnet extraction, */15 min cron |
| Gmail OAuth (ai@) | ✅ working | GMAIL_REFRESH_TOKEN_AI |
| Gmail OAuth (Eloisa) | ✅ working | GMAIL_REFRESH_TOKEN_ELOISA |
| Gmail OAuth (Claudia) | ✅ working | GMAIL_REFRESH_TOKEN_CLAUDIA |
| Portal /upload/[token] | ✅ working | Magic link upload |
| Shadow reader | ✅ working | Sonnet classification, */30 min |
| shadow_classifications table | ✅ live | Observe-only intelligence |

---

## STEP 2: CLASSIFY
**Status: ✅ WORKING**
**Owner: doc-classifier.js (Ollama qwen3:8b) + Sonnet shadow**

| Component | Status | Details |
|-----------|--------|---------|
| doc-classifier.js | ✅ working | Ollama qwen3:8b, 16 doc types |
| shadow-reader.js | ✅ working | Sonnet classification, cost-tracked |
| document_classifications | ✅ live | Growing dataset |
| shadow_classifications | ✅ live | Sonnet observe-mode comparison |
| Confidence thresholds | ✅ set | >0.85 auto, 0.60-0.85 flag, <0.60 OTRO |
| Shadow weekly report | ✅ built | Sunday Telegram summary |

---

## STEP 3: COMPLETENESS + SYNC
**Status: ✅ WORKING**
**Owner: globalpc-sync + completeness-checker**

GlobalPC sync pulls data for all active clients (47). Completeness checker
identifies missing documents per tráfico.

| Component | Status | Details |
|-----------|--------|---------|
| globalpc-sync.js | ✅ online | MySQL → Supabase, all client tables |
| nightly-pipeline.js | ✅ working | 1 AM, all clients, anomaly + solicit chained |
| completeness-checker.js | ✅ online | 6 AM daily, 15-doc checklist |
| Expediente Digital page | ✅ working | Coverage % per tráfico |
| EVCO supplier resolution | ✅ 100% | 0 PRV_ codes remaining |
| MAFESA supplier resolution | ✅ 100% | 0 PRV_ codes remaining |

---

## STEP 4: SOLICIT
**Status: 🟡 PARTIAL**
**Owner: solicitud-email.js + draft-escalation.js**

Missing docs → auto-request email → escalation if no response.

| Component | Status | Details |
|-----------|--------|---------|
| solicit-missing-docs.js | ✅ built | Creates solicitation drafts |
| solicitud-email.js | 🟡 ready | Email via Resend, NOT activated (needs Tito approval) |
| documento_solicitudes table | ✅ live | 1,000+ pending |
| 4-hour escalation | ✅ built | draft-escalation.js, 3 levels |
| Magic upload link | ✅ working | /upload/[token] with 72h expiry |

**Next:** Tito approves activation of solicitud-email.js

---

## STEP 5: DRAFT
**Status: 🟡 PARTIAL — BLOCKED ON API CREDITS**
**Owner: pedimento-drafter + confidence score**

| Component | Status | Details |
|-----------|--------|---------|
| pedimento_drafts table | ✅ live | 131 drafts, 68 stale >48h |
| Draft creation (Sonnet) | 🟡 blocked | API credits exhausted |
| Confidence score | 🟡 designed | 3-tier system built |
| CRUZ AI error handling | ✅ fixed | Clear billing/rate limit messages |

**Next:** Replenish Anthropic credits. Test live draft creation.

---

## STEP 6: REVIEW + APPROVAL
**Status: ✅ WORKING**
**Owner: telegram-bot.js + telegram-webhook**

Tito reviews and approves via Telegram. Full audit trail.

| Component | Status | Details |
|-----------|--------|---------|
| /aprobar command (bot) | ✅ built | Lists pending items with inline buttons |
| /pendientes command | ✅ built | Counts grouped by type with stale flags |
| Telegram webhook | ✅ working | /aprobar_[UUID] callback handling |
| 5-second cancel window | ✅ built | Observable and interruptible |
| "Patente 3596 honrada" | ✅ built | Confirmation message on approval |
| audit_log | ✅ immutable | Every approval/rejection/correction logged |
| staff_corrections table | ✅ created | For accuracy tracking |
| Morning report | ✅ enriched | Pending counts, stale flags, shadow stats |

---

## STEP 7: SHADOW INTELLIGENCE
**Status: ✅ WORKING**
**Owner: shadow-reader.js + shadow-weekly-report.js**

Observe-only mode. Classify everything, intervene in nothing.

| Component | Status | Details |
|-----------|--------|---------|
| shadow-reader.js | ✅ working | Sonnet classification, */30 min |
| shadow_classifications | ✅ live | email_id, classification, confidence |
| staff_corrections | ✅ created | Correction tracking for accuracy |
| shadow-weekly-report.js | ✅ built | Sunday Telegram summary |
| Cost tracking | ✅ built | api_cost_log per classification |

---

## STEP 8: TRANSMIT
**Status: ❌ NOT BUILT**

VUCEM SOAP integration. Requires sandbox credentials from SAT.

---

## STEP 9: CROSSING
**Status: ❌ NOT BUILT**

Aduanet status polling. Semáforo tracking. Bridge/lane assignment.
crossing-predictor.js exists but Aduanet integration not wired.

---

## STEP 10: CLEARANCE
**Status: ❌ NOT BUILT**

Despacho confirmation. Client notification. Clearance timestamp logging.

---

## STEP 11: INVOICE + PAYMENT
**Status: ❌ NOT BUILT**

Invoice generation, e-conta sync, payment reconciliation.

---

## STEP 12: ARCHIVE
**Status: 🟡 PARTIAL**

| Component | Status | Details |
|-----------|--------|---------|
| expediente_documentos | ✅ live | EVCO: 180K docs, MAFESA: 1.8K docs |
| Supabase Storage | ✅ live | Private expedientes bucket |
| pipeline_log | ✅ working | 2,900+ entries |
| SAT audit export | ❌ not built | Full expediente PDF for audit |

---

## MONITORING + HEALTH

| Component | Status | Details |
|-----------|--------|---------|
| pipeline-health.js | ✅ built | Smart interval checks, replaces basic heartbeat |
| heartbeat.js | ✅ working | Supabase + portal + pm2 + sync |
| heartbeat_log | ✅ live | All scripts log completion |
| morning-report.js | ✅ enriched | Multi-client, TC, shadow, pending approvals |
| Telegram alerts | ✅ working | Failures → 🔴, stale → 🟡, healthy → ✅ |

---

## CRONTAB (Throne Mac Studio)

```
# PATH must be first line
PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin

# ── Pipeline ──
0 1 * * *          node ~/evco-portal/scripts/nightly-pipeline.js >> /tmp/nightly-pipeline.log 2>&1
55 6 * * *         node ~/evco-portal/scripts/morning-report.js >> /tmp/morning-report.log 2>&1
*/5 6-22 * * 1-6   node ~/evco-portal/scripts/email-intake.js --ollama >> /tmp/email-intake.log 2>&1
30 2 * * *         node ~/evco-portal/scripts/doc-classifier.js >> /tmp/doc-classifier.log 2>&1

# ── Monitoring ──
*/15 * * * *       node ~/evco-portal/scripts/pipeline-health.js >> /tmp/pipeline-health.log 2>&1
30 1 * * *         node ~/evco-portal/scripts/regression-guard.js >> /tmp/regression-guard.log 2>&1

# ── Shadow mode ──
*/30 6-22 * * 1-6  node ~/evco-portal/scripts/shadow-reader.js >> /tmp/shadow-reader.log 2>&1
0 20 * * 0         node ~/evco-portal/scripts/shadow-weekly-report.js >> /tmp/shadow-weekly-report.log 2>&1

# ── Escalation ──
*/15 * * * *       node ~/evco-portal/scripts/draft-escalation.js >> /tmp/draft-escalation.log 2>&1

# ── Data ──
*/30 * * * *       node ~/evco-portal/scripts/fetch-bridge-times.js >> /tmp/fetch-bridge-times.log 2>&1
0 6 * * *          node ~/evco-portal/scripts/banxico-rate.js >> /tmp/banxico-rate.log 2>&1
```

**PM2 always-on:** `cruz-bot` (telegram-bot.js polling)

---

## SCORING

| Step | Score | Target | Change |
|------|-------|--------|--------|
| 1. Intake | 9.5/10 | 10/10 | — |
| 2. Classify | 8.5/10 | 9.5/10 | +0.5 (shadow Sonnet) |
| 3. Completeness + Sync | 8.5/10 | 9/10 | +0.5 (PRV resolved) |
| 4. Solicit | 5/10 | 9/10 | +1 (pipeline wired) |
| 5. Draft | 3/10 | 9/10 | — (blocked on credits) |
| 6. Review + Approval | 8/10 | 9/10 | +3 (/aprobar, /pendientes, morning enrichment) |
| 7. Shadow Intelligence | 8/10 | 9/10 | NEW |
| 8. Transmit | 0/10 | 9/10 | — |
| 9. Crossing | 1/10 | 8/10 | — |
| 10. Clearance | 0/10 | 8/10 | — |
| 11. Invoice + Payment | 0/10 | 7/10 | — |
| 12. Archive | 6/10 | 9/10 | — |
| **OVERALL** | **4.7/10** | **8.8/10** | **+1.0** |

**Steps 1-3 strong. Steps 6-7 now strong. Steps 4-5 close (credits + Tito approval). Steps 8-11 are the mountain.**

---

## THE CRITICAL PATH

```
1. API credits restored (Step 5 unblocked)              ← NEXT
2. Solicitation activated (Step 4 — Tito approval)       ← THIS WEEK
3. Shadow accuracy measured (30 days baseline)            ← MAY
4. VUCEM sandbox credentials (Step 8 — SAT)              ← JUNE
5. Aduanet polling (Step 9 — crossing tracking)           ← JUNE
```

---

## UPDATE PROTOCOL

After any build session:
1. Update status emoji (✅ 🟡 ❌) for affected components
2. Update score for affected steps
3. Update "Next action"
4. Commit: `git add PIPELINE.md && git commit -m "pipeline: update step X"`

---

*CRUZ — Cross-Border Intelligence*
*Patente 3596 · Aduana 240 · Est. 1941*
*The first automated clearance software on the border.*
