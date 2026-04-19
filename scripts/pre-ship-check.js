#!/usr/bin/env node

// ============================================================================
// CRUZ · Pre-Ship Check
//
// Monday 06:55 morning helper — consolidates the MONDAY-RUNBOOK.md gates
// into ONE command so you're not copy-pasting five bash snippets under
// launch pressure with half a coffee in you. Runs the three
// non-negotiable verifications in sequence, prints a single PASS/FAIL
// summary, exits non-zero on any flag.
//
// What it checks (in order):
//   0. TELEGRAM_SILENT flag           (env — must not be 'true')
//   1. Telegram probe test            (sends a test message, expects delivery)
//   2. scripts/tenant-audit.js        (contamination_pct = 0%)
//   3. scripts/data-integrity-check.js (21 invariants green)
//   4. /api/health/data-integrity     (verdict = green)
//   5. npx vitest run (target-surface) (36 tests must pass — the regression floor)
//
// What it does NOT do:
//   - The live 5-question CRUZ AI leak battery (needs a browser + EVCO
//     session). That step is still manual in MONDAY-RUNBOOK.md Step 3.
//   - Any production mutation. Read-only + the Telegram test probe.
//
// Usage:
//   node scripts/pre-ship-check.js                # live run
//   node scripts/pre-ship-check.js --skip-probe   # don't send Telegram test
//   node scripts/pre-ship-check.js --prod         # hit the live production
//                                                   health endpoint too
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { spawn } = require('child_process')
const { sendTelegram } = require('./lib/telegram')

const SKIP_PROBE = process.argv.includes('--skip-probe')
const PROD = process.argv.includes('--prod')
const PROD_HEALTH_URL = 'https://portal.renatozapata.com/api/health/data-integrity'

const results = [] // { name, status: 'PASS'|'FAIL'|'WARN', detail }

function pass(name, detail) { results.push({ name, status: 'PASS', detail }); console.log(`  ✅ ${name}${detail ? ': ' + detail : ''}`) }
function fail(name, detail) { results.push({ name, status: 'FAIL', detail }); console.log(`  ❌ ${name}${detail ? ': ' + detail : ''}`) }
function warn(name, detail) { results.push({ name, status: 'WARN', detail }); console.log(`  ⚠️  ${name}${detail ? ': ' + detail : ''}`) }

function header(title) {
  console.log(`\n[${title}]`)
}

function runChild(cmd, args, { timeout = 180_000, passOn = () => true } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const killer = setTimeout(() => child.kill('SIGKILL'), timeout)
    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('close', (code) => {
      clearTimeout(killer)
      resolve({ code, stdout, stderr, ok: passOn({ code, stdout, stderr }) })
    })
  })
}

