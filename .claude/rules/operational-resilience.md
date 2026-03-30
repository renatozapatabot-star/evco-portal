---
description: Operational resilience rules — ensuring CRUZ keeps running after it ships. Loads on all script and API files.
paths:
  - "scripts/**/*"
  - "src/app/api/**/*"
  - "src/lib/**/*"
---

# Operational Resilience Rules — CRUZ

These rules exist because the pipeline silently died for 10 days and nobody noticed.
They apply to every script, cron job, and API endpoint in the CRUZ infrastructure.

## 1. No Silent Failures

Every cron script must:
- Log run status to a Supabase table (`heartbeat_log`, `sync_log`, or equivalent)
- Send a Telegram alert on failure with script name + error message
- Send a success confirmation at defined intervals (not every run — daily summary)

If a script can fail silently, it will. And nobody will notice for 10 days.

```javascript
// REQUIRED pattern for every cron script
try {
  await runScript();
  await logToSupabase({ status: 'success', script: SCRIPT_NAME });
} catch (err) {
  await logToSupabase({ status: 'failed', script: SCRIPT_NAME, error: err.message });
  await sendTelegram(`🔴 ${SCRIPT_NAME} failed: ${err.message}`);
  process.exit(1); // Don't swallow — let pm2/cron know it failed
}
```

## 2. No Hardcoded Financial Values

Exchange rates, DTA rates, IVA rates — all come from `system_config` table.
Code that hardcodes a financial value is a SEV-1 bug.

```javascript
// WRONG
const exchangeRate = 17.49;

// RIGHT
const { rate: exchangeRate } = await getExchangeRate(); // from lib/rates.js
```

Verify: `grep -r "= 17\." scripts/` → 0 matches
Verify: `grep -r "= 0\.8\b\|= 0\.16\b\|= 408\b" scripts/` → 0 matches outside lib/rates.js

## 3. Every External API Call Has a Fallback

CBP, Banxico, Gmail, Anthropic — they all go down. The pipeline degrades gracefully.

Fallback hierarchy:
1. Live API response
2. Last known value from Supabase (with age annotation)
3. Historical average from Supabase
4. Graceful failure with Telegram alert — never a crash

If ALL external dependencies fail simultaneously → pipeline sends alert and stops.
It does NOT silently continue with stale/wrong data.

## 4. Cost Tracking on Every AI Call

Every Anthropic API call must log to `api_cost_log`:

```javascript
// REQUIRED wrapper — use this, never raw anthropic.messages.create in scripts
async function callWithCostTracking({ model, messages, action, clientCode }) {
  const start = Date.now();
  const response = await anthropic.messages.create({ model, messages, max_tokens: 1000 });
  await supabase.from('api_cost_log').insert({
    model,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cost_usd: calculateCost(model, response.usage),
    action,
    client_code: clientCode,
    latency_ms: Date.now() - start
  });
  return response;
}
```

Without cost tracking, you cannot price the service for client #2+.

## 5. Client Isolation by Auth, Never by Hardcode

Use `session.clientCode` (portal) or parameterized `company_id` (scripts).
Never filter by string literal `'9254'` or `'EVCO'` in production code paths.

```javascript
// WRONG — blocks multi-client
const { data } = await supabase.from('traficos').select('*').eq('clave_cliente', '9254');

// RIGHT — parameterized
const { data } = await supabase.from('traficos').select('*').eq('clave_cliente', clientCode);
```

Exception: seed scripts and one-time migrations targeting EVCO specifically.
Those must include a comment: `// EVCO-specific — not a multi-client pattern`.

## 6. Regression Guard After Every Sync

After every nightly sync, verify data quality didn't regress:
- Coverage % vs yesterday (alert if > 2% drop)
- Row count delta (alert if > 5% unexpected change)
- Unmatched expediente count (alert if increased)

This is automated by `regression-guard.js`. Don't skip it.
Don't delete entries from `regression_guard_log` — it's the trend baseline.
