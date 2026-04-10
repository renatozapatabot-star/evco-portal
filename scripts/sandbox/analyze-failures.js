#!/usr/bin/env node
// ============================================================================
// CRUZ Clearance Sandbox — Failure Analyzer
// ============================================================================
// Groups sandbox failures by root cause and suggests fixes.
//
// Usage:
//   node scripts/sandbox/analyze-failures.js
//   node scripts/sandbox/analyze-failures.js --days=30
//   node scripts/sandbox/analyze-failures.js --top=5
//   node scripts/sandbox/analyze-failures.js --client=evco
//
// Patente 3596 · Aduana 240 · CRUZ — Cross-Border Intelligence
// ============================================================================

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const chalk = require('chalk')
const Table = require('cli-table3')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ── Failure categories ──────────────────────────────────────────────────────

const CATEGORIES = {
  fraccion_mismatch: {
    label: 'FRACCION MISMATCH',
    description: 'Ghost fracción differs from filed fracción',
    fix: 'Add more context to classification prompt, use peso/unidad hints, expand fraccion_patterns',
  },
  total_delta: {
    label: 'TOTAL DISCREPANCY',
    description: 'Total contribuciones outside tolerance',
    fix: 'Check IGI rate lookup, verify DTA regime mapping, check tipo_cambio source',
  },
  tmec_false_negative_CRITICAL: {
    label: 'T-MEC FALSE NEGATIVE (CRITICAL)',
    description: 'T-MEC eligible but CRUZ did not detect — client would overpay',
    fix: 'Expand T-MEC regime detection, check fracción schedule eligibility',
  },
  tmec_mismatch: {
    label: 'T-MEC MISMATCH',
    description: 'T-MEC detection differs from filed value',
    fix: 'Verify regime code mapping (ITE/ITR/IMD), check certificado_origen presence',
  },
  extraction_incomplete: {
    label: 'EXTRACTION INCOMPLETE',
    description: 'Too many fields missing from actual data for comparison',
    fix: 'Improve aduanet_facturas backfill coverage, verify factura data quality',
  },
}

// ── Flag parsing ────────────────────────────────────────────────────────────

function parseFlags() {
  const args = process.argv.slice(2)
  return {
    days: parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1] || '30', 10),
    top: parseInt(args.find(a => a.startsWith('--top='))?.split('=')[1] || '10', 10),
    client: args.find(a => a.startsWith('--client='))?.split('=')[1] || process.env.DEFAULT_COMPANY_ID || 'evco',
    field: args.find(a => a.startsWith('--field='))?.split('=')[1] || null,
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const flags = parseFlags()
  const since = new Date()
  since.setDate(since.getDate() - flags.days)

  console.log(chalk.bold('\nCRUZ Sandbox Failure Analyzer'))
  console.log(chalk.dim(`  Last ${flags.days} days · Company: ${flags.client}\n`))

  // Fetch failures
  const { data: failures, error } = await supabase
    .from('sandbox_results')
    .select('referencia, failure_reasons, field_scores, overall_score, ghost_fraccion, actual_fraccion, ghost_total, actual_total, ghost_tmec, actual_tmec, created_at')
    .eq('company_id', flags.client)
    .eq('pass', false)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw new Error(`Query failed: ${error.message}`)

  if (!failures || failures.length === 0) {
    console.log(chalk.green('No failures in the last ' + flags.days + ' days!'))
    return
  }

  // Fetch total count for context
  const { count: totalCount } = await supabase
    .from('sandbox_results')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', flags.client)
    .gte('created_at', since.toISOString())

  console.log(chalk.dim(`  ${failures.length} failures out of ${totalCount || '?'} total tests (${totalCount ? Math.round((failures.length / totalCount) * 100) : '?'}% failure rate)\n`))

  // Group by reason
  const byReason = {}
  for (const f of failures) {
    for (const reason of (f.failure_reasons || ['unknown'])) {
      if (!byReason[reason]) byReason[reason] = { count: 0, examples: [] }
      byReason[reason].count++
      if (byReason[reason].examples.length < 3) {
        byReason[reason].examples.push(f)
      }
    }
  }

  // Sort by count
  const sorted = Object.entries(byReason).sort((a, b) => b[1].count - a[1].count)

  // Print summary table
  const summaryTable = new Table({
    head: ['Reason', 'Count', '%', 'Severity'],
    colWidths: [35, 8, 8, 12],
    style: { head: ['cyan'] },
  })

  for (const [reason, data] of sorted.slice(0, flags.top)) {
    const pct = Math.round((data.count / failures.length) * 100)
    const isCritical = reason.includes('CRITICAL')
    const severity = isCritical ? chalk.red.bold('CRITICAL') : chalk.yellow('WARNING')
    summaryTable.push([reason, data.count, `${pct}%`, severity])
  }

  console.log(summaryTable.toString())

  // Detailed breakdown per category
  for (const [reason, data] of sorted.slice(0, flags.top)) {
    const cat = CATEGORIES[reason]
    console.log()
    console.log(chalk.bold(`  ${cat?.label || reason}`))
    console.log(chalk.dim(`  ${cat?.description || 'No description'}`))
    console.log(chalk.dim(`  Fix: ${cat?.fix || 'Investigate manually'}`))
    console.log()

    for (const ex of data.examples) {
      const detail = []
      if (reason.includes('fraccion') && ex.field_scores?.fraccion) {
        detail.push(`ghost=${ex.ghost_fraccion} actual=${ex.actual_fraccion}`)
      }
      if (reason.includes('total') && ex.field_scores?.total) {
        detail.push(`ghost=${ex.ghost_total} actual=${ex.actual_total}`)
      }
      if (reason.includes('tmec')) {
        detail.push(`ghost=${ex.ghost_tmec} actual=${ex.actual_tmec}`)
      }
      console.log(`    ${ex.referencia} (score: ${ex.overall_score}) ${chalk.dim(detail.join(' · '))}`)
    }
  }

  // Fraccion-specific analysis
  const fraccionFailures = failures.filter(f => (f.failure_reasons || []).includes('fraccion_mismatch'))
  if (fraccionFailures.length > 0) {
    console.log(chalk.bold('\n  TOP MISCLASSIFIED FRACCIONES'))

    const byActualFraccion = {}
    for (const f of fraccionFailures) {
      const actual = f.actual_fraccion || 'unknown'
      if (!byActualFraccion[actual]) byActualFraccion[actual] = { count: 0, ghostFracciones: {} }
      byActualFraccion[actual].count++
      const ghost = f.ghost_fraccion || 'none'
      byActualFraccion[actual].ghostFracciones[ghost] = (byActualFraccion[actual].ghostFracciones[ghost] || 0) + 1
    }

    const sortedFracs = Object.entries(byActualFraccion).sort((a, b) => b[1].count - a[1].count)
    for (const [frac, data] of sortedFracs.slice(0, 5)) {
      const ghosts = Object.entries(data.ghostFracciones).map(([g, c]) => `${g} (${c}x)`).join(', ')
      console.log(`    ${chalk.cyan(frac)} — ${data.count} failures · CRUZ guessed: ${ghosts}`)
    }
  }

  console.log()
}

main().catch(err => {
  console.error(chalk.red(`Error: ${err.message}`))
  process.exit(1)
})
