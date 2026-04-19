# ⚠ CRITICAL FINDING — full-sync-* scripts no-op under TELEGRAM_SILENT=true

**Discovered:** 2026-04-20 pre-launch audit (continuation of Sunday marathon)
**Severity:** SEV-2 (silent production no-op)
**Blast radius:** 3 weekly/on-demand full sync scripts

---

## What I found

Three scripts have an IDENTICAL bug pair:

| File | PM2 schedule | Table written |
|---|---|---|
| `scripts/full-sync-productos.js` | on-demand | `globalpc_productos` |
| `scripts/full-sync-facturas.js` | Sun 02:00 weekly | `globalpc_facturas` |
| `scripts/full-sync-eventos.js` | on-demand | `globalpc_eventos` |

**Bug 1 — stray top-level `return`:**

```js
async function tg(msg) { if (!TG) return; await fetch(...) }
  if (process.env.TELEGRAM_SILENT === 'true') return   // ← outside any function
```

Line 11-15 of each file (varies slightly). The `return` is at module top-level. In CommonJS, a bare `return` at module level EXITS THE MODULE EARLY. Verified empirically:

```bash
$ cat > /tmp/test.js <<'EOF'
console.log('before')
if (true) return
console.log('after')
EOF
$ node /tmp/test.js
before                    # ← "after" never printed
```

**Effect:** when `TELEGRAM_SILENT=true` (current state on Throne per CLAUDE.md BUILD STATE), these three scripts exit immediately at the top of the module. They do NOTHING. No sync. No error. Silent no-op.

**Bug 2 — `|| 'unknown'` tenant fallback:**

```js
company_id: claveMap[r.sCveCliente] || r.sCveCliente || 'unknown'
```

This is EXACTLY the forbidden pattern in `.claude/rules/tenant-isolation.md`:

> **Forbidden patterns:**
> 1. `company_id: r.sCveCliente || 'unknown'` — fallbacks mask mapping gaps

The Block EE contract requires: rows with an unknown `cve_cliente` SKIP + ALERT, never fall through to `'unknown'`. These scripts violate that.

---

## The paradox — why I did NOT fix

**Fixing Bug 1 in isolation would ENABLE Bug 2.** The moment you flip `TELEGRAM_SILENT=false` (Monday runbook Step 0) AND these scripts actually run, they'd start contaminating production with rows tagged `company_id='unknown'`. That's a regression worse than the current broken-but-contained state.

Both bugs must be fixed TOGETHER:

```js
// 1. Replace the 'unknown' fallback with skip-and-alert:
if (!claveMap[r.sCveCliente]) {
  await tg(`🟡 ${scriptName}: unknown cve_cliente=${r.sCveCliente} — skipping row`)
  return null  // from the mapper, filter out null after
}
company_id: claveMap[r.sCveCliente]

// 2. THEN remove the stray return at line 11-15.
```

---

## Impact on Monday 2026-04-20 launch

**Not launch-blocking** — the only one of the three scheduled in PM2 cron is `full-sync-facturas` (Sundays 02:00). Last run was 02:00 Monday 2026-04-20 (6 hours before Ursula's 08:00 ship), which no-op'd silently. Won't fire again until next Sunday 02:00.

**Launch risk IF Renato flips TELEGRAM_SILENT=false Monday 06:55 per runbook Step 0:**
- `full-sync-facturas` won't run again until next Sunday 02:00, so no immediate impact
- But if Renato manually invokes `full-sync-productos` or `full-sync-eventos` during the day, they now actually execute — and will contaminate with `'unknown'`

**Mitigation:** do NOT manually invoke `full-sync-productos.js` or `full-sync-eventos.js` after flipping TELEGRAM_SILENT=false until the full fix lands. These invocations are rare (recovery tool only). Normal Monday launch doesn't touch them.

**Before next Sunday 2026-04-27 02:00:** land the combined fix for full-sync-facturas.js so its next weekly run is safe.

---

## What the code currently looks like (warning comments added this session)

All three files now carry inline warning comments documenting both bugs together, so the next session (or the next Claude) doesn't innocently fix one and ship the other. Commit reference: see `docs(audit)` commit in the sunday/data-trust-v1 chain.

---

## Proof work

```bash
# Verify the bug pattern is present:
grep -n "TELEGRAM_SILENT === 'true') return$" scripts/full-sync-*.js

# Verify the 'unknown' fallback is still there:
grep -n "|| 'unknown'" scripts/full-sync-*.js

# Empirical module-exit test:
cat > /tmp/test.js <<'EOF'
console.log('before')
if (true) return
console.log('after')
EOF
node /tmp/test.js  # should print only "before"
```

---

## Next-session scope

Combined fix as one surgical PR:
1. Replace `|| 'unknown'` with skip-and-alert in all 3 full-sync-*.js + `auto-classifier.js:530` + `bootcamp-client-fingerprint.js:52` + `wsdl-document-pull.js:126,344` + `tariff-monitor.js:65`
2. Remove the stray `return` statements in full-sync-productos / facturas / eventos
3. Replace local `tg()` with `sendTelegram` from `scripts/lib/telegram` (already handles TELEGRAM_SILENT correctly — skips without exiting the module)
4. Unit-test or manual-test each script with TELEGRAM_SILENT=false set to confirm it actually runs
5. Verify one full-sync-facturas dry-run before next Sunday 02:00 cron

**Estimate:** 2-3 hours with testing. Not launch-critical. Do post-Ursula-ship.
