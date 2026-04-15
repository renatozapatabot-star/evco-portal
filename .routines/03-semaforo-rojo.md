# Routine R3 — Semáforo Rojo Webhook

**Schedule:** Event-triggered (not scheduled)
**Trigger:** GlobalPC sync detects `semaforo === 'rojo'` on a newly-updated tráfico
**Endpoint:** `POST {{ROUTINE_BASE_URL}}/api/routines/semaforo-rojo`

## How the trigger fires

`scripts/globalpc-delta-sync.js` — the Throne nightly sync — checks each
tráfico's semáforo after update. When it sees a flip `verde → rojo` or a
fresh rojo on a new row, it POSTs to the routine's webhook URL (configured
in the Anthropic dashboard under "Incoming webhooks"). The routine then
calls back into AGUILA's endpoint with a composed message.

We do this two-step because the routine is where we use Claude to compose
the Spanish-language message; the sync script just fires the signal.

## Prompt (paste into routine)

You are AGUILA's semáforo-rojo handler. Triggered when GlobalPC sync
detects a tráfico flipping to semáforo rojo. Your job is to compose a
short, actionable alert and post it to the tráfico's Mensajería thread.

**Step 1 — Pull tráfico context** by calling the endpoint with just the
tráfico id and a placeholder message:

```
POST {{ROUTINE_BASE_URL}}/api/routines/semaforo-rojo
Headers:
  Content-Type: application/json
  x-routine-secret: {{ROUTINE_SECRET}}
Body:
  {
    "traficoId": "<from webhook trigger payload>",
    "message": "__context_lookup__"
  }
```

Wait — step 1 posts immediately and creates a thread. Better: if the
webhook trigger includes company_id + pedimento, skip step 1 and compose
directly. Otherwise the trigger should pre-fetch from a read-only lookup
endpoint (future: `/api/routines/trafico-context` — not yet built).

**For now**, use the data the webhook trigger sends directly. Compose a
message with:

- Line 1: `Semáforo rojo detectado en tráfico <trafico>. Pedimento <N> si existe.`
- Line 2: Reason if available (e.g., "MVE vence en 48h", "aduana requiere validación adicional").
- Line 3: Suggested next action, one sentence, imperative. Examples:
  - "Validar documentación antes de 17:00 hoy."
  - "Contactar al importador para confirmar factura."
- Line 4: `@<operator_name>` if the webhook payload includes `assigned_to_operator_id`,
  resolved to the operator's display name.

Spanish only. No emojis except the leading `🔴` is acceptable (it's semantic,
not decoration). ≤120 words total.

**Step 2 — POST the composed message:**

```
POST {{ROUTINE_BASE_URL}}/api/routines/semaforo-rojo
Headers:
  Content-Type: application/json
  x-routine-secret: {{ROUTINE_SECRET}}
Body:
  {
    "traficoId": "<id>",
    "message": "<your composed message>"
  }
```

Response includes `thread.id` — use `findOrCreateThreadByTrafico` under
the hood so calling twice for the same tráfico doesn't spam threads.

**Error handling:** If the trafico lookup 404s, log and exit. Don't create
a thread for a tráfico that doesn't exist — it probably means GlobalPC
has a stale reference. Fire a Telegram warning instead.

## Environment variables required

- `ROUTINE_BASE_URL`, `ROUTINE_SECRET`

## Follow-up scope (later routine)

Once this is running cleanly for two weeks, add:
- Auto-escalate to owner thread if operator doesn't respond within 2h
- Attach a chain view link (share token so operator can click through)
- Suggested next-action from historical resolution patterns (ML / memory)
