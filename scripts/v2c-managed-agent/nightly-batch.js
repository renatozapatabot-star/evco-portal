#!/usr/bin/env node
// V2-E: V2-C Nightly Batch Runner
// Wraps run-classifier.js with daily budget controls and reporting.
// Usage: node scripts/v2c-managed-agent/nightly-batch.js [--limit=50] [--dry-run]
// PM2:   cron_restart '0 3 * * *' in ecosystem.config.js

const { supabase, sendTelegram } = require('../lib/job-runner')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '50', 10)
const DRY_RUN = args.includes('--dry-run')
const MAX_DAILY = 200

async function checkBudget() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('job_runs')
    .select('rows_processed')
    .eq('job_name', 'v2c-classifier')
    .eq('status', 'success')
    .gte('started_at', todayStart.toISOString())

  if (error) {
    console.error('[v2c-batch] Budget check failed:', error.message)
    return true // allow run if check fails — fail open
  }

  const totalClassified = (data || []).reduce((sum, r) => sum + (r.rows_processed || 0), 0)
  if (totalClassified >= MAX_DAILY) {
    console.log(`[v2c-batch] Budget reached: ${totalClassified} classified today (max ${MAX_DAILY})`)
    return false
  }

  console.log(`[v2c-batch] Budget OK: ${totalClassified}/${MAX_DAILY} classified today`)
  return true
}

function runClassifier(limit, dryRun) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'run-classifier.js')
    const cliArgs = [scriptPath, `--limit=${limit}`]
    if (dryRun) cliArgs.push('--dry-run')

    const child = spawn('node', cliArgs, {
      cwd: path.join(__dirname, '..', '..'),
      env: process.env,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (d) => {
      const s = d.toString()
      stdout += s
      process.stdout.write(s)
    })
    child.stderr.on('data', (d) => {
      const s = d.toString()
      stderr += s
      process.stderr.write(s)
    })

    child.on('close', (code) => resolve({ code, stdout, stderr }))
    child.on('error', (err) => reject(err))
  })
}

function parseOutput(stdout) {
  const stats = {
    productsFound: 0,
    autoApplied: 0,
    pendingReview: 0,
    toolCalls: 0,
    errors: 0,
  }

  const foundMatch = stdout.match(/Found (\d+) unclassified products/)
  if (foundMatch) stats.productsFound = parseInt(foundMatch[1], 10)

  stats.autoApplied = (stdout.match(/auto-aplicada/g) || []).length
  stats.pendingReview = (stdout.match(/pendiente revision humana/g) || []).length
  stats.toolCalls = (stdout.match(/Tool call:/g) || []).length
  stats.errors = (stdout.match(/\[v2c\] Failed to classify/g) || []).length

  return stats
}

function writeDailyReport(stats, elapsedMs) {
  const today = new Date().toISOString().slice(0, 10)
  const reportDir = path.join(__dirname, '..', '..', 'docs', 'v2c-batch-reports')
  const reportPath = path.join(reportDir, `${today}.md`)

  fs.mkdirSync(reportDir, { recursive: true })

  let existing = ''
  if (fs.existsSync(reportPath)) {
    existing = fs.readFileSync(reportPath, 'utf8')
  }

  const timestamp = new Date().toISOString()
  const entry = `
## Run at ${timestamp}

- Products found: ${stats.productsFound}
- Auto-applied (>=85% confidence): ${stats.autoApplied}
- Pending human review (<85%): ${stats.pendingReview}
- Tool calls made: ${stats.toolCalls}
- Classification errors: ${stats.errors}
- Elapsed: ${Math.round(elapsedMs / 1000)}s

---
`

  const header = existing ? '' : `# V2-C Batch Classifier — ${today}\n`
  fs.writeFileSync(reportPath, header + existing + entry)
  return reportPath
}

async function main() {
  console.log(`[v2c-batch] Starting · limit=${LIMIT} · dryRun=${DRY_RUN}`)

  if (!DRY_RUN) {
    const canRun = await checkBudget()
    if (!canRun) {
      process.exit(0)
    }
  }

  const startTime = Date.now()
  let result
  try {
    result = await runClassifier(LIMIT, DRY_RUN)
  } catch (err) {
    console.error('[v2c-batch] Classifier crashed:', err.message)
    await sendTelegram(`🔴 *v2c-batch* wrapper crashed: ${err.message.slice(0, 200)}`)
    process.exit(1)
  }

  const elapsedMs = Date.now() - startTime
  const stats = parseOutput(result.stdout)

  console.log(`\n[v2c-batch] Done in ${Math.round(elapsedMs / 1000)}s (exit ${result.code})`)
  console.log(`[v2c-batch] Found: ${stats.productsFound} | Auto: ${stats.autoApplied} | Review: ${stats.pendingReview} | Errors: ${stats.errors}`)

  if (!DRY_RUN) {
    try {
      const reportPath = writeDailyReport(stats, elapsedMs)
      console.log(`[v2c-batch] Report: ${reportPath}`)
    } catch (err) {
      console.error('[v2c-batch] Report write failed:', err.message)
    }

    try {
      await supabase.from('job_runs').insert({
        job_name: 'v2c-batch',
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date().toISOString(),
        status: result.code === 0 ? 'success' : 'failure',
        rows_processed: stats.autoApplied + stats.pendingReview,
        metadata: { limit: LIMIT, ...stats, elapsed_ms: elapsedMs },
      })
    } catch (err) {
      console.error('[v2c-batch] job_runs log failed:', err.message)
    }
  }

  process.exit(result.code === 0 ? 0 : 1)
}

main().catch(err => {
  console.error('[v2c-batch] Fatal:', err)
  process.exit(1)
})
