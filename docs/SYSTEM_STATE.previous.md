```
=== ADUANA SYSTEM STATE ===
Generated: 2026-04-10T21:44:38.609Z
Health: RED
Database: 1,019,577 rows across 11 tables
Pipeline: 4/8 online, 12/21 handlers wired
Last 24h: 46982 events processed, 82 classifications, $0.2200
```

# ADUANA System State Audit

## Section 1 — Header

| Field | Value |
|---|---|
| Generated | 2026-04-10T21:43:36.176Z (UTC) / Friday, April 10, 2026 at 4:43:36 PM CDT (Laredo) |
| Hostname | Renatos-Mac-Studio.local |
| Git branch | `feature/v6-phase0-phase1` |
| Last commit | `444f8cf` |
| Uncommitted files | 29 |

## Section 2 — Database State

| Table | Total Rows | Last 24h |
|---|---|---|
| traficos | 32,353 | +1646 |
| entradas | 64,734 | +1663 |
| globalpc_productos | 748,922 | +0 |
| globalpc_proveedores | 1,971 | +0 |
| partidas | 2,709 | +0 |
| oca_database | 2,301 | +22 |
| api_cost_log | 3,313 | +82 |
| workflow_events | 161,098 | +46982 |
| workflow_chains | 10 | +0 |
| operational_decisions | 2,157 | +415 |
| job_runs | 9 | +9 |

### globalpc_productos Breakdown

| Metric | Count |
|---|---|
| fraccion IS NOT NULL | 93,678 |
| fraccion_source = 'ai_auto_classifier' | 252 |
| Legacy priors (fraccion NOT NULL, source IS NULL) | 93,426 |

**fraccion_source distribution (sample):**

| Source | Count |
|---|---|
| ai_auto_classifier | 252 |

### workflow_events Breakdown

| Status | Count |
|---|---|
| pending | 103,976 |
| processing | 0 |
| completed | 57,122 |
| failed | 0 |
| dead_letter | 0 |

**Top 10 event_type:**

| Event Type | Count |
|---|---|
| entrada_synced | 967 |
| document_received | 15 |
| completeness_check | 15 |
| product_needs_classification | 2 |
| email_processed | 1 |

- Events in last 24h: 46982
- Failed events in last 7 days: 0
- Stuck events (pending > 1h): 101178

### traficos Breakdown

| company_id | Count |
|---|---|
| aceros-termicos | 242 |
| bekaert | 238 |
| becomar | 147 |
| alimentos-san-fabian | 145 |
| balatas-mexicanas-s-a-de-c-v | 79 |
| aure-quim-s-a-de-c-v | 74 |
| artipac-articulos-para-empacad | 15 |
| b-l-harbert-international-l-l- | 11 |
| alisur-s-a-de-c-v | 9 |
| ann-o-brien-inc-sa-de-cv | 8 |

Distinct company_id values: 21

## Section 3 — PM2 Fleet State

| Name | Status | Script | Cron | Restarts | Memory | CPU | Uptime |
|---|---|---|---|---|---|---|---|
| cruz-bot | online | scripts/telegram-bot.js | — | 3 | 101.2 MB | 0.2% | 2026-04-08T19:55:54.828Z |
| fold-agent | online | ~/fold/fold-agent.js | — | 2 | 86.3 MB | 0.2% | 2026-04-08T19:55:55.012Z |
| workflow-processor | online | scripts/workflow-processor.js | — | 7 | 102.8 MB | 0.2% | 2026-04-10T21:21:08.500Z |
| cruz-crossing | stopped | scripts/cruz-crossing.js | */15 6-22 * * 1-6 | 0 | — | 0% | 2026-04-10T21:30:00.005Z |
| cruz-closeout | stopped | scripts/cruz-closeout.js | */30 6-22 * * 1-6 | 0 | — | 0% | 2026-04-10T21:30:00.011Z |
| cruz-touch-monitor | stopped | scripts/touch-monitor.js | * * * * * | 3 | — | 0% | 2026-04-10T21:44:00.001Z |
| clearance-sandbox | stopped | scripts/sandbox/clearance-sandbox.js | 0 5 * * * | 0 | — | 0% | 2026-04-10T10:00:00.416Z |
| wsdl-document-pull | online | scripts/wsdl-document-pull.js | 0 3 * * * | 84466 | 113.6 MB | 70% | 2026-04-10T21:44:16.422Z |

### Flags

- CRASH LOOP: `workflow-processor` has 7 restarts
- CRASH LOOP: `wsdl-document-pull` has 84466 restarts

## Section 4 — Crontab State

| Schedule | Command | Script Exists |
|---|---|---|
| `*/15 * * * *` | `cd ~/evco-portal && node scripts/heartbeat.js >> /tmp/heartbeat.log 2>&1` | YES |
| `0 */4 * * *` | `cd ~/evco-portal && node scripts/integration-health.js >> /tmp/integration-he...` | YES |
| `30 1 * * *` | `cd ~/evco-portal && node scripts/regression-guard.js >> /tmp/regression-guard...` | YES |
| `0 4 * * 0` | `cd ~/evco-portal && node scripts/data-quality-audit.js >> /tmp/data-quality.l...` | YES |
| `*/15 * * * *` | `cd ~/evco-portal && node scripts/draft-escalation.js >> /tmp/draft-escalation...` | YES |
| `50 6 * * *` | `cd ~/evco-portal && node scripts/morning-brief-engine.js >> /tmp/morning-brie...` | YES |
| `55 6 * * *` | `cd ~/evco-portal && node scripts/morning-report.js >> /tmp/morning-report.log...` | YES |
| `0 1 * * *` | `cd ~/evco-portal && node scripts/nightly-pipeline.js >> /tmp/nightly-pipeline...` | YES |
| `*/15 6-22 * * 1-6` | `cd ~/evco-portal && node scripts/globalpc-delta-sync.js >> /tmp/delta-sync.lo...` | YES |
| `*/30 6-22 * * 1-6` | `cd ~/evco-portal && node scripts/status-flow-engine.js >> /tmp/status-flow.lo...` | YES |
| `*/30 6-22 * * *` | `cd ~/evco-portal && node scripts/cbp-wait-times.js >> /tmp/cbp-wait.log 2>&1` | YES |
| `*/2 * * * *` | `cd ~/evco-portal && node scripts/send-notifications.js >> /tmp/send-notificat...` | YES |
| `0 3 * * 0` | `cd ~/evco-portal && node scripts/crossing-model-train.js >> /tmp/crossing-mod...` | YES |
| `0 */2 6-22 * *` | `1-6 cd ~/evco-portal && /opt/homebrew/bin/node scripts/shadow-reader.js >> /t...` | YES |
| `30 2 * * *` | `cd ~/evco-portal && /opt/homebrew/bin/node scripts/doc-classifier.js >> /tmp/...` | YES |
| `*/5 6-22 * * 1-6` | `cd ~/evco-portal && /opt/homebrew/bin/node scripts/email-intake.js >> /tmp/em...` | YES |
| `*/15 * * * *` | `cd ~/evco-portal && node scripts/self-healer.js >> /tmp/self-healer.log 2>&1` | YES |
| `0 4 * * *` | `cd ~/evco-portal && node scripts/memory-builder.js >> /tmp/memory-builder.log...` | YES |
| `0 4 * * 1` | `cd ~/evco-portal && node scripts/compute-benchmarks.js >> /tmp/benchmarks.log...` | YES |
| `30 1 * * *` | `cd ~/evco-portal && node scripts/anomaly-detector.js >> /tmp/anomaly-detector...` | YES |
| `0 4 * * *` | `cd ~/evco-portal && node scripts/fix-stale-estatus.js >> /tmp/fix-stale.log 2>&1` | YES |
| `0 6 * * 1-6` | `cd ~/evco-portal && node scripts/compliance-predictor.js >> /tmp/compliance.l...` | YES |
| `0 5 * * *` | `cd ~/evco-portal && node scripts/crossing-predictor.js >> /tmp/crossing-pred....` | YES |
| `*/5 6-22 * * 1-6` | `cd ~/evco-portal && /opt/homebrew/bin/node scripts/cruz-agent.js >> /tmp/cruz...` | YES |
| `0 5 * * *` | `cd ~/evco-portal && /opt/homebrew/bin/node scripts/post-operation-analysis.js...` | YES |
| `0 22 * * 0` | `cd ~/evco-portal && /opt/homebrew/bin/node scripts/institutional-memory.js >>...` | YES |
| `0 3 1 * *` | `cd ~/evco-portal && /opt/homebrew/bin/node scripts/assumption-checker.js >> /...` | YES |
| `0 7 * * 1-6` | `cd ~/evco-portal && /opt/homebrew/bin/node scripts/predictive-classifier.js >...` | YES |
| `0 5 1 1,4,7,10 *` | `cd ~/evco-portal && /opt/homebrew/bin/node scripts/compliance-risk-model.js >...` | YES |
| `0 6 * * 1` | `cd ~/evco-portal && /opt/homebrew/bin/node scripts/demand-predictor.js >> /tm...` | YES |
| `0 7 * * 1-6` | `cd ~/evco-portal && /opt/homebrew/bin/node scripts/exchange-rate-optimizer.js...` | YES |
| `0 4 * * *` | `cd ~/evco-portal && /opt/homebrew/bin/node scripts/network-intelligence.js >>...` | YES |
| `30 2 * * *` | `cd ~/evco-portal && /opt/homebrew/bin/node scripts/ghost-trafico-detector.js ...` | YES |
| `0 6 * * *` | `cd ~/evco-portal && /opt/homebrew/bin/node scripts/banxico-rate.js >> /tmp/ba...` | YES |

