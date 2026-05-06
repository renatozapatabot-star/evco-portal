# QA Suite

Programmatic verification of the production tenant-isolation contract,
anon-key denial, cookie-forgery refusal, and other request-time invariants
that today's manual audit caught but tomorrow's automation should catch.

This directory grows incrementally per the plan in
`~/Desktop/qa-suite-plan-2026-05-06.md`. Tonight's first probe is the
tenant-isolation fence — the one that would have caught the SEV-1 the
Saturday audit found.

## Probes (current)

| File | Purpose | Status |
|---|---|---|
| `01-tenant-isolation-probe.mjs` | Verify `/api/data` and other Bucket 3 routes return 403 + `Forbidden` body when a client session probes a foreign tenant via `?company_id=` / `?cve_cliente=` / `?clave_cliente=` | Active |

## Probes (planned — not authored tonight)

| File | Purpose | Source |
|---|---|---|
| `02-anon-read-probe.mjs` | Verify the public anon key cannot read any tenant-scoped table | QA plan B3 |
| `03-cookie-forgery-probe.mjs` | Verify forged `portal_session` cookies are rejected | QA plan B3 |
| `04-bearer-secret-probe.mjs` | Verify webhook + cron routes require valid Bearer/CRON_SECRET | QA plan B3 |
| `05-schema-integrity-probe.mjs` | Verify response shapes match exported Zod schemas | QA plan B3 |
| `06-rate-limit-probe.mjs` | Verify cost-sensitive routes rate-limit | QA plan B3 |

## Quick start

```bash
# Required env:
export BASE_URL=https://portal.renatozapata.com   # or a preview URL
export CLIENT_SESSION='<portal_session cookie value>'

# Optional (defaults shown):
export FOREIGN_TENANT_ID=mafesa     # tenant ID to use as the attacking-foreign value
export FOREIGN_CLAVE=4598           # clave to use as the attacking-foreign value
export ROUTE_FILTER=/api/data       # only probe routes whose path contains this
export DRY_RUN=1                    # build URLs without fetching (smoke test the suite)
export QUIET=1                      # suppress per-probe stdout

# Run all probes:
bash scripts/test/qa-suite/run-all.sh

# Run just the tenant-isolation probe:
node scripts/test/qa-suite/01-tenant-isolation-probe.mjs
```

## Capturing the CLIENT_SESSION cookie

1. Open `https://portal.renatozapata.com` (or the preview URL).
2. Log in as a client-role user (e.g. `evco2026`).
3. DevTools → Application → Cookies → `portal_session`.
4. Copy the value. Treat it as sensitive — do NOT commit it.

For CI: store the cookie in GitHub Actions secrets and inject as
`CLIENT_SESSION` env var. Rotate when it expires (HMAC sessions
typically expire after ~30 days).

## Output

Each probe writes a JSON report to `/tmp/qa-suite-results/`:

```
/tmp/qa-suite-results/2026-05-06-01-23-45-tenant-isolation.json
```

Report shape (per probe):

```json
{
  "run_id": "2026-05-06-01-23-45-tenant-isolation",
  "base_url": "https://portal.renatozapata.com",
  "started_at": "2026-05-06T01:23:45.123Z",
  "finished_at": "2026-05-06T01:23:48.456Z",
  "summary": { "total": 28, "passed": 28, "failed": 0 },
  "probes": [
    {
      "route": "/api/data",
      "attack_shape": "company_id=foreign_tenant",
      "expected_status": 403,
      "actual_status": 403,
      "passed": true
    }
  ]
}
```

Exit code 0 on all-pass, 1 on any failure.

## What this probe DOES NOT do tonight

- Run automatically on PR / deploy / cron. Wiring is deferred to Renato.
  Recommended attachments per QA plan B5:
  - Per-PR: GitHub Actions job, blocks merge on red
  - Post-deploy: hook auto-runs against the just-shipped URL
  - Hourly: production cron, Telegram on red
- Cover all 250 API routes — current probe targets 9 routes that accept
  `?company_id=` / `?cve_cliente=` / `?clave_cliente=`. Bucket 2 default-
  scoping coverage will expand in a follow-up commit.
- Write to or trigger any side effects against production. Pure GET
  requests; the production fence's `audit_log` insert (a side effect of
  hitting a 403 path) is intentional and the QA fixture user should be
  filterable from `audit_log` queries.

## First-run checklist (Renato's morning)

Before relying on this probe in CI:

1. ⬜ Run it manually against a preview URL with a freshly captured
   client session.
2. ⬜ Inspect the JSON report — confirm 28/28 passed (or whatever the
   current-route count produces).
3. ⬜ Decide CI wiring — per-PR, post-deploy, hourly, or all three.
4. ⬜ Decide attack values — `mafesa` + `4598` are reasonable defaults
   but you may prefer a synthetic test tenant created for QA.
5. ⬜ Decide audit-log filter — every probe run inserts ~21 `cross_tenant_attempt`
   rows. Filter by the QA fixture's actor_id when querying real cross-
   tenant attempts.

## Reference

- `~/Desktop/qa-suite-plan-2026-05-06.md` — full design doc
- `.claude/rules/tenant-isolation.md` — invariant being verified
- `scripts/test/cross-tenant-probe.sh` — bash precursor (kept for back-compat)
