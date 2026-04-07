# CRUZ ROLLBACK PLAN — Read This at 3 AM

## FAILURE MATRIX

| Stage | Failure | Signal | Detection | Severity |
|-------|---------|--------|-----------|----------|
| **Intake** | Email parse null | No TG "Borrador listo" | < 5 min | Recoverable |
| | Scanned PDF (no text) | TG "needs_vision" | < 5 min | Recoverable |
| | Gmail token expired | TG "email-intake FAILED" | < 2 min | Manual takeover |
| **Documents** | doc_requirements empty | Falls back to hardcoded | Immediate | Recoverable |
| | Supplier email bounces | No Resend receipt | < 1 hour | Manual takeover |
| | Upload token expired | Supplier reports | When reported | Recoverable |
| **Pedimento** | Rates expired | TG "rates expired REFUSED" | Immediate | **BLOCKS** |
| | IVA wrong | Numbers mismatch | At Tito review | Manual takeover |
| | Fraccion wrong | Tito/JJ catches | At Tito review | Manual takeover |
| **Approval** | TG bot down | /aprobar no response | < 15 min | Manual takeover |
| | Double-tap | Duplicate approved | Immediate | **CRITICAL** |
| **Crossing** | CBP API down | Stale bridge data | < 30 min | Recoverable |
| | Carrier no-show | Status stuck "dispatched" | > 2 hours | Manual takeover |
| | Rojo undetected | No alert | Silent | **CRITICAL** |
| **Close-out** | Savings wrong | Numbers mismatch | At Tito review | Manual takeover |
| | Audit log fails | TG alert | < 2 min | **BLOCKS** |

## KILL SWITCH (< 60 seconds)

```bash
# 1. Stop PM2 (10s)
pm2 kill

# 2. Disable crontab (10s)
crontab -l > /tmp/cruz-crontab-backup.txt && crontab -r

# 3. Forward ai@ to Juan Jose (30s — Gmail settings)
```

**Recovery:**
```bash
crontab /tmp/cruz-crontab-backup.txt
pm2 resurrect
# Remove forwarding, verify: pm2 list + /status
```

## COMMUNICATION TREE

```
FAILURE
  |
  +-- 2 min: Renato IV -> Tito (TG)
  |   "Detectamos problema en [stage]. Juan Jose tiene el control."
  |
  +-- 5 min: Renato IV -> Juan Jose (phone)
  |   "Toma control manual de trafico [number]."
  |
  +-- 15 min (only if asked): Renato IV -> Ursula
  |   "Ajuste interno. Su embarque sigue en tiempo."
  |
  +-- DO NOT CALL: Arturo, Eloisa, supplier, carrier
```

## HARD-STOP (Cancel pilot, go 100% manual)

- Wrong pedimento number shown to Tito
- Wrong fraccion on any line item
- Wrong IVA calculation
- Ursula sees wrong status
- Audit log write failure
- Cross-client data exposure

## CLIENT TEMPLATES

**A (internal fix, Ursula didn't see):**
"Todo esta en orden con su embarque. Hicimos un ajuste interno para mejorar el proceso."

**B (visible intervention):**
"Tomamos control manual de su embarque para garantizar el despacho a tiempo. Juan Jose esta al pendiente y le confirma cuando cruce."

## RECOVERY CRITERIA (Before next shipment)

- Root cause documented
- Fix verified in shadow mode (3 historical shipments)
- Tito reviewed post-mortem and said "adelante"
- Ursula informed (honest summary)