## Section 5 — Script Inventory

| File | Class | Size | Modified | Header |
|---|---|---|---|---|
| cruz-closeout.js | PM2 | 11.2 KB | 2026-04-07 | CRUZ Close-Out — Build 7 | When a shipment is delivered, ... |
| cruz-crossing.js | PM2 | 10.6 KB | 2026-04-07 | CRUZ Crossing Monitor — Build 6 | Monitors active crossin... |
| telegram-bot.js | PM2 | 26.6 KB | 2026-04-07 | const TelegramBot = require('node-telegram-bot-api') | co... |
| touch-monitor.js | PM2 | 5.2 KB | 2026-04-07 | CRUZ Touch Monitor — Shadow-Touch Detection + Snapshot | ... |
| workflow-processor.js | PM2 | 35.0 KB | 2026-04-10 | CRUZ 2.0 — Workflow Processor (replaces cruz-agent.js) | ... |
| wsdl-document-pull.js | PM2 | 12.8 KB | 2026-04-06 | CRUZ WSDL Document Pull (v2 — fixed) | Pulls document met... |
| anomaly-detector.js | CRONTAB | 19.2 KB | 2026-04-07 | CRUZ — Nightly Data Quality Anomaly Detector | Runs after... |
| assumption-checker.js | CRONTAB | 6.6 KB | 2026-04-06 | CRUZ Assumption Checker — monthly self-challenge | Valida... |
| banxico-rate.js | CRONTAB | 1.3 KB | 2026-04-02 | require('dotenv').config({ path: require('path').join(__d... |
| cbp-wait-times.js | CRONTAB | 8.6 KB | 2026-03-30 | scripts/cbp-wait-times.js — BUILD 3 PHASE 15 | CBP Border... |
| compliance-predictor.js | CRONTAB | 6.0 KB | 2026-04-07 | CRUZ Compliance Predictor — predict issues BEFORE they ha... |
| compliance-risk-model.js | CRONTAB | 9.5 KB | 2026-04-07 | CRUZ Compliance Risk Model — predict SAT audit probabilit... |
| compute-benchmarks.js | CRONTAB | 7.8 KB | 2026-04-07 | CRUZ Fleet Benchmarks — aggregate intelligence from 47+ c... |
| crossing-model-train.js | CRONTAB | 13.6 KB | 2026-03-30 | scripts/crossing-model-train.js — BUILD 3 PHASE 3 | Cross... |
| crossing-predictor.js | CRONTAB | 7.4 KB | 2026-04-07 | CRUZ Crossing Predictor — historical data → predictions |... |
| cruz-agent.js | CRONTAB | 15.5 KB | 2026-04-06 | CRUZ Trade Agent — The Autonomous Operator | SENSE → THIN... |
| data-quality-audit.js | CRONTAB | 11.1 KB | 2026-04-07 | scripts/data-quality-audit.js — BUILD 3 PHASE 1 | Data Qu... |
| demand-predictor.js | CRONTAB | 8.1 KB | 2026-04-07 | CRUZ Demand Predictor — predict when clients will ship | ... |
| doc-classifier.js | CRONTAB | 12.9 KB | 2026-04-02 | CRUZ Document Classifier | Uses Ollama qwen3:8b (free, lo... |
| draft-escalation.js | CRONTAB | 9.7 KB | 2026-03-31 | CRUZ Draft Escalation Monitor | Runs every 15 minutes via... |
| email-intake.js | CRONTAB | 45.6 KB | 2026-04-08 | scripts/email-intake.js | CRUZ Email Intake Pipeline — 14... |
| exchange-rate-optimizer.js | CRONTAB | 8.3 KB | 2026-04-06 | CRUZ Exchange Rate Optimizer — filing timing recommendati... |
| fix-stale-estatus.js | CRONTAB | 5.8 KB | 2026-04-07 | CRUZ — Fix Stale Estatus | Repairs traficos stuck as "En ... |
| globalpc-delta-sync.js | CRONTAB | 9.1 KB | 2026-04-07 | CRUZ GlobalPC Delta Sync | Runs every 15 minutes during b... |
| heartbeat.js | CRONTAB | 5.8 KB | 2026-04-02 | CRUZ Heartbeat Monitor v2 — 2026-04-02 | Runs via CRONTAB... |
| institutional-memory.js | CRONTAB | 5.3 KB | 2026-04-06 | CRUZ Institutional Memory — weekly knowledge compilation ... |
| integration-health.js | CRONTAB | 4.3 KB | 2026-03-30 | CRUZ Integration Health Monitor | Checks all integrations... |
| memory-builder.js | CRONTAB | 5.4 KB | 2026-04-05 | CRUZ Memory Builder — Extract patterns, build institution... |
| morning-brief-engine.js | CRONTAB | 5.3 KB | 2026-03-30 | CRUZ Morning Brief Engine | Runs at 6:50 AM daily | Gener... |
| morning-report.js | CRONTAB | 24.1 KB | 2026-04-08 | scripts/morning-report.js | Multi-client daily morning re... |
| network-intelligence.js | CRONTAB | 14.4 KB | 2026-04-07 | CRUZ Network Intelligence — patterns no single broker can... |
| nightly-pipeline.js | CRONTAB | 17.5 KB | 2026-04-05 | CRUZ Nightly Intelligence Pipeline | Runs at 1 AM every n... |
| post-operation-analysis.js | CRONTAB | 5.6 KB | 2026-04-06 | CRUZ Post-Operation Analysis — daily learning from outcom... |
| predictive-classifier.js | CRONTAB | 7.5 KB | 2026-04-10 | CRUZ Predictive Classifier — predict before the shipment ... |
| regression-guard.js | CRONTAB | 10.1 KB | 2026-03-30 | CRUZ Regression Guard | Runs after nightly sync (cron: 30... |
| self-healer.js | CRONTAB | 12.3 KB | 2026-04-07 | CRUZ — Self-Healing System | Detects failures, fixes them... |
| send-notifications.js | CRONTAB | 12.5 KB | 2026-04-01 | scripts/send-notifications.js | CRUZ Client Auto-Notifica... |
| shadow-reader.js | CRONTAB | 10.0 KB | 2026-04-08 | CRUZ Shadow Reader — Sonnet-powered observe-only intellig... |
| status-flow-engine.js | CRONTAB | 3.8 KB | 2026-04-06 | CRUZ Status Flow Engine | Automatically advances tráfico ... |
| aduanet-watcher.js | NPM_SCRIPT | 5.2 KB | 2026-03-30 | CRUZ Aduanet Watcher | Monitors for new pedimentos and au... |
| anomaly-baseline.js | NPM_SCRIPT | 5.9 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| backfill-risk-scores.js | NPM_SCRIPT | 8.6 KB | 2026-03-30 | backfill-risk-scores.js — Score ALL tráficos with null ri... |
| benchmark-intelligence.js | NPM_SCRIPT | 6.9 KB | 2026-03-28 | scripts/benchmark-intelligence.js — FEATURE 13 | Calculat... |
| benchmark-network.js | NPM_SCRIPT | 5.2 KB | 2026-03-28 | scripts/benchmark-network.js — Client benchmarks vs indus... |
| bridge-intelligence.js | NPM_SCRIPT | 5.5 KB | 2026-03-28 | scripts/bridge-intelligence.js — FEATURE 10 | Build histo... |
| calendar-compliance.js | NPM_SCRIPT | 4.5 KB | 2026-03-27 | const { google } = require('googleapis') | const { create... |
| carrier-alerts.js | NPM_SCRIPT | 6.9 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| carrier-scorecard.js | NPM_SCRIPT | 2.2 KB | 2026-03-27 | const { createClient } = require('@supabase/supabase-js')... |
| client-intelligence.js | NPM_SCRIPT | 9.8 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| compliance-officer.js | NPM_SCRIPT | 5.6 KB | 2026-03-30 | scripts/compliance-officer.js — Weekly AI compliance asse... |
| concierge-engine.js | NPM_SCRIPT | 5.4 KB | 2026-03-30 | CRUZ Concierge Engine | Generates proactive intelligence ... |
| crossing-prediction.js | NPM_SCRIPT | 6.3 KB | 2026-03-28 | scripts/crossing-prediction.js — FEATURE 2 | Nightly cros... |
| cruz-learning-engine.js | NPM_SCRIPT | 4.3 KB | 2026-04-07 | CRUZ Learning Engine | Discovers patterns from operationa... |
| database-backup.js | NPM_SCRIPT | 4.1 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| deep-crossing-intel.js | NPM_SCRIPT | 11.3 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| deep-research-scheduler.js | NPM_SCRIPT | 5.7 KB | 2026-04-08 | const { createClient } = require('@supabase/supabase-js')... |
| document-autolink.js | NPM_SCRIPT | 6.0 KB | 2026-03-30 | scripts/document-autolink.js — FEATURE 6 | Auto-link emai... |
| document-intelligence.js | NPM_SCRIPT | 3.4 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| email-intelligence.js | NPM_SCRIPT | 4.0 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| entradas-anomaly.js | NPM_SCRIPT | 4.5 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| error-monitor.js | NPM_SCRIPT | 2.8 KB | 2026-03-30 | const fs = require('fs') | require('dotenv').config({ pat... |
| evco-weekly-audit.js | NPM_SCRIPT | 13.7 KB | 2026-03-27 | scripts/evco-weekly-audit.js | Generates a weekly audit P... |
| feedback-loop.js | NPM_SCRIPT | 7.0 KB | 2026-04-01 | CRUZ Feedback Loop — Notification Engagement Analysis | R... |
| financial-intelligence.js | NPM_SCRIPT | 8.6 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| fraccion-intelligence.js | NPM_SCRIPT | 12.7 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| globalpc-client.js | NPM_SCRIPT | 4.9 KB | 2026-03-31 | const soap = require('soap') | require('dotenv').config({... |
| globalpc-sync.js | NPM_SCRIPT | 39.1 KB | 2026-04-07 | const { createClient } = require('@supabase/supabase-js')... |
| gmail-oauth-setup.js | NPM_SCRIPT | 2.3 KB | 2026-03-27 | const { google } = require('googleapis') | const http = r... |
| gmail-scan.js | NPM_SCRIPT | 4.9 KB | 2026-03-30 | const { google } = require('googleapis') | const { create... |
| historical-sync.js | NPM_SCRIPT | 8.4 KB | 2026-03-30 | CRUZ Historical Data Sync | One-time run to pull complete... |
| igi-checker.js | NPM_SCRIPT | 2.7 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| import-predictor.js | NPM_SCRIPT | 4.3 KB | 2026-03-30 | scripts/import-predictor.js — Predict upcoming imports fr... |
| knowledge-graph-builder.js | NPM_SCRIPT | 3.3 KB | 2026-04-07 | CRUZ Knowledge Graph Builder | Builds entity relationship... |
| kpi-alerts.js | NPM_SCRIPT | 2.7 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| monday-prep.js | NPM_SCRIPT | 6.1 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| monday-smoke-test.js | NPM_SCRIPT | 4.6 KB | 2026-03-30 | CRUZ Monday Smoke Test | Verifies everything works before... |
| monthly-report.js | NPM_SCRIPT | 14.1 KB | 2026-04-08 | scripts/monthly-report.js — BUILD 3 PHASE 13 | Auto-gener... |
| mve-assistant.js | NPM_SCRIPT | 3.8 KB | 2026-03-30 | scripts/mve-assistant.js — FEATURE 9 | Daily MVE filing a... |
| network-effects.js | NPM_SCRIPT | 4.1 KB | 2026-03-28 | scripts/network-effects.js — FEATURE 19 | Pre-populate in... |
| new-client-checklist.js | NPM_SCRIPT | 2.0 KB | 2026-03-27 | const fs = require('fs'); const path = require('path') | ... |
| oca-intelligence.js | NPM_SCRIPT | 7.9 KB | 2026-03-28 | scripts/oca-intelligence.js — TIGIE/OCA Classification In... |
| ollama-classifier.js | NPM_SCRIPT | 6.4 KB | 2026-03-27 | require('dotenv').config({ path: '.env.local' }) | const ... |
| onboard-client.js | NPM_SCRIPT | 8.5 KB | 2026-04-05 | CRUZ Client Onboarding — one command, new client live | M... |
| pcnet-sync.js | NPM_SCRIPT | 1.4 KB | 2026-03-27 | const { createClient } = require('@supabase/supabase-js')... |
| pedimento-risk-score.js | NPM_SCRIPT | 6.5 KB | 2026-03-30 | scripts/pedimento-risk-score.js — FEATURE 1 | Calculate r... |
| portfolio-benchmarks.js | NPM_SCRIPT | 4.0 KB | 2026-04-07 | scripts/portfolio-benchmarks.js — Comparative Intelligenc... |
| pre-arrival-brief.js | NPM_SCRIPT | 6.8 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| price-intelligence.js | NPM_SCRIPT | 5.3 KB | 2026-04-07 | scripts/price-intelligence.js — FEATURE 18 | Statistical ... |
| product-intelligence.js | NPM_SCRIPT | 8.8 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| prospect-intelligence.js | NPM_SCRIPT | 11.5 KB | 2026-03-30 | CRUZ Prospect Intelligence Engine | Scans aduanet_factura... |
| proveedor-intelligence.js | NPM_SCRIPT | 5.5 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| rectificacion-detector.js | NPM_SCRIPT | 7.0 KB | 2026-03-30 | scripts/rectificacion-detector.js — FEATURE 3 | Scan pedi... |
| regulatory-monitor.js | NPM_SCRIPT | 5.2 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| resync-productos.js | NPM_SCRIPT | 11.7 KB | 2026-04-08 | resync-productos.js — Fix key mismatch and re-sync 189K p... |
| revenue-engine.js | NPM_SCRIPT | 3.1 KB | 2026-04-07 | CRUZ Revenue Engine | Calculates platform value and savin... |
| run-ghost.js | NPM_SCRIPT | 15.3 KB | 2026-04-08 | CRUZ Ghost Pedimento Runner — CLI | Simulates pedimento c... |
| savings-tracker.js | NPM_SCRIPT | 5.6 KB | 2026-04-07 | const { createClient } = require('@supabase/supabase-js')... |
| send-weekly-audit.js | NPM_SCRIPT | 11.6 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| send-welcome-emails.js | NPM_SCRIPT | 5.1 KB | 2026-03-30 | CRUZ Welcome Email System | Sends portal access credentia... |
| setup-supabase.js | NPM_SCRIPT | 6.7 KB | 2026-03-27 | const { createClient } = require('@supabase/supabase-js')... |
| setup-whatsapp.js | NPM_SCRIPT | 3.3 KB | 2026-03-27 | scripts/setup-whatsapp.js | Configure Twilio WhatsApp San... |
| soia-watcher.js | NPM_SCRIPT | 4.1 KB | 2026-03-30 | CRUZ SOIA Watcher | Monitors semáforo status for active t... |
| supplier-comms.js | NPM_SCRIPT | 6.6 KB | 2026-04-08 | scripts/supplier-comms.js — Automated supplier T-MEC cert... |
| supplier-intelligence.js | NPM_SCRIPT | 4.5 KB | 2026-04-02 | require('dotenv').config({ path: '.env.local' }) | const ... |
| supplier-network.js | NPM_SCRIPT | 5.8 KB | 2026-04-07 | scripts/supplier-network.js — FEATURE 5 | Build cross-cli... |
| system-audit.js | NPM_SCRIPT | 3.3 KB | 2026-03-27 | require('dotenv').config({ path: '.env.local' }) | const ... |
| test-data-isolation.js | NPM_SCRIPT | 2.6 KB | 2026-03-29 | CRUZ Data Isolation Test | Verifies that client data is p... |
| tipo-cambio-monitor.js | NPM_SCRIPT | 4.8 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| tmec-calendar.js | NPM_SCRIPT | 7.4 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| tmec-guardian.js | NPM_SCRIPT | 9.9 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| tmec-optimizer.js | NPM_SCRIPT | 5.0 KB | 2026-04-07 | CRUZ T-MEC Optimization Engine | Runs weekly — finds savi... |
| tmec-weekly-audit.js | NPM_SCRIPT | 2.3 KB | 2026-03-27 | const { createClient } = require('@supabase/supabase-js')... |
| validate-client.js | NPM_SCRIPT | 6.5 KB | 2026-03-27 | const { createClient } = require('@supabase/supabase-js')... |
| warehouse-intelligence.js | NPM_SCRIPT | 10.7 KB | 2026-04-05 | const { createClient } = require('@supabase/supabase-js')... |
| weekly-executive-summary.js | NPM_SCRIPT | 5.7 KB | 2026-03-30 | const { createClient } = require('@supabase/supabase-js')... |
| whisper-watcher.js | NPM_SCRIPT | 7.2 KB | 2026-04-08 | const chokidar = require('chokidar') | const { execSync }... |
| activate-client.js | GHOST | 3.8 KB | 2026-04-05 | CRUZ Client Activation — checks readiness, creates creden... |
| activate-trial-clients.js | GHOST | 7.7 KB | 2026-04-07 | CRUZ — Activate Top 15 Clients for 30-Day Portal Trial | ... |
| aduanet-import.js | GHOST | 6.7 KB | 2026-03-30 | aduanet-import.js — Import pedimentos from CSV/Excel expo... |
| aduanet-puppeteer-scraper.js | GHOST | 16.0 KB | 2026-04-06 | ADUANET Puppeteer Scraper | Logs in to aduanetm3.net, pul... |
| aduanet-scraper.js | GHOST | 21.9 KB | 2026-04-06 | CRUZ ADUANET Scraper — Login, Search Pedimentos, Extract ... |
| anexo24-reconciler.js | GHOST | 5.8 KB | 2026-04-07 | CRUZ Annex 24 Reconciler — IMMEX inventory tracking | Tra... |
| anomaly-check.js | GHOST | 9.1 KB | 2026-04-01 | CRUZ Anomaly Check | Standalone cron script — detects ano... |
| anomaly-interceptor.js | GHOST | 2.1 KB | 2026-04-10 | ADUANA Anomaly Interceptor — flags deviations from suppli... |
| audit-evco-contamination.js | GHOST | 2.7 KB | 2026-04-08 | require('dotenv').config({ path: require('path').join(__d... |
| audit-system-state.js | GHOST | 40.5 KB | 2026-04-10 | ADUANA System State Auditor | Generates a comprehensive m... |
| auto-classifier.js | GHOST | 25.5 KB | 2026-04-08 | CRUZ Auto-Classifier — AI fracción suggestion with histor... |
| auto-invoice.js | GHOST | 8.8 KB | 2026-04-07 | CRUZ Auto-Invoice Generator — Build 214 | When a tráfico ... |
| autonomy-tracker.js | GHOST | 4.5 KB | 2026-04-05 | CRUZ Autonomy Tracker — promotes/demotes action autonomy ... |
| backfill-agent-decisions-from-oca.js | GHOST | 3.0 KB | 2026-04-08 | One-time backfill: oca_database (auto_classifier) → agent... |
| backfill-doc-types.js | GHOST | 4.4 KB | 2026-04-06 | CRUZ Backfill Doc Types | Reclassifies expediente_documen... |
| backfill-expediente-linkage.js | GHOST | 8.0 KB | 2026-04-05 | Backfill expediente_documentos.pedimento_id → tráfico cod... |
| backfill-expediente-v2.js | GHOST | 5.6 KB | 2026-04-07 | Backfill expediente_documentos v2 — targeted pass | The v... |
| backfill-fecha-cruce.js | GHOST | 3.5 KB | 2026-04-07 | CRUZ — Backfill fecha_cruce from GlobalPC MySQL | Pulls c... |
| backfill-orchestrator.js | GHOST | 2.3 KB | 2026-04-10 | ADUANA Backfill Orchestrator — classification backfill fo... |
| backfill-transportista.js | GHOST | 3.9 KB | 2026-04-07 | CRUZ — Backfill Transportista from GlobalPC MySQL | Pulls... |
| block13-launch-credentials.js | GHOST | 7.2 KB | 2026-04-09 | CRUZ — Block 13: Generate credentials for top 10 clients ... |
| bootcamp-anomaly-library.js | GHOST | 8.6 KB | 2026-04-06 | CRUZ Intelligence Bootcamp 6 — Anomaly Pattern Library | ... |
| bootcamp-client-fingerprint.js | GHOST | 11.6 KB | 2026-04-06 | CRUZ Intelligence Bootcamp 5 — Client Operation Fingerpri... |
| bootcamp-crossing-patterns.js | GHOST | 14.0 KB | 2026-04-06 | CRUZ Intelligence Bootcamp 3 — Crossing Pattern Analysis ... |
| bootcamp-email-speedrun.js | GHOST | 16.4 KB | 2026-04-08 | CRUZ Intelligence Bootcamp 1 — Email History Speed-Run | ... |
| bootcamp-fraccion-mining.js | GHOST | 10.4 KB | 2026-04-06 | CRUZ Intelligence Bootcamp 2 — Classification History Min... |
| bootcamp-regulatory-timeline.js | GHOST | 12.3 KB | 2026-04-06 | CRUZ Intelligence Bootcamp 7 — Regulatory Timeline Builde... |
| bootcamp-sandbox.js | GHOST | 9.2 KB | 2026-04-06 | CRUZ Intelligence Bootcamp 8 — The Sandbox | Replay engin... |
| bootcamp-supplier-model.js | GHOST | 11.4 KB | 2026-04-06 | CRUZ Intelligence Bootcamp 4 — Supplier Behavior Modeling... |
| build-client-profile.js | GHOST | 7.8 KB | 2026-04-07 | CRUZ Client Intelligence Profiles | Builds a living profi... |
| build-eta-model.js | GHOST | 6.9 KB | 2026-04-07 | CRUZ — Build ETA Prediction Model | Analyzes historical c... |
| build-supplier-profiles.js | GHOST | 1.8 KB | 2026-04-10 | ADUANA Supplier Profiles — builds intelligence from histo... |
| carrier-ai-coordinator.js | GHOST | 7.6 KB | 2026-04-07 | CRUZ Carrier Coordinator AI — Build 216 | When a tráfico ... |
| carrier-intelligence.js | GHOST | 7.1 KB | 2026-04-07 | CRUZ Carrier Intelligence Network — score and rank carrie... |
| carrier-scoreboard.js | GHOST | 5.3 KB | 2026-04-07 | CRUZ — Carrier Scoreboard Builder (BUILD 154) | Scores ev... |
| check-classify-status.js | GHOST | 870 B | 2026-04-08 | require('dotenv').config({ path: require('path').join(__d... |
| check-contamination.js | GHOST | 1.3 KB | 2026-04-08 | require('dotenv').config({ path: require('path').join(pro... |
| client-readiness-score.js | GHOST | 6.5 KB | 2026-04-05 | CRUZ Client Readiness Score — ranks 51 clients by data qu... |
| client-whisper-engine.js | GHOST | 12.5 KB | 2026-04-07 | CRUZ Client Whisper Network — Build 213 | Proactive intel... |
| competitive-intel.js | GHOST | 9.0 KB | 2026-04-07 | CRUZ Competitive Intelligence Scanner — daily digest for ... |
| completeness-checker.js | GHOST | 11.7 KB | 2026-04-06 | CRUZ Completeness Checker | No AI needed — pure logic. | ... |
| compliance-precog.js | GHOST | 15.9 KB | 2026-04-07 | CRUZ Compliance Precog — predict SAT audits 30 days in ad... |
| correction-digest.js | GHOST | 1.6 KB | 2026-04-10 | ADUANA Correction Digest — weekly summary of human correc... |
| cost-optimizer.js | GHOST | 16.9 KB | 2026-04-07 | CRUZ Landed Cost Optimizer — find savings in every operat... |
| cruz-audit.js | GHOST | 1.1 KB | 2026-04-07 | const {createClient} = require('@supabase/supabase-js') |... |
| cruz-full-audit.js | GHOST | 40.3 KB | 2026-04-07 | CRUZ Full Internal Audit | 40 checks across 6 sections — ... |
| cruz-learning.js | GHOST | 1.8 KB | 2026-03-29 | scripts/cruz-learning.js — Weekly CRUZ AI Learning Report... |
| cruz-mcp-server.js | GHOST | 23.2 KB | 2026-04-08 | CRUZ MCP Server — The First AI-Native Customs Broker | Pa... |
| daily-brief.js | GHOST | 2.0 KB | 2026-04-10 | ADUANA Daily Brief — morning summary sent to Telegram at ... |
| daily-briefing.js | GHOST | 5.4 KB | 2026-04-01 | require('dotenv').config({ path: '.env.local' }) | const ... |
| daily-performance.js | GHOST | 6.4 KB | 2026-04-07 | CRUZ Daily Performance Aggregation | Computes per-company... |
| data-integrity-check.js | GHOST | 5.6 KB | 2026-04-07 | CRUZ Data Integrity Check | Verifies dedup constraints, c... |
| data-verification.js | GHOST | 17.1 KB | 2026-04-05 | CRUZ Data Verification — EVCO (9254) & MAFESA (4598) | Re... |
| decision-logger.js | GHOST | 1.6 KB | 2026-04-06 | CRUZ Decision Logger — captures WHY, not just WHAT | Shar... |
| dedup-classifications.js | GHOST | 3.0 KB | 2026-04-02 | require('dotenv').config({ path: require('path').join(__d... |
| demand-forecast.js | GHOST | 6.5 KB | 2026-04-07 | CRUZ Demand Forecast — predict next 30 days from historic... |
| diagnose-broken-rows.js | GHOST | 966 B | 2026-04-08 | require('dotenv').config({ path: require('path').join(__d... |
| doc-classifier-patch.js | GHOST | 3.8 KB | 2026-04-02 | This script patches doc-classifier.js | const fs = requir... |
| doc-prerequest.js | GHOST | 8.7 KB | 2026-04-01 | CRUZ Doc Pre-Request (Pre-solicitud matutina) | Runs dail... |
| document-extractor.js | GHOST | 5.7 KB | 2026-04-08 | CRUZ Document Extractor — structured data from any PDF | ... |
| document-shadow-network.js | GHOST | 10.4 KB | 2026-04-07 | CRUZ Document Shadow Network — learn document patterns ac... |
| document-wrangler.js | GHOST | 14.9 KB | 2026-04-07 | CRUZ Document Wrangler — Build 210 | Escalating follow-up... |
| drain-entrada-synced.js | GHOST | 1.4 KB | 2026-04-08 | require('dotenv').config({ path: require('path').join(__d... |
| econta-reconciler.js | GHOST | 6.6 KB | 2026-04-07 | CRUZ eConta Reconciler — match operations vs accounting |... |
| email-auto-respond.js | GHOST | 5.1 KB | 2026-04-05 | CRUZ Email Auto-Respond — drafts responses to incoming em... |
| email-study.js | GHOST | 10.6 KB | 2026-04-08 | scripts/email-study.js | CRUZ Email Study Pipeline | Poll... |
| end-of-day-engine.js | GHOST | 9.6 KB | 2026-04-07 | CRUZ End-of-Day Robot — Build 218 | Daily summary at 5 PM... |
| enrich-descriptions.js | GHOST | 6.1 KB | 2026-04-05 | Enrich traficos.descripcion_mercancia with real product n... |
| exception-detective.js | GHOST | 19.5 KB | 2026-04-07 | CRUZ Exception Intelligence Engine — Build 232 | When ano... |
| fetch-bridge-times.js | GHOST | 9.3 KB | 2026-03-31 | CRUZ Bridge Wait Times Fetcher | Runs every 30 minutes vi... |
| filing-processor.js | GHOST | 8.3 KB | 2026-04-06 | CRUZ Filing Processor — "está bien" moment | Polls approv... |
| fix-client-isolation.js | GHOST | 7.0 KB | 2026-04-05 | CRUZ — Fix Client Isolation | Re-maps traficos that are i... |
| fix-globalpc-retry.js | GHOST | 1.1 KB | 2026-04-02 | const fs = require('fs') | const path = require('path') |... |
| fix-pdf-parse.js | GHOST | 1.4 KB | 2026-04-02 | const fs = require('fs') | const path = require('path') |... |
| fix-suppliers.js | GHOST | 846 B | 2026-04-01 | require('dotenv').config({path: '.env.local'}) | const { ... |
| fix-upsert.js | GHOST | 576 B | 2026-04-02 | const fs = require('fs') | const path = require('path') |... |
| full-client-sync.js | GHOST | 16.9 KB | 2026-04-05 | CRUZ Full Client Data Sync — EVCO (9254) + MAFESA (4598) ... |
| full-contamination-audit.js | GHOST | 2.9 KB | 2026-04-08 | require('dotenv').config({ path: require('path').join(pro... |
| full-sync-econta.js | GHOST | 4.7 KB | 2026-03-30 | Full e-Conta sync from MySQL port 33035 | Pulls all table... |
| full-sync-eventos.js | GHOST | 3.2 KB | 2026-03-30 | require('dotenv').config({ path: require('path').join(__d... |
| full-sync-facturas.js | GHOST | 3.4 KB | 2026-03-30 | require('dotenv').config({ path: require('path').join(__d... |
| full-sync-productos.js | GHOST | 4.6 KB | 2026-03-30 | Full productos sync — plain INSERT, no unique key | iFoli... |
| generate-invoice.js | GHOST | 6.2 KB | 2026-04-05 | CRUZ Invoice Generator — auto-bills completed tráficos | ... |
| generate-monthly-report.js | GHOST | 9.0 KB | 2026-04-05 | CRUZ Monthly Client Report Generator | Generates PDF repo... |
| generate-notifications.js | GHOST | 3.6 KB | 2026-04-05 | CRUZ Notification Generator — creates notifications from ... |
| good-news-detector.js | GHOST | 8.6 KB | 2026-04-07 | scripts/good-news-detector.js | CRUZ Good News Detector |... |
| ground-truth.js | GHOST | 2.0 KB | 2026-04-08 | require('dotenv').config({ path: require('path').join(__d... |
| intelligence-summary.js | GHOST | 1.8 KB | 2026-03-30 | require('dotenv').config({ path: '.env.local' }) | const ... |
| inventory-oracle.js | GHOST | 14.0 KB | 2026-04-07 | CRUZ Inventory Oracle — predict stockouts from import his... |
| inventory-statuses.js | GHOST | 1.4 KB | 2026-04-08 | require('dotenv').config({ path: require('path').join(__d... |
| karpathy-loop-trainer.js | GHOST | 12.3 KB | 2026-04-10 | V2-B: Karpathy Loop Trainer | Reads operator_actions + ag... |
| lib/bootcamp.js | GHOST | 7.3 KB | 2026-04-06 | scripts/lib/bootcamp.js | Shared infrastructure for CRUZ ... |
| lib/document-types.js | GHOST | 5.3 KB | 2026-04-08 | CRUZ Document Type Registry | Canonical document types fo... |
| lib/email-auto-reply.js | GHOST | 4.7 KB | 2026-04-07 | scripts/lib/email-auto-reply.js | CRUZ Auto-Reply — Spani... |
| lib/email-send.js | GHOST | 1.4 KB | 2026-04-08 | scripts/lib/email-send.js | Shared Resend email sender fo... |
| lib/email-templates.js | GHOST | 9.2 KB | 2026-04-05 | scripts/lib/email-templates.js | Professional Spanish ema... |
| lib/ghost-pipeline.js | GHOST | 23.4 KB | 2026-04-08 | scripts/lib/ghost-pipeline.js | CRUZ Ghost Pedimento Pipe... |
| lib/job-runner.js | GHOST | 2.3 KB | 2026-04-10 | ADUANA Job Runner — heartbeat wrapper for all scripts. | ... |
| lib/llm.js | GHOST | 4.1 KB | 2026-04-08 | scripts/lib/llm.js | CRUZ unified LLM abstraction layer. ... |
| lib/notification-batcher.js | GHOST | 3.1 KB | 2026-04-07 | CRUZ Notification Batcher | Accumulates review items and ... |
| lib/paginate.js | GHOST | 893 B | 2026-04-07 | scripts/lib/paginate.js | Shared pagination helper — Supa... |
| lib/push-sender.js | GHOST | 2.8 KB | 2026-04-07 | scripts/lib/push-sender.js | Web Push Notification Sender... |
| lib/rates.js | GHOST | 2.9 KB | 2026-04-07 | scripts/lib/rates.js | Shared rate functions — single sou... |
| lib/sandbox-engine.js | GHOST | 16.2 KB | 2026-04-06 | scripts/lib/sandbox-engine.js | CRUZ Intelligence Bootcam... |
| lib/telegram.js | GHOST | 796 B | 2026-04-07 | scripts/lib/telegram.js — single source of truth for Tele... |
| lib/workflow-emitter.js | GHOST | 6.1 KB | 2026-04-08 | scripts/lib/workflow-emitter.js | CRUZ 2.0 — Workflow Eve... |
| link-orphan-entradas.js | GHOST | 3.7 KB | 2026-04-07 | CRUZ — Link Orphan Entradas to Traficos | Finds entradas ... |
| morning-briefing-push.js | GHOST | 3.8 KB | 2026-04-07 | scripts/morning-briefing-push.js | CRUZ Morning Briefing ... |
| nearshoring-report.js | GHOST | 5.8 KB | 2026-04-07 | CRUZ — Nearshoring Intelligence Report (BUILD 158) | Anal... |
| operation-simulator.js | GHOST | 3.7 KB | 2026-04-07 | CRUZ Operation Simulator — predict before acting | Called... |
| otro-diagnosis.js | GHOST | 3.3 KB | 2026-04-02 | require('dotenv').config({ path: '.env.local' }); | const... |
| pattern-intelligence.js | GHOST | 7.8 KB | 2026-04-07 | CRUZ Pattern Intelligence — the data network effect | Ana... |
| pedimento-prefiller.js | GHOST | 17.1 KB | 2026-04-07 | CRUZ Pedimento Pre-filler — Build 211 | When a tráfico's ... |
| pedimento-validator.js | GHOST | 9.7 KB | 2026-04-05 | CRUZ Pedimento Validator — 25 checks before SAT transmiss... |
| pipeline-health.js | GHOST | 7.0 KB | 2026-04-05 | CRUZ Pipeline Health Monitor | Checks every cron job's la... |
| pipeline-postmortem.js | GHOST | 9.5 KB | 2026-04-01 | CRUZ Pipeline Postmortem | Runs at 2 AM daily. | No AI ne... |
| po-matcher.js | GHOST | 11.7 KB | 2026-04-07 | CRUZ PO Matcher — matches incoming POs against prediction... |
| po-predictor.js | GHOST | 19.9 KB | 2026-04-07 | CRUZ PO Predictor — predict WHAT is coming, not just WHEN... |
| populate-entrada-lifecycle.js | GHOST | 1.7 KB | 2026-04-01 | require('dotenv').config({ path: '.env.local' }) | const ... |
| portal-smoke-test.js | GHOST | 7.0 KB | 2026-04-05 | CRUZ Portal Smoke Test — hits every critical API route | ... |
| predict-documents.js | GHOST | 6.2 KB | 2026-04-05 | CRUZ Document Predictor — anticipate before asking | For ... |
| prediction-accuracy.js | GHOST | 5.0 KB | 2026-03-30 | scripts/feedback-loop.js — Prediction accuracy tracker | ... |
| proactive-alerts.js | GHOST | 1.7 KB | 2026-04-10 | ADUANA Proactive Alerts — checks for problems BEFORE they... |
| product-dedup.js | GHOST | 13.1 KB | 2026-03-30 | scripts/product-dedup.js — BUILD 3 PHASE 2 | Product Dedu... |
| profitability-xray.js | GHOST | 8.8 KB | 2026-04-07 | CRUZ Profitability X-Ray — true profit per client | For e... |
| query-audit-final.js | GHOST | 16.9 KB | 2026-04-07 | Final audit data query for EVCO — Mar 23-27 and Mar 30-Ap... |
| query-audit-weeks-v2.js | GHOST | 13.6 KB | 2026-04-07 | Query EVCO audit data for two weeks — corrected column na... |
| query-audit-weeks.js | GHOST | 14.3 KB | 2026-04-07 | Query data for two weekly audit reports (March 23-27 and ... |
| queue-optimizer.js | GHOST | 5.2 KB | 2026-04-05 | CRUZ Queue Optimizer — smart processing order for tráfico... |
| qwen-extract.js | GHOST | 1.1 KB | 2026-03-27 | const OLLAMA_URL = 'http://localhost:11434/api/generate' ... |
| realtime-tracker.js | GHOST | 4.8 KB | 2026-04-05 | CRUZ Realtime Tracker — polls GlobalPC for active tráfico... |
| reclassify-otros.js | GHOST | 2.6 KB | 2026-04-02 | require('dotenv').config({ path: require('path').join(__d... |
| reclassify-pass2.js | GHOST | 1.9 KB | 2026-04-02 | require('dotenv').config({ path: require('path').join(__d... |
| rectificacion-scanner.js | GHOST | 15.8 KB | 2026-04-07 | scripts/rectificacion-scanner.js — BUILD 3 PHASE 6 | Rect... |
| regulatory-feed.js | GHOST | 5.5 KB | 2026-04-05 | CRUZ Regulatory Feed — monitors DOF, SAT, CBP for changes... |
| retag-evco-contamination.js | GHOST | 6.4 KB | 2026-04-08 | require('dotenv').config({ path: require('path').join(__d... |
| retention-intelligence.js | GHOST | 6.9 KB | 2026-04-05 | CRUZ Retention Intelligence — detect churn before it happ... |
| risk-feed.js | GHOST | 6.9 KB | 2026-04-02 | CRUZ Risk Feed | Hourly cron — detects risk escalations i... |
| risk-scorer.js | GHOST | 9.1 KB | 2026-04-01 | CRUZ Risk Scorer | No AI needed — pure logic from trafico... |
| sample-agent-decisions.js | GHOST | 703 B | 2026-04-08 | require('dotenv').config({ path: require('path').join(__d... |
| saturday-verify.js | GHOST | 9.6 KB | 2026-04-08 | CRUZ Saturday Verification — 7 deferred smoke tests. | Ru... |
| seed-operators.js | GHOST | 1.9 KB | 2026-04-08 | Seed the operators table with known CRUZ team members. | ... |
| seed-tariff-rates.js | GHOST | 10.6 KB | 2026-04-07 | CRUZ Seed Tariff Rates | Derives effective IGI rates per ... |
| self-improvement-loop.js | GHOST | 8.6 KB | 2026-04-05 | CRUZ Self-Improvement Loop — the Karpathy flywheel | Anal... |
| shadow-analysis.js | GHOST | 1.5 KB | 2026-04-02 | require('dotenv').config({ path: require('path').resolve(... |
| shadow-weekly-report.js | GHOST | 5.1 KB | 2026-04-05 | CRUZ Shadow Weekly Report | Queries shadow_classification... |
| solicit-missing-docs.js | GHOST | 13.9 KB | 2026-04-07 | CRUZ — Automated Document Solicitation Draft Generator | ... |
| solicitud-email.js | GHOST | 9.8 KB | 2026-04-02 | CRUZ SOLICIT Pipeline — Step 4 | Finds pending documento_... |
| solicitud-escalation.js | GHOST | 2.2 KB | 2026-03-31 | require('dotenv').config({ path: require('path').join(__d... |
| status-watcher.js | GHOST | 11.4 KB | 2026-04-07 | CRUZ Status Watcher | Polls traficos for status changes a... |
| supplier-negotiator.js | GHOST | 11.2 KB | 2026-04-07 | CRUZ Supplier Negotiator — generate negotiation briefs wi... |
| supplier-network-scorer.js | GHOST | 6.0 KB | 2026-04-07 | CRUZ Supplier Network Scorer | Aggregates supplier perfor... |
| supply-chain-orchestrator.js | GHOST | 7.6 KB | 2026-04-07 | CRUZ Supply Chain Orchestrator — clear before arrival | P... |
| sync-entradas-linkage.js | GHOST | 12.0 KB | 2026-04-06 | scripts/sync-entradas-linkage.js | CRUZ Entradas Linkage ... |
| tariff-monitor.js | GHOST | 4.7 KB | 2026-04-07 | CRUZ — Tariff Change Monitor | Monitors for tariff rate c... |
| test-notification.js | GHOST | 2.2 KB | 2026-03-31 | scripts/test-notification.js | Inserts a test notificatio... |
| test-signup-mode.js | GHOST | 1.1 KB | 2026-04-08 | scripts/test-signup-mode.js | Verify getSignupMode() JSON... |
| tier-classifiable.js | GHOST | 3.5 KB | 2026-04-07 | CRUZ — Tier classifiable products by AI-classification su... |
| tmec-scanner.js | GHOST | 1.8 KB | 2026-04-02 | require('dotenv').config({ path: '.env.local' }) | const ... |
| todays-errors.js | GHOST | 1.3 KB | 2026-04-02 | const { execSync } = require('child_process') | const tod... |
| validate-clients.js | GHOST | 2.0 KB | 2026-04-07 | require('dotenv').config({ path: require('path').join(__d... |
| value-anomaly-detector.js | GHOST | 11.1 KB | 2026-03-30 | scripts/value-anomaly-detector.js — BUILD 3 PHASE 5 | Val... |
| verify-karpathy.js | GHOST | 3.3 KB | 2026-04-10 | V2-B: Karpathy Loop Trainer — Verification Script | Check... |
| verify-telemetry.js | GHOST | 2.5 KB | 2026-04-10 | V2-A Telemetry Verification Script | require('dotenv').co... |
| vucem-mv-generator.js | GHOST | 1.7 KB | 2026-04-10 | ADUANA VUCEM MV Generator — generates Manifestación de Va... |
| watchdog.js | GHOST | 1.5 KB | 2026-04-10 | ADUANA Watchdog — checks critical jobs have heartbeated w... |
| weekly_audit_fixed.js | GHOST | 33.1 KB | 2026-03-29 | ═════════════════════════════════════════════════════════... |
| weekly-digest.js | GHOST | 7.4 KB | 2026-04-07 | CRUZ — Weekly Digest Email | Generates and sends a weekly... |
| weekly-summary.js | GHOST | 4.9 KB | 2026-04-07 | CRUZ Weekly Performance Summary | Aggregates the week's d... |
| wsdl-diagnostic-v2.js | GHOST | 7.2 KB | 2026-03-30 | CRUZ WSDL Diagnostic v2 | Deep investigation: what does e... |
| wsdl-diagnostic.js | GHOST | 6.8 KB | 2026-03-30 | CRUZ WSDL Diagnostic | Tests getListaDocumentosTrafico ag... |
| wsdl-pull-missing.js | GHOST | 9.9 KB | 2026-04-05 | WSDL Document Pull — TARGETED for missing EVCO tráficos o... |
| zero-touch-demo.js | GHOST | 24.7 KB | 2026-04-06 | CRUZ Zero-Touch Demo — del correo al despacho, sin humano... |
| zero-touch-pipeline.js | GHOST | 7.0 KB | 2026-04-06 | CRUZ Zero-Touch Pipeline — shipments that clear themselve... |
| ghost-trafico-detector.js | ARCHIVED | 7.8 KB | 2026-04-07 | CRUZ Ghost Tráfico Detector — cross-client fraud detectio... |

### Summary

- **Total:** 291
- **PM2:** 6
- **Crontab:** 33
- **NPM Scripts:** 77
- **Ghost:** 174
- **Archived:** 1

## Section 6 — Workflow Handler State

| Handler Key | Class | Fired (7d) |
|---|---|---|
| intake.email_processed | STUB | 9 |
| intake.document_attached | STUB | 0 |
| classify.product_needs_classification | REAL | 20 |
| classify.classification_complete | REAL | 204 |
| classify.needs_human_review | STUB | 119 |
| docs.document_received | REAL | 79 |
| docs.completeness_check | REAL | 79 |
| docs.expediente_complete | REAL | 0 |
| docs.solicitation_needed | REAL | 0 |
| docs.solicitation_sent | STUB | 0 |
| pedimento.expediente_complete | REAL | 0 |
| pedimento.duties_calculated | REAL | 203 |
| pedimento.ready_for_approval | STUB | 0 |
| pedimento.approved | REAL | 0 |
| crossing.pedimento_paid | REAL | 0 |
| crossing.dispatch_ready | STUB | 0 |
| crossing.crossing_complete | REAL | 0 |
| post_op.crossing_complete | REAL | 0 |
| post_op.operation_scored | STUB | 0 |
| invoice.operation_accumulated | STUB | 0 |
| invoice.invoice_ready | STUB | 0 |

### Summary

- Total handlers: 21
- REAL: 12
- STUB: 9
- TODO: 0

### Chain Gaps (no handler registered)

- `classify.undefined`
- `docs.undefined`
- `pedimento.undefined`
- `docs.undefined`
- `pedimento.undefined`
- `docs.undefined`
- `crossing.undefined`
- `post_op.undefined`
- `invoice.undefined`
- `docs.undefined`

## Section 7 — AI Cost and Classification State

### API Cost

| Period | Cost (USD) | Calls |
|---|---|---|
| Last 24h | $0.2200 | 82 |
| Last 7 days | $1.8974 | 1000 |
| Last 30 days | $1.0640 | 1000 |
| All-time | $1.0640 | 1000 |

**Top 5 most expensive calls (7d):**

| Cost | Model | Action | Timestamp |
|---|---|---|---|
| $0.0000 | claude-haiku-4-5-20251001 | bootcamp_email_classification | 2026-04-06T19:23:12.012576+00:00 |
| $0.0000 | claude-haiku-4-5-20251001 | bootcamp_email_classification | 2026-04-06T19:23:28.320924+00:00 |
| $0.0000 | claude-haiku-4-5-20251001 | bootcamp_email_classification | 2026-04-06T19:23:58.407751+00:00 |
| $0.0000 | claude-haiku-4-5-20251001 | bootcamp_email_classification | 2026-04-06T19:24:40.880821+00:00 |
| $0.0000 | claude-haiku-4-5-20251001 | bootcamp_email_classification | 2026-04-06T19:22:53.92249+00:00 |

### AI Classifications Today

- Classifications written today: 4

**Top 5 suppliers by classification count today:**

| Supplier | Count |
|---|---|
| PRV_566 | 1 |
| PRV_GENERICO_PR | 1 |
| PRV_572 | 1 |
| PRV_237 | 1 |

## Section 8 — Recent Failures and Silent Errors

### Workflow Failures

| Metric | Count |
|---|---|
| Failed (24h) | 0 |
| Dead letter (all time) | 0 |
| Stuck (pending > 1h) | 101178 |

**Stuck events (pending > 1h):**

| ID | Type | Created At |
|---|---|---|
| 6ad3cfaf-4b76-4df2-999f-b4213dbcf7ea | intake.entrada_synced | 2026-04-10T20:31:18.450992+00:00 |
| 6b01e6ee-b1bd-43bf-b8a5-9535eee37b5e | intake.entrada_synced | 2026-04-10T20:31:18.351595+00:00 |
| ab0f01ce-a195-4434-bf2b-3e39599f5bfc | intake.entrada_synced | 2026-04-10T20:31:18.250537+00:00 |
| ff334b8d-cb43-483c-b941-9eebb675b5d1 | intake.entrada_synced | 2026-04-10T20:31:18.144009+00:00 |
| fbbc5ff0-c796-4e52-8ea8-63b611768bd2 | intake.entrada_synced | 2026-04-10T20:31:18.043737+00:00 |

### Job Run Failures

- Failed jobs (24h): 0
- Stale running jobs (started > 1h ago): 0

### PM2 Error Logs (last 5 lines each)

**cruz-bot:**
```
[31m0|cruz-bot | [39m❌ TELEGRAM_BOT_TOKEN not found in .env.local
[31m0|cruz-bot | [39m❌ TELEGRAM_BOT_TOKEN not found in .env.local
[31m0|cruz-bot | [39m❌ TELEGRAM_BOT_TOKEN not found in .env.local
[31m0|cruz-bot | [39m❌ TELEGRAM_BOT_TOKEN not found in .env.local
[31m0|cruz-bot | [39m❌ TELEGRAM_BOT_TOKEN not found in .env.local
```

**fold-agent:**
```
[1m[90m[TAILING] Tailing last 5 lines for [fold-agent] process (change the value with --lines option)[39m[22m
[90m/Users/renatozapataandcompany/.pm2/logs/fold-agent-error.log last 5 lines:[39m
```

**workflow-processor:**
```
[31m4|workflow | [39m[workflow-emitter] Failed to fetch pending events: canceling statement due to statement timeout
[31m4|workflow | [39m[workflow-emitter] Failed to fetch pending events: canceling statement due to statement timeout
[31m4|workflow | [39m[workflow-emitter] Failed to fetch pending events: canceling statement due to statement timeout
[31m4|workflow | [39m[workflow-emitter] Failed to fetch pending events: canceling statement due to statement timeout
[31m4|workflow | [39m[workflow-emitter] Failed to fetch pending events: canceling statement due to statement timeout
```

**cruz-crossing:**
```
[1m[90m[TAILING] Tailing last 5 lines for [cruz-crossing] process (change the value with --lines option)[39m[22m
[90m/Users/renatozapataandcompany/.pm2/logs/cruz-crossing-error.log last 5 lines:[39m
```

**cruz-closeout:**
```
[31m6|cruz-clo | [39mFatal: Closeout query: column traficos.moneda does not exist
[31m6|cruz-clo | [39mFatal: Closeout query: column traficos.moneda does not exist
[31m6|cruz-clo | [39mFatal: Closeout query: column traficos.moneda does not exist
[31m6|cruz-clo | [39mFatal: Closeout query: column traficos.moneda does not exist
[31m6|cruz-clo | [39mFatal: Closeout query: column traficos.moneda does not exist
```

**cruz-touch-monitor:**
```
[1m[90m[TAILING] Tailing last 5 lines for [cruz-touch-monitor] process (change the value with --lines option)[39m[22m
[90m/Users/renatozapataandcompany/.pm2/logs/cruz-touch-monitor-error.log last 5 lines:[39m
```

**clearance-sandbox:**
```
[1m[90m[TAILING] Tailing last 5 lines for [clearance-sandbox] process (change the value with --lines option)[39m[22m
[90m/tmp/clearance-sandbox-error.log last 5 lines:[39m
```

**wsdl-document-pull:**
```
[1m[90m[TAILING] Tailing last 5 lines for [wsdl-document-pull] process (change the value with --lines option)[39m[22m
[90m/Users/renatozapataandcompany/.pm2/logs/wsdl-document-pull-error.log last 5 lines:[39m
```


### Uncommitted Files

28 uncommitted file(s):

```
M ecosystem.config.js
 D scripts/.sync-checkpoints/wsdl_docs_dist-parra.json
 M scripts/heartbeat-state.json
 M src/app/api/cruz-ai/ask/route.ts
 M src/app/layout.tsx
 M src/components/client/ClientHome.tsx
 M src/components/cruz-chat-bubble.tsx
 M src/components/layout/search-bar.tsx
 M src/components/trafico-detail.tsx
 M src/lib/csrf.ts
?? docs/CRUZ_CONTEXT_2026-04-07.md
?? docs/CRUZ_CONTEXT_2026-04-10.md
?? docs/PROMPT_B_HANDLER_SPRINT.md
?? docs/v2a-integration-instructions.md
?? docs/v2c-batch-reports/
?? output/
?? scripts/audit-system-state.js
?? scripts/karpathy-loop-trainer.js
?? scripts/v2c-managed-agent/
?? scripts/verify-karpathy.js
?? scripts/verify-telemetry.js
?? src/app/api/telemetry/
?? src/components/TelemetryProvider.tsx
?? src/lib/telemetry.ts
?? supabase/migrations/20260410120000_v2a_interaction_events.sql
?? supabase/migrations/20260410130000_v2b_proposed_automations.sql
?? supabase/migrations/20260410140000_v2d_p1_timeout_fix.sql
?? supabase/migrations/20260410_ensure_evco_company.sql
```

## Section 9 — Diff from Previous Run

(first run, no diff available)
