# CRUZ PILOT RUNBOOK — EVCO First Shipment

## PRE-FLIGHT CHECKLIST

| # | Verify | Command | Expected | OK |
|---|--------|---------|----------|----|
| 1 | PM2 alive | `pm2 list` | 8+ online | __ |
| 2 | Rates fresh | `node -e "require('./scripts/lib/rates').getAllRates().then(r=>console.log(r))"` | valid_to > today | __ |
| 3 | Telegram bot | `/status` to bot | Response with counts | __ |
| 4 | Portal login | evco-portal.vercel.app evco2026 | Dashboard < 3s | __ |
| 5 | Gmail dry-run | `node scripts/email-intake.js --dry-run` | Draft created + TG msg | __ |
| 6 | Shadow test | 3 historical EVCO invoices | IVA matches filed peds | __ |
| 7 | Approval test | Tito taps /aprobar on test | 5-4-3-2-1 works | __ |
| 8 | Credentials | All rotated per checklist | New keys on Vercel | __ |
| 9 | IGI=0 audit | Check approved_drafts | Zero affected | __ |
| 10 | Ursula ready | PO#, supplier, ship date | Confirmed | __ |

## STAGE EXECUTION

### STAGE 1: INTAKE (Build 1)
- **CRUZ:** Receives email at ai@renatozapata.com, parses PDF, creates draft, auto-replies in Spanish
- **Touch:** NONE | **Duration:** < 60 seconds
- **Success:** Telegram "Borrador listo" | **Failure:** No TG in 5 min -> `pm2 logs email-intake`
- **Owner:** Renato IV | **Escalation:** 10 min -> forward to Juan Jose manually

### STAGE 2: DOCUMENTS (Build 2)
- **CRUZ:** Checks docs, drafts missing-doc request, sends to Telegram
- **Touch:** TITO approves request (1/5) | **Duration:** < 5 min
- **Success:** TG with Aprobar/Rechazar | **Failure:** No TG in 15 min -> Eloisa sends manually
- **Owner:** Renato IV

### STAGE 3: PEDIMENTO (Build 3)
- **CRUZ:** Pre-fills pedimento with live rates, calculates DTA/IGI/IVA, posts to Telegram
- **Touch:** TITO approves draft (2/5) | **Duration:** < 30 min after docs complete
- **Success:** TG with full breakdown | **Failure:** Wrong numbers -> DO NOT APPROVE -> call Renato IV
- **Owner:** Renato IV | **Escalation:** Juan Jose fills manually in GlobalPC

### STAGE 4: CROSSING (Build 6)
- **CRUZ:** Monitors bridges, dispatches carrier, detects semaforo rojo
- **Touch:** TITO approves carrier dispatch (3/5) | **Duration:** Continuous until crossed
- **Success:** "Cruce completado" TG | **Failure:** Semaforo rojo -> Renato IV calls carrier
- **Owner:** Renato IV | **Escalation:** Carrier no-show 2h -> Arturo coordinates backup

### STAGE 5: DELIVERY (Build 7)
- **CRUZ:** Detects crossing, calculates savings, generates post-mortem
- **Touch:** WAREHOUSE confirms receipt (4/5) | **Duration:** < 30 min
- **Success:** Post-mortem TG | **Failure:** No close-out 1h -> run `node scripts/cruz-closeout.js`
- **Owner:** Renato IV

### STAGE 6: CLIENT SUMMARY (Build 7 + 4)
- **CRUZ:** Drafts savings email to Ursula
- **Touch:** TITO approves email (5/5) | **Duration:** < 15 min
- **Success:** Ursula receives email | **Failure:** Tito rejects -> edit in portal
- **Owner:** Renato IV

## TOUCH BUDGET: ___/5

| # | Who | Stage | What | Time |
|---|-----|-------|------|------|
| 1 | Tito | Docs | Approve doc request | __:__ |
| 2 | Tito | Ped | Approve pedimento | __:__ |
| 3 | Tito | Cross | Approve carrier | __:__ |
| 4 | Warehouse | Deliver | Confirm receipt | __:__ |
| 5 | Tito | Summary | Approve email | __:__ |
| **6 = FAIL** | | | **TRIGGER POST-MORTEM** | |

## LIVE TRACKING

| Stage | Start | End | Status | Touches | Notes |
|-------|-------|-----|--------|---------|-------|
| Intake | | | | /5 | |
| Documents | | | | /5 | |
| Pedimento | | | | /5 | |
| Crossing | | | | /5 | |
| Delivery | | | | /5 | |
| Summary | | | | /5 | |

## KILL SWITCH

```
pm2 kill && echo "CRUZ STOPPED"
```

1. Call Juan Jose — he takes manual control
2. Call Tito: "Paramos. Juan Jose tiene el control. Embarque sigue a tiempo."
3. If Ursula asks: "Ajuste interno. Su embarque sigue en tiempo."

**Authority: Renato IV or Tito ONLY.**

## POST-MORTEM

| Metric | Value |
|--------|-------|
| Total time | ___ days |
| Touches | ___/5 |
| Failures | ___ |
| Semaforo | Verde / Rojo |
| T-MEC savings | $___ USD |

**Success?** YES / NO — ________________________________________________
