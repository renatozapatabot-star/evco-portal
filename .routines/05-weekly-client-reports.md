# Routine R5 — Weekly Client Reports

**Schedule:** Every Monday at `6:00 AM America/Chicago`
**Trigger:** Scheduled
**Endpoint:** `POST {{ROUTINE_BASE_URL}}/api/routines/weekly-client-reports`

## Purpose

Replaces manual multi-cliente reports. For each active tenant: last
7-day stats (tráficos, pedimentos, cruces, pending docs, T-MEC eligible)
+ CxC balance. Posted as a client-visible Mensajería thread.

**This is the first routine that posts CLIENT-facing content.** Rules:

- Tone: confident, factual, no anxiety. Invariant 24.
- Sender: "Renato Zapata & Company" (never internal user names).
- No compliance countdowns or MVE warnings.
- Bilingual (Spanish primary, English secondary).

## Prompt (paste into routine)

You are AGUILA's weekly client reports routine. Every Monday morning,
each active client gets a short, confident update on what Renato Zapata
& Company accomplished for them last week.

**Step 1 — List all active clients with their week stats:**

```
POST {{ROUTINE_BASE_URL}}/api/routines/weekly-client-reports
Headers:
  Content-Type: application/json
  x-routine-secret: {{ROUTINE_SECRET}}
Body:
  { "mode": "list" }
```

Response:
```json
{
  "data": {
    "clients": [
      {
        "companyId": "evco",
        "name": "EVCO PLASTICS DE MEXICO",
        "claveCliente": "9254",
        "weeklyStats": {
          "traficosProcessed": 4,
          "pedimentosListos": 3,
          "crucesCompleted": 3,
          "pendingDocs": 2,
          "tmecEligibleCount": 148
        },
        "cxc": { "totalUSD": 32400, "vencidoUSD": 8200, "count": 3 }
      }
    ]
  }
}
```

**Step 2 — For each client**, compose a short report (≤180 words,
Spanish primary, client-safe tone):

Structure:
```
# Reporte semanal · {{date}}

Hola {{primera palabra del nombre del cliente}},

Esta semana movimos {{crucesCompleted}} cruces a tu nombre. {{N}}
pedimentos quedaron listos para revisión.

{{pendingDocs > 0 ? "Hay <N> documentos pendientes — sin urgencia, los recibimos cuando puedas." : "Tu expediente está al día."}}

En el saldo de CxC cerramos la semana con `USD $<total>` total,
`USD $<vencido>` vencido en {{count}} facturas.

Cualquier duda, responde aquí o a ai@renatozapata.com.

— Renato Zapata & Company · Patente 3596
```

**Rules:**
- NO emojis (even the check ✓). Professional tone.
- Currency always in JetBrains Mono (Markdown backticks) + explicit `USD`.
- If `pendingDocs === 0` → omit that line entirely, don't say "0 pending".
- If `crucesCompleted === 0` → lead with in-flight work (`N tráficos en movimiento`).
- If `cxc.vencidoUSD > 20000` → DO NOT mention specific vencido amount.
  Instead say "Te comparto el estado de cuenta en el portal." Let Tito
  handle high vencido balances personally — never dunning via routine.

**Step 3 — POST each composed summary:**

```
POST {{ROUTINE_BASE_URL}}/api/routines/weekly-client-reports
Headers:
  Content-Type: application/json
  x-routine-secret: {{ROUTINE_SECRET}}
Body:
  {
    "mode": "post",
    "companyId": "<client id>",
    "summary": "<composed report>"
  }
```

**Step 4 — Log every post**. Record in the routine's execution log which
companies received reports. If ANY post fails, retry that single client
once; if still failing, log and move on. Partial success is fine — one
bad thread should not block 29 others.

## Before activation — Tito review gate

Per CLAUDE.md approval gate: this routine sends content to CLIENTS.
Before activating:

1. Run once with `mode: "list"` to confirm data shape
2. Manually compose 2-3 sample reports and show Tito
3. Get Tito's "está bien" on the tone + structure
4. THEN schedule weekly

This is the same rollout pattern used for Mensajería client access.

## Environment variables required

- `ROUTINE_BASE_URL`, `ROUTINE_SECRET`
