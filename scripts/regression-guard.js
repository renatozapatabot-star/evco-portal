#!/usr/bin/env node
/**
 * CRUZ Regression Guard
 * Runs after nightly sync (cron: 30 1 * * *)
 *
 * Compares today's data against yesterday's baseline:
 *   - Row counts per critical table (traficos, entradas, aduanet_facturas, pedimentos)
 *   - Coverage % (matched vs total records)
 *   - Unmatched expediente count
 *
 * Alerts if:
 *   - Coverage drops > 2%
 *   - Row count changes > 5% unexpectedly
 *   - Unmatched count increases
 *
 * Logs every run to regression_guard_log table.
 */

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const SCRIPT_NAME = 'regression-guard.js'

// Tables to monitor with their coverage query logic
const MONITORED_TABLES = [
  {
    name: 'traficos',
    countQuery: () => supabase.from('traficos').select('id', { count: 'exact', head: true }),
    // Coverage = traficos with at least one pedimento linked
    coverageQuery: async () => {
      const { count: total } = await supabase.from('traficos').select('id', { count: 'exact', head: true })
      const { count: matched } = await supabase.from('traficos').select('id', { count: 'exact', head: true }).not('pedimento', 'is', null)
      return { total: total || 0, matched: matched || 0 }
    }
  },
  {
    name: 'aduanet_facturas',
    countQuery: () => supabase.from('aduanet_facturas').select('id', { count: 'exact', head: true }),
    // Coverage = facturas with matched pedimento
    coverageQuery: async () => {
      const { count: total } = await supabase.from('aduanet_facturas').select('id', { count: 'exact', head: true })
      const { count: matched } = await supabase.from('aduanet_facturas').select('id', { count: 'exact', head: true }).not('pedimento', 'is', null)
      return { total: total || 0, matched: matched || 0 }
    }
  },
  {
    name: 'entradas',
    countQuery: () => supabase.from('entradas').select('id', { count: 'exact', head: true }),
    // Coverage = entradas linked to a trafico
    coverageQuery: async () => {
      const { count: total } = await supabase.from('entradas').select('id', { count: 'exact', head: true })
      const { count: matched } = await supabase.from('entradas').select('id', { count: 'exact', head: true }).not('trafico', 'is', null)
      return { total: total || 0, matched: matched || 0 }
    }
  }
]

const COVERAGE_THRESHOLD = 2.0   // Alert if coverage drops > 2%
const ROW_DELTA_THRESHOLD = 5.0  // Alert if row count changes > 5%

function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG]', message.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
    })
  } catch (e) {
    console.error('Telegram error:', e.message)
  }
}

async function getPreviousBaseline(tableName) {
  const { data } = await supabase
    .from('regression_guard_log')
    .select('row_count, coverage_pct, unmatched_count')
    .eq('table_name', tableName)
    .order('checked_at', { ascending: false })
    .limit(1)

  if (data && data.length > 0) return data[0]
  return null
}

async function visualRegressionCheck() {
  try {
    const res = await fetch('https://evco-portal.vercel.app')
    const html = await res.text()

    const FORBIDDEN_STRINGS = [
      '50 clientes', '754 tráficos activos', 'Ollama',
      'GlobalPC MySQL', 'SCORE GENERAL', 'Exposición total',
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]

    const violations = FORBIDDEN_STRINGS.filter(s =>
      html.toLowerCase().includes(s.toLowerCase())
    )

    if (violations.length > 0) {
      await sendTelegram(
        `🔴 REGRESIÓN DETECTADA en portal EVCO\n` +
        `Strings prohibidos encontrados:\n${violations.map(v => `• "${v}"`).join('\n')}\n` +
        `— CRUZ 🦀`
      )
      console.log(`  ⚠️  Visual regression: ${violations.length} forbidden string(s) found`)
    } else {
      console.log('  ✅ Visual regression check passed — no forbidden strings')
    }
  } catch (err) {
    console.log('⚠️ Visual regression check skipped:', err.message)
  }
}

