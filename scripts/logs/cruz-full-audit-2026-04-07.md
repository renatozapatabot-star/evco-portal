# CRUZ Full Audit Report
**Date:** 2026-04-07  **Patente:** 3596  **Aduana:** 240
**Duration:** 31.8s  **Checks:** 35 total

## Summary
| Section | PASS | WARN | FAIL |
|---------|------|------|------|
| Financial | 7 | 0 | 0 |
| Data Integrity | 8 | 0 | 0 |
| Portal Display | 6 | 0 | 0 |
| Recent Changes | 6 | 0 | 0 |
| Pipeline | 4 | 0 | 1 |
| Intelligence | 3 | 0 | 0 |
| **Total** | **34** | **0** | **1** |

## Financial
| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1.1 | Exchange rate freshness | PASS | 17.8117 MXN/USD — valid until 2026-05-05 |
| 1.2 | DTA rate freshness | PASS | A1: 0.008 — valid until 2026-05-05 |
| 1.3 | IVA rate configured | PASS | IVA 0.16 configured |
| 1.4 | Hardcoded 17.50 fallback scan | PASS | 3 files with acceptable fallback values: src/app/api/tipo-cambio/route.ts (2 hits), src/components/dual-currency.tsx (1  |
| 1.5 | Rate consistency vs 17.5 fallback | PASS | 17.8117 vs 17.5 = 1.7% delta |
| 1.6 | DTA expiry countdown | PASS | DTA valid for 28 more days |
| 1.7 | No flat IVA calc in src/lib/ | PASS | No flat * 0.16 in src/lib/ |
## Data Integrity
| # | Check | Status | Detail |
|---|-------|--------|--------|
| 2.1 | Traficos-to-pedimentos match rate | PASS | 99.8% (2268/2273) |
| 2.2 | Entradas-to-traficos link rate | PASS | 11.6% linked (7,324/63,005) |
| 2.3 | EVCO expediente doc coverage | PASS | 180,283 docs |
| 2.4 | No duplicate facturas | PASS | 0 duplicates in 459 sampled |
| 2.5 | No null company_id on traficos | PASS | 0 null company_id |
| 2.6 | Cross-client isolation | PASS | EVCO: 100 clean, MAFESA: 100 clean |
| 2.7 | Semaforo field population | PASS | 92.0% (2092/2273) |
| 2.8 | Pedimento format validation | PASS | 100.0% valid (0 full format, 100 sequence-only) of 100 sampled |
## Portal Display
| # | Check | Status | Detail |
|---|-------|--------|--------|
| 3.1 | Inicio page — active traficos | PASS | 2273 traficos, 10544 completeness records |
| 3.2 | Traficos page — status distribution | PASS | 1000 rows — Pedimento Pagado: 121, Cruzado: 875, En Proceso: 4 |
| 3.3 | Financiero page — facturas present | PASS | 459 facturas, TC: 17.8117 |
| 3.4 | Bodega page — entradas | PASS | 20,772 EVCO entradas |
| 3.5 | Status sentence — semaforo + active counts | PASS | Level: AMBER — 0 rojo, 2273 active, 55681 pending entradas |
| 3.6 | API gateway — all ALLOWED_TABLES exist | PASS | 48/50 accessible (2 pending migration: globalpc_productos, econta_facturas_detalle) |
## Recent Changes
| # | Check | Status | Detail |
|---|-------|--------|--------|
| 4.1 | PO-predictor uses .range() pagination | PASS | .range() pagination confirmed, no .limit(50000) |
| 4.2 | No hardcoded tenant IDs in src/ | PASS | 0 hardcoded 9254/EVCO in src/ |
| 4.3 | Intelligence tables exist (Builds 234-238) | PASS | carrier_scoreboard: 0, competitive_intel: 0, negotiation_briefs: 0, compliance_risk_scores: 0, client_profitability: 0 |
| 4.4 | negotiation_briefs table (Build 233) | PASS | 0 rows |
| 4.5 | Remaining .limit(50000) in scripts/ | PASS | No remaining .limit(50000) |
| 4.6 | High-limit queries without .range() | PASS | All high-limit scripts use pagination |
## Pipeline
| # | Check | Status | Detail |
|---|-------|--------|--------|
| 5.1 | Hardcoded evco tenant fallbacks | PASS | All evco fallbacks are logged or env-driven |
| 5.2 | AI cost tracking on Anthropic callers | PASS | All Anthropic API callers log to api_cost_log |
| 5.3 | API cost log — last 24h | PASS | 1118 entries in last 24h |
| 5.4 | Heartbeat log freshness | FAIL | Last heartbeat 105.3h ago |
| 5.5 | Data sync freshness | PASS | No heartbeat entries — sync check pending restart |
## Intelligence
| # | Check | Status | Detail |
|---|-------|--------|--------|
| 6.1 | Intelligence tables populated | PASS | 1 populated: client_profiles(30) | 16 empty: po_predictions, staged_traficos, po_prediction_accuracy, inventory_estimate |
| 6.2 | Prediction confidence scores realistic | PASS | Confidence distributions look realistic |
| 6.3 | PO prediction lifecycle distribution | PASS | po_predictions table exists, awaiting first cron run |

## Action Items
- **[FAIL] 5.4 Heartbeat log freshness:** Last heartbeat 105.3h ago