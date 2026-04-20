#!/usr/bin/env node
/**
 * alert-coverage-audit · heuristic scan of PM2 cron scripts for
 * structured-failure-reporting coverage.
 *
 * For every entry in ecosystem.config.js, checks whether the script:
 *   · imports sendTelegram OR defines an inline tg() helper
 *   · calls process.exit(1) on the error path
 *   · writes to heartbeat_log or sync_log on success
 *   · wraps main() with a top-level .catch handler
 *
 * This is heuristic, not exhaustive — a script that grep-matches all
 * four isn't guaranteed to alert correctly. But a script that matches
 * ZERO is almost certainly silent-failing, and that's the class this
 * script surfaces. core-invariants rule 18 + operational-resilience.md
 * rule 1.
 *
 * Usage:
 *   node scripts/alert-coverage-audit.js              # table output
 *   node scripts/alert-coverage-audit.js --json       # machine-readable
 *   node scripts/alert-coverage-audit.js --gaps-only  # show only failures
 *
 * Exit code: 0 if every PM2 script has ≥ 3 of the 4 signals, 1 if any
 * script has ≤ 2. Lets this script be wired into ship.sh gate 1 later.
 */

const fs = require('fs')
const path = require('path')

const ECOSYSTEM = path.join(__dirname, '..', 'ecosystem.config.js')
const REPO_ROOT = path.join(__dirname, '..')

const JSON_MODE = process.argv.includes('--json')
const GAPS_ONLY = process.argv.includes('--gaps-only')
const THRESHOLD = 3 // require ≥ this many signals for "covered"

function extractPm2Scripts() {
  const src = fs.readFileSync(ECOSYSTEM, 'utf8')
  const namePattern = /name:\s*'([^']+)'/g
  const scriptPattern = /script:\s*'([^']+)'/g
  const cronPattern = /cron_restart:\s*'([^']+)'/g
  const names = []
  const scripts = []
  const crons = []
  let m
  while ((m = namePattern.exec(src)) !== null) names.push(m[1])
  while ((m = scriptPattern.exec(src)) !== null) scripts.push(m[1])
  while ((m = cronPattern.exec(src)) !== null) crons.push(m[1])
  // names.length should equal scripts.length; pair by position
  const pairs = []
  for (let i = 0; i < names.length; i++) {
    pairs.push({
      name: names[i],
      script: scripts[i] || null,
      // cron_restart may be omitted on daemons (cruz-bot) — align
      // heuristically. If fewer crons than names, trailing names are
      // daemons.
      cron: null,
    })
  }
  // Best-effort cron alignment: scan the ecosystem.config.js line-by-
  // line around each `name:` for the nearest `cron_restart:` entry.
  const lines = src.split('\n')
  let currentIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const nameMatch = lines[i].match(/name:\s*'([^']+)'/)
    if (nameMatch) {
      currentIdx = pairs.findIndex(p => p.name === nameMatch[1])
    }
    const cronMatch = lines[i].match(/cron_restart:\s*'([^']+)'/)
    if (cronMatch && currentIdx >= 0) {
      pairs[currentIdx].cron = cronMatch[1]
    }
  }
  return pairs
}

function auditScript(scriptPath) {
  const full = path.join(REPO_ROOT, scriptPath)
  if (!fs.existsSync(full)) {
    return {
      exists: false,
      signals: { telegram: false, exit1: false, log: false, topCatch: false },
    }
  }
  const src = fs.readFileSync(full, 'utf8')
  return {
    exists: true,
    signals: {
      telegram:
        /sendTelegram\s*\(/.test(src) ||
        /\brequire\(['"][^'"]*\/telegram['"]\)/.test(src) ||
        /async\s+function\s+tg\s*\(/.test(src) ||
        /const\s+tg\s*=/.test(src) ||
        /sendTg\s*\(/.test(src),
      exit1: /process\.exit\(\s*1\s*\)/.test(src),
      log:
        /\.from\(['"]heartbeat_log['"]\)/.test(src) ||
        /\.from\(['"]sync_log['"]\)/.test(src) ||
        /\blogToSupabase\(/.test(src) ||
        /\brequire\(['"][^'"]*\/sync-log['"]\)/.test(src),
      topCatch: /main\(\)\s*\.catch\s*\(/.test(src),
    },
  }
}

function scoreSignals(signals) {
  return (
    (signals.telegram ? 1 : 0) +
    (signals.exit1 ? 1 : 0) +
    (signals.log ? 1 : 0) +
    (signals.topCatch ? 1 : 0)
  )
}

function verdictFor(score) {
  if (score === 4) return 'full'
  if (score >= THRESHOLD) return 'covered'
  if (score >= 1) return 'partial'
  return 'silent'
}

function main() {
  const pairs = extractPm2Scripts()
  const rows = []
  for (const p of pairs) {
    if (!p.script) continue
    const audit = auditScript(p.script)
    const score = scoreSignals(audit.signals)
    rows.push({
      name: p.name,
      script: p.script,
      cron: p.cron || '(daemon)',
      exists: audit.exists,
      ...audit.signals,
      score,
      verdict: verdictFor(score),
    })
  }

  const gapRows = rows.filter(r => r.verdict === 'partial' || r.verdict === 'silent')
  const displayRows = GAPS_ONLY ? gapRows : rows

  if (JSON_MODE) {
    console.log(JSON.stringify({ total: rows.length, rows, gaps: gapRows }, null, 2))
    process.exit(gapRows.length > 0 ? 1 : 0)
  }

  // Pretty table
  const col = (s, n) => String(s ?? '').padEnd(n).slice(0, n)
  console.log('')
  console.log('Alert Coverage Audit — scripts/ PM2 cron + daemon inventory')
  console.log('='.repeat(80))
  console.log(
    col('Name', 28) + col('Cron', 14) + col('TG', 4) + col('Ex1', 4) + col('Log', 4) + col('Cat', 4) + col('Score', 6) + 'Verdict',
  )
  console.log('-'.repeat(80))
  for (const r of displayRows) {
    console.log(
      col(r.name, 28) +
        col(r.cron, 14) +
        col(r.telegram ? '✓' : '·', 4) +
        col(r.exit1 ? '✓' : '·', 4) +
        col(r.log ? '✓' : '·', 4) +
        col(r.topCatch ? '✓' : '·', 4) +
        col(`${r.score}/4`, 6) +
        r.verdict,
    )
  }
  console.log('='.repeat(80))
  const byVerdict = rows.reduce((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] || 0) + 1
    return acc
  }, {})
  console.log(`Total: ${rows.length} scripts · ` +
    `full ${byVerdict.full || 0} · covered ${byVerdict.covered || 0} · ` +
    `partial ${byVerdict.partial || 0} · silent ${byVerdict.silent || 0}`)
  console.log('')
  console.log('Columns: TG=sendTelegram · Ex1=process.exit(1) · Log=heartbeat/sync_log · Cat=main().catch')
  console.log(`Pass threshold: ≥ ${THRESHOLD}/4 signals.`)
  console.log('')

  process.exit(gapRows.length > 0 ? 1 : 0)
}

main()
