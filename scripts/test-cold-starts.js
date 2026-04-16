#!/usr/bin/env node
/**
 * test-cold-starts.js — forces serverless cold starts and verifies
 * that /inicio doesn't false-redirect to /login?stale=1 under load.
 *
 * Fires 5 requests to /api/health spaced 45 s apart. Vercel evicts
 * idle functions after ~15 min but recycles aggressively under bursty
 * traffic; 45 s is typically enough to land on a cold instance OR
 * catch a freshly-recycled one. Either way the dataset for the cold
 * + warm mix is representative.
 *
 * Pass URL via DRY_RUN_URL env var (defaults to portal.renatozapata.com).
 * Writes /tmp/cold-start-report.md with per-request state + summary.
 * Exits 0 regardless; this is diagnostic, not a gate.
 */

const fs = require('fs')

const URL_BASE = process.env.DRY_RUN_URL || 'https://portal.renatozapata.com'
const REQUEST_COUNT = 5
const GAP_MS = 45_000

async function hit(i) {
  const t0 = Date.now()
  try {
    const res = await fetch(`${URL_BASE}/api/health`, { cache: 'no-store' })
    const elapsed = Date.now() - t0
    const json = await res.json().catch(() => null)
    return {
      n: i + 1,
      ok: res.ok,
      status: res.status,
      elapsed_ms: elapsed,
      cold_start: json?.cold_start ?? null,
      instance_age_ms: json?.instance_age_ms ?? null,
      supabase_ok: json?.supabase?.ok ?? null,
      sync_ok: json?.sync?.ok ?? null,
      sync_age_min: json?.sync?.ms ?? null,
    }
  } catch (err) {
    return {
      n: i + 1,
      ok: false,
      status: 0,
      elapsed_ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

;(async () => {
  console.log(`\n❄️  Cold-start test — ${new Date().toISOString()}`)
  console.log(`   URL: ${URL_BASE}`)
  console.log(`   Requests: ${REQUEST_COUNT}, gap: ${GAP_MS / 1000}s between\n`)

  const results = []
  for (let i = 0; i < REQUEST_COUNT; i++) {
    const result = await hit(i)
    results.push(result)
    const marker = result.cold_start === true ? '❄️  COLD' : result.cold_start === false ? '🔥 WARM' : '❓ UNKNOWN'
    console.log(
      `  ${marker}  #${result.n}  ${result.status || 'ERR'}  ${result.elapsed_ms}ms  ` +
      `supabase=${result.supabase_ok} sync=${result.sync_ok} age=${result.instance_age_ms}ms`,
    )
    if (i < REQUEST_COUNT - 1) {
      await sleep(GAP_MS)
    }
  }

  const cold = results.filter((r) => r.cold_start === true).length
  const warm = results.filter((r) => r.cold_start === false).length
  const fails = results.filter((r) => !r.ok).length
  const maxElapsed = Math.max(...results.map((r) => r.elapsed_ms))
  const allSupabaseOk = results.every((r) => r.supabase_ok === true)
  const allSyncOk = results.every((r) => r.sync_ok === true)

  const summary = [
    `# Cold-start test — ${new Date().toISOString()}`,
    ``,
    `**URL:** ${URL_BASE}`,
    `**Requests:** ${REQUEST_COUNT}, ${GAP_MS / 1000}s gap`,
    ``,
    `## Per-request`,
    ``,
    '| # | state | ms | status | supabase | sync | age |',
    '|---|---|---|---|---|---|---|',
    ...results.map((r) =>
      `| ${r.n} | ${r.cold_start === true ? 'COLD' : r.cold_start === false ? 'WARM' : '?'} ` +
      `| ${r.elapsed_ms} | ${r.status || 'ERR'} ` +
      `| ${r.supabase_ok ?? '—'} | ${r.sync_ok ?? '—'} | ${r.instance_age_ms ?? '—'} |`,
    ),
    ``,
    `## Summary`,
    ``,
    `- Cold hits: ${cold}`,
    `- Warm hits: ${warm}`,
    `- Errors: ${fails}`,
    `- Max elapsed: ${maxElapsed} ms`,
    `- All supabase.ok: ${allSupabaseOk}`,
    `- All sync.ok: ${allSyncOk}`,
    ``,
    `## Verdict`,
    ``,
    `${fails === 0 && allSupabaseOk ? '✅ OK — no failed requests' : '❌ Issues detected'}`,
    `${cold > 0 ? '✅ At least one cold start was observed (representative test)' : '⚠️ No cold starts observed — Vercel may have served from warm pool'}`,
    ``,
    `Note: this script only exercises /api/health, which is lightweight.`,
    `A true cold-start test of /inicio would require authenticated`,
    `Playwright runs — see scripts/ursula-dry-run.js run 3× back to back.`,
  ].join('\n')

  fs.writeFileSync('/tmp/cold-start-report.md', summary)
  console.log(`\n📝 Report: /tmp/cold-start-report.md`)
  console.log(`   ${cold} cold · ${warm} warm · ${fails} errors`)
  process.exit(0)
})().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
