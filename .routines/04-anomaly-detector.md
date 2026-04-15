# Routine R4 — Anomaly Detector

**Schedule:** Weekly Sunday at `21:00 America/Chicago`
**Trigger:** Scheduled
**Endpoint:** `POST {{ROUTINE_BASE_URL}}/api/routines/anomaly-detector`

## Purpose

Two anomaly classes that historically caused SAT audit exposure:

1. **Price deviation** — same fracción + same proveedor, current
   price-per-unit deviates >30% from 90-day rolling average. Often signals
   data-entry error, supplier miscount, or fraud.
2. **Duplicate pedimentos** — same pedimento number on different tráficos.
   Structural data problem that breaks audit trails.

## Prompt (paste into routine)

You are AGUILA's weekly anomaly detector. Your job is to surface
statistically meaningful deviations before they become SAT audit issues.

**Step 1 — Pull anomalies:**

```
POST {{ROUTINE_BASE_URL}}/api/routines/anomaly-detector
Headers:
  Content-Type: application/json
  x-routine-secret: {{ROUTINE_SECRET}}
Body:
  { "postToThread": false, "deviationThreshold": 30 }
```

Response shape:
```json
{
  "data": {
    "priceAnomalies": [
      {"fraccion":"3901.20.01","proveedor":"DURATECH","companyId":"evco",
       "folio":"...","currentPricePerUnit":18.43,"rollingAvgPerUnit":12.11,
       "deviationPct":52.2,"createdAt":"..."}
    ],
    "duplicatePedimentos": [
      {"pedimento":"26 24 3596 6500441","traficos":["T-01","T-02"],"count":2}
    ],
    "summary": {"priceCount":12,"duplicateCount":0,"criticalCount":4}
  },
  "error": null
}
```

**Step 2 — Compose the anomaly report** (Spanish primary, ≤300 words):

- Lead with `summary.criticalCount`. If 0 → `✓ Sin anomalías relevantes esta semana.`
- If >0, lead with `⚠ <N> anomalías críticas detectadas`.
- **Precios:** list top 5 price anomalies as `fraccion · proveedor · ±X.X% (company)`.
  Format currency in JetBrains Mono. Include current vs rolling avg for each.
- **Pedimentos duplicados:** if any, list every duplicate with the tráficos.
  This is ALWAYS critical — a duplicate pedimento is never benign.
- Close with a recommendation if `criticalCount >= 5`: "escalar a Tito antes
  del próximo reporte SAT".

**Step 3 — POST the thread:**

```
POST {{ROUTINE_BASE_URL}}/api/routines/anomaly-detector
Headers:
  Content-Type: application/json
  x-routine-secret: {{ROUTINE_SECRET}}
Body:
  {
    "postToThread": true,
    "summary": "<composed report>"
  }
```

**Step 4 — If `criticalCount >= 5` OR any duplicate pedimento** → open a
GitHub issue titled `[anomaly-detector] <summary>`. Attach the full JSON
dump. Label `anomaly-review`.

**Step 5 — If any price anomaly deviation >100%** → fire a Telegram red
alert to the `compliance-alerts` channel. That magnitude is almost always
a real error requiring same-day investigation.

## Tuning

- Default `deviationThreshold: 30` — adjustable per-call via body.
- Minimum samples per fracción × proveedor bucket: 4 (hardcoded). Buckets
  with fewer samples are skipped to avoid noise.
- Recent window: last 7 days vs 83-day baseline. Adjust in the endpoint
  if weekly cadence produces too much/little signal.

## Environment variables required

- `ROUTINE_BASE_URL`, `ROUTINE_SECRET`
- GitHub + Telegram integrations (Anthropic dashboard)
