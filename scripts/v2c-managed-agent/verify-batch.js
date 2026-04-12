#!/usr/bin/env node
// V2-E: Verify batch runner setup
const { supabase } = require('../lib/job-runner')
const fs = require('fs')
const path = require('path')

async function verify() {
  console.log('=== V2-E Batch Runner Verification ===\n')

  // File checks
  const batch = path.join(__dirname, 'nightly-batch.js')
  const runner = path.join(__dirname, 'run-classifier.js')
  console.log(fs.existsSync(batch) ? '  nightly-batch.js exists' : '  nightly-batch.js MISSING')
  console.log(fs.existsSync(runner) ? '  run-classifier.js exists' : '  run-classifier.js MISSING')

  // Unclassified count
  const { count } = await supabase
    .from('globalpc_productos')
    .select('id', { count: 'exact', head: true })
    .is('fraccion', null)
  console.log(`\n  Unclassified products: ${count}`)

  // Recent classifier runs
  const { data: classifierRuns } = await supabase
    .from('job_runs')
    .select('status, rows_processed, started_at, metadata')
    .eq('job_name', 'v2c-classifier')
    .order('started_at', { ascending: false })
    .limit(5)

  console.log(`\n  Recent v2c-classifier runs: ${classifierRuns?.length || 0}`)
  if (classifierRuns) {
    for (const r of classifierRuns) {
      console.log(`    ${r.started_at} | ${r.status} | ${r.rows_processed || 0} rows`)
    }
  }

  // Recent batch runs
  const { data: batchRuns } = await supabase
    .from('job_runs')
    .select('status, rows_processed, started_at, metadata')
    .eq('job_name', 'v2c-batch')
    .order('started_at', { ascending: false })
    .limit(5)

  console.log(`\n  Recent v2c-batch runs: ${batchRuns?.length || 0}`)
  if (batchRuns) {
    for (const r of batchRuns) {
      const m = r.metadata || {}
      console.log(`    ${r.started_at} | ${r.status} | found:${m.productsFound || 0} auto:${m.autoApplied || 0} review:${m.pendingReview || 0}`)
    }
  }

  // Report files
  const reportDir = path.join(__dirname, '..', '..', 'docs', 'v2c-batch-reports')
  if (fs.existsSync(reportDir)) {
    const reports = fs.readdirSync(reportDir).filter(f => f.endsWith('.md')).sort().reverse()
    console.log(`\n  Report files: ${reports.length}`)
    for (const r of reports.slice(0, 3)) console.log(`    ${r}`)
  } else {
    console.log('\n  Report directory: not yet created (created on first run)')
  }

  console.log('\n  Next steps:')
  console.log('    1. Dry run:  node scripts/v2c-managed-agent/nightly-batch.js --limit=5 --dry-run')
  console.log('    2. Live run: node scripts/v2c-managed-agent/nightly-batch.js --limit=5')
  console.log('    3. On Throne: pm2 reload ecosystem.config.js && pm2 save')
}

verify().catch(console.error).finally(() => process.exit(0))