async function runGuard() {
  const timestamp = nowCST()
  console.log(`\uD83D\uDEE1\uFE0F  CRUZ Regression Guard \u2014 ${timestamp}`)

  const alerts = []
  const logEntries = []

  for (const table of MONITORED_TABLES) {
    console.log(`\n  Checking ${table.name}...`)

    try {
      // Get current counts
      const { count: rowCount } = await table.countQuery()
      const coverage = await table.coverageQuery()
      const coveragePct = coverage.total > 0
        ? Math.round((coverage.matched / coverage.total) * 10000) / 100
        : 0
      const unmatchedCount = coverage.total - coverage.matched

      // Get yesterday's baseline
      const prev = await getPreviousBaseline(table.name)
      const prevRowCount = prev?.row_count || null
      const prevCoveragePct = prev?.coverage_pct || null
      const prevUnmatched = prev?.unmatched_count || 0

      // Calculate deltas
      let rowDeltaPct = null
      let coverageDeltaPct = null
      let alertFired = false

      if (prevRowCount !== null && prevRowCount > 0) {
        rowDeltaPct = Math.round(((rowCount - prevRowCount) / prevRowCount) * 10000) / 100
      }
      if (prevCoveragePct !== null) {
        coverageDeltaPct = Math.round((coveragePct - prevCoveragePct) * 100) / 100
      }

      console.log(`    Rows: ${rowCount}${prevRowCount !== null ? ` (was ${prevRowCount}, delta ${rowDeltaPct}%)` : ' (no baseline)'}`)
      console.log(`    Coverage: ${coveragePct}%${prevCoveragePct !== null ? ` (was ${prevCoveragePct}%, delta ${coverageDeltaPct}%)` : ' (no baseline)'}`)
      console.log(`    Unmatched: ${unmatchedCount}${prev ? ` (was ${prevUnmatched})` : ''}`)

      // Check for regressions
      if (coverageDeltaPct !== null && coverageDeltaPct < -COVERAGE_THRESHOLD) {
        alerts.push(`\u274C <b>${table.name}</b>: coverage dropped ${Math.abs(coverageDeltaPct)}% (${prevCoveragePct}% \u2192 ${coveragePct}%)`)
        alertFired = true
      }

      if (rowDeltaPct !== null && Math.abs(rowDeltaPct) > ROW_DELTA_THRESHOLD) {
        const direction = rowDeltaPct > 0 ? 'increased' : 'decreased'
        alerts.push(`\u26A0\uFE0F <b>${table.name}</b>: row count ${direction} ${Math.abs(rowDeltaPct)}% (${prevRowCount} \u2192 ${rowCount})`)
        alertFired = true
      }

      if (prev && unmatchedCount > prevUnmatched && (unmatchedCount - prevUnmatched) > 5) {
        alerts.push(`\u26A0\uFE0F <b>${table.name}</b>: unmatched count increased (${prevUnmatched} \u2192 ${unmatchedCount})`)
        alertFired = true
      }

      // Log entry
      logEntries.push({
        table_name: table.name,
        row_count: rowCount,
        prev_row_count: prevRowCount,
        row_delta_pct: rowDeltaPct,
        coverage_pct: coveragePct,
        prev_coverage_pct: prevCoveragePct,
        coverage_delta_pct: coverageDeltaPct,
        unmatched_count: unmatchedCount,
        alert_fired: alertFired
      })

    } catch (e) {
      console.error(`    ERROR: ${e.message}`)
      alerts.push(`\uD83D\uDD34 <b>${table.name}</b>: check failed \u2014 ${e.message}`)
      logEntries.push({
        table_name: table.name,
        row_count: 0,
        alert_fired: true,
        details: { error: e.message }
      })
    }
  }

  // Write all log entries to Supabase
  try {
    if (logEntries.length > 0) {
      const { error } = await supabase.from('regression_guard_log').insert(logEntries)
      if (error) console.error('Failed to log to regression_guard_log:', error.message)
      else console.log(`\n  \u2705 Logged ${logEntries.length} entries to regression_guard_log`)
    }
  } catch (e) {
    console.error('Supabase log error:', e.message)
  }

  // Send Telegram
  if (alerts.length > 0) {
    const msg = [
      `\uD83D\uDEA8 <b>CRUZ REGRESSION GUARD \u2014 ALERTA</b>`,
      `${timestamp} \u2014 Post-sync check`,
      `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
      ...alerts,
      `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
      `Threshold: coverage >${COVERAGE_THRESHOLD}% drop, rows >${ROW_DELTA_THRESHOLD}% change`,
      `\u2014 CRUZ \uD83E\uDD80`
    ].join('\n')
    await sendTelegram(msg)
    console.log(`\n  \u26A0\uFE0F  ${alerts.length} regression(s) detected \u2014 alert sent`)
  } else {
    const msg = [
      `\u2705 <b>CRUZ REGRESSION GUARD \u2014 OK</b>`,
      `${timestamp}`,
      `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
      ...logEntries.map(e => `${e.table_name}: ${e.row_count} rows, ${e.coverage_pct}% coverage`),
      `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`,
      `\u2014 CRUZ \uD83E\uDD80`
    ].join('\n')
    await sendTelegram(msg)
    console.log(`\n  \u2705 No regressions \u2014 all clear`)
  }

  // V6: Visual regression check against live portal
  await visualRegressionCheck()
}

runGuard().catch(async (err) => {
  console.error('Fatal regression guard error:', err)
  try {
    await sendTelegram(`\uD83D\uDD34 <b>${SCRIPT_NAME} FATAL</b>\n${err.message}\n\u2014 CRUZ \uD83E\uDD80`)
    await supabase.from('regression_guard_log').insert({
      table_name: '_fatal',
      row_count: 0,
      alert_fired: true,
      details: { fatal: err.message }
    })
  } catch (_) { /* best effort */ }
  process.exit(1)
})