async function main() {
  console.log('=== CRUZ Pre-Ship Check ===')
  console.log(`    ${new Date().toISOString()}`)
  if (PROD) console.log(`    mode: --prod (probing production health)`)

  // ─── 0. TELEGRAM_SILENT flag ────────────────────────────────────────────
  header('Step 0 · TELEGRAM_SILENT flag')
  const silent = process.env.TELEGRAM_SILENT
  if (silent === 'true') {
    fail('TELEGRAM_SILENT', 'set to true — failure alerts are muted. Flip to false in .env.local + pm2 restart.')
  } else {
    pass('TELEGRAM_SILENT', `'${silent ?? 'unset'}' (ok — alerts will fire)`)
  }

  // ─── 1. Telegram probe ──────────────────────────────────────────────────
  header('Step 1 · Telegram delivery probe')
  if (SKIP_PROBE) {
    warn('Telegram probe', 'skipped (--skip-probe)')
  } else if (silent === 'true') {
    warn('Telegram probe', 'skipped (TELEGRAM_SILENT=true would no-op)')
  } else if (!process.env.TELEGRAM_BOT_TOKEN) {
    fail('Telegram probe', 'TELEGRAM_BOT_TOKEN unset — sendTelegram() will log-only')
  } else {
    try {
      await sendTelegram(`🧪 <b>pre-ship-check probe</b>\n<code>${new Date().toISOString()}</code>\nHost: ${require('os').hostname()}`)
      pass('Telegram probe', 'test message dispatched — verify it landed in RZ Ops group')
    } catch (e) {
      fail('Telegram probe', e.message)
    }
  }

  // ─── 2. tenant-audit.js ─────────────────────────────────────────────────
  header('Step 2 · tenant-audit.js (contamination_pct = 0%)')
  const auditRes = await runChild('node', ['scripts/tenant-audit.js'], {
    timeout: 180_000,
    passOn: ({ code, stdout }) => code === 0 && !/contamination_pct.*:\s*[1-9]/.test(stdout),
  })
  if (auditRes.ok) {
    pass('tenant-audit', `exit ${auditRes.code}, no contamination flags`)
  } else {
    fail('tenant-audit', `exit ${auditRes.code}${auditRes.stderr ? ' · ' + auditRes.stderr.slice(0, 200) : ''}`)
    console.log(auditRes.stdout.split('\n').filter((l) => /contamination|orphan|fail/i.test(l)).slice(0, 8).join('\n'))
  }

  // ─── 3. data-integrity-check.js ─────────────────────────────────────────
  header('Step 3 · data-integrity-check.js (21 invariants)')
  const intRes = await runChild('node', ['scripts/data-integrity-check.js'], {
    timeout: 120_000,
  })
  if (intRes.code === 0) {
    pass('data-integrity-check', 'all invariants green')
  } else {
    fail('data-integrity-check', `exit ${intRes.code}`)
    console.log(intRes.stdout.split('\n').filter((l) => /❌|FAIL|fail/.test(l)).slice(0, 10).join('\n'))
  }

  // ─── 4. /api/health/data-integrity ──────────────────────────────────────
  if (PROD) {
    header('Step 4 · GET ' + PROD_HEALTH_URL)
    try {
      const res = await fetch(PROD_HEALTH_URL, { headers: { 'cache-control': 'no-cache' } })
      const json = await res.json().catch(() => null)
      const verdict = json?.verdict
      if (verdict === 'green') pass('health probe', 'verdict=green')
      else if (verdict === 'amber') warn('health probe', 'verdict=amber (stale tenant; investigate before ship)')
      else if (verdict === 'red') fail('health probe', 'verdict=red — DO NOT SHIP')
      else fail('health probe', `unexpected response shape: ${JSON.stringify(json).slice(0, 200)}`)
    } catch (e) {
      fail('health probe', e.message)
    }
  } else {
    warn('health probe', 'skipped (pass --prod to hit ' + PROD_HEALTH_URL + ')')
  }

  // ─── 5. Target-surface vitest ───────────────────────────────────────────
  header('Step 5 · vitest (target-surface suite)')
  const targetFiles = [
    'src/lib/format/__tests__/company-name.test.ts',
    'src/app/inicio/__tests__/quiet-season.test.tsx',
    'src/lib/cockpit/__tests__/freshness.test.ts',
    'src/lib/aguila/__tests__/tools.catalogo.test.ts',
  ]
  const testRes = await runChild('npx', ['vitest', 'run', ...targetFiles, '--reporter=default'], {
    timeout: 120_000,
  })
  if (testRes.code === 0) {
    const match = testRes.stdout.match(/Tests\s+(\d+)\s+passed/)
    pass('target-surface tests', match ? `${match[1]} passed` : 'all green')
  } else {
    fail('target-surface tests', `exit ${testRes.code}`)
    console.log(testRes.stdout.split('\n').filter((l) => /FAIL|failed|✗/.test(l)).slice(0, 10).join('\n'))
  }

  // ─── Summary ────────────────────────────────────────────────────────────
  const failures = results.filter((r) => r.status === 'FAIL')
  const warnings = results.filter((r) => r.status === 'WARN')

  console.log('\n═════════════════════════════════════════════')
  console.log(`  PASS    ${results.filter((r) => r.status === 'PASS').length}`)
  console.log(`  WARN    ${warnings.length}`)
  console.log(`  FAIL    ${failures.length}`)
  console.log('═════════════════════════════════════════════')

  if (failures.length > 0) {
    console.log('\n❌ BLOCKED — do NOT merge sunday/data-trust-v1 or ship.')
    console.log('   Failed steps:')
    for (const f of failures) console.log(`     · ${f.name}${f.detail ? ': ' + f.detail : ''}`)
    console.log('\n   Fix the root cause, re-run pre-ship-check, only ship on clean.')
    process.exit(1)
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  PASSED WITH WARNINGS — review before shipping.')
    for (const w of warnings) console.log(`     · ${w.name}${w.detail ? ': ' + w.detail : ''}`)
  } else {
    console.log('\n✅ ALL GATES GREEN')
  }
  console.log('\n   Next: manual Step 3 from runbook — live 5-question leak battery')
  console.log('   in dev with EVCO session. Compare each AI answer vs:')
  console.log('     SELECT DISTINCT fraccion FROM globalpc_productos')
  console.log("       WHERE company_id='evco' AND cve_producto IN (")
  console.log("         SELECT cve_producto FROM globalpc_partidas WHERE company_id='evco'")
  console.log('       );')
  console.log('\n   If leak battery also green → merge + npm run ship.')
  process.exit(0)
}

main().catch((err) => {
  console.error('\nFATAL:', err.message)
  process.exit(1)
})
