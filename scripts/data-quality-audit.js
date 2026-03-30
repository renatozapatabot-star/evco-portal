#!/usr/bin/env node
// scripts/data-quality-audit.js — BUILD 3 PHASE 1
// Data Quality Profiler — profiles every intelligence table
// Reports: null rates, duplicates, value distributions, freshness, anomalies
// Cron: 0 4 * * 0 (Sunday 4 AM)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function sendTG(msg) {
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

// ── Tables to profile ────────────────────────────────
const TABLES_TO_PROFILE = [
  {
    table: 'traficos',
    critical_columns: [
      'trafico', 'company_id', 'fecha_llegada',
      'fecha_cruce', 'estatus', 'pedimento',
      'transportista_extranjero', 'peso_bruto'
    ]
  },
  {
    table: 'globalpc_facturas',
    critical_columns: [
      'factura_id', 'cve_trafico', 'proveedor',
      'valor', 'cove', 'fecha'
    ]
  },
  {
    table: 'globalpc_productos',
    critical_columns: [
      'producto_id', 'descripcion', 'fraccion',
      'valor_unitario', 'cantidad'
    ]
  },
  {
    table: 'entradas',
    critical_columns: [
      'entrada_id', 'trafico_id', 'fecha_llegada',
      'peso_recibido', 'mercancia_danada'
    ]
  },
  {
    table: 'pedimento_risk_scores',
    critical_columns: [
      'trafico_id', 'overall_score', 'risk_factors'
    ]
  }
]

// ── Ensure data_quality_reports table exists ─────────
async function ensureTable() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS data_quality_reports (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        table_name TEXT,
        column_name TEXT,
        total_rows INTEGER,
        null_count INTEGER,
        null_pct NUMERIC,
        distinct_count INTEGER,
        min_value TEXT,
        max_value TEXT,
        top_values JSONB,
        quality_score INTEGER,
        issues JSONB,
        profiled_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  })
  if (error) {
    // Table might already exist or RPC not available — try direct insert test
    const { error: testErr } = await supabase.from('data_quality_reports').select('id').limit(1)
    if (testErr) {
      console.log('⚠️  data_quality_reports table needs manual creation — continuing with logging only')
      return false
    }
  }
  return true
}

// ── Profile a single column ──────────────────────────
async function profileColumn(tableName, columnName, allRows) {
  const totalRows = allRows.length
  if (totalRows === 0) {
    return {
      table_name: tableName,
      column_name: columnName,
      total_rows: 0,
      null_count: 0,
      null_pct: 0,
      distinct_count: 0,
      min_value: null,
      max_value: null,
      top_values: [],
      quality_score: 0,
      issues: ['No data']
    }
  }

  // Extract column values
  const values = allRows.map(r => r[columnName])
  const nullCount = values.filter(v => v === null || v === undefined || v === '').length
  const nullPct = Math.round((nullCount / totalRows) * 10000) / 100
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '')

  // Distinct count
  const distinctSet = new Set(nonNull.map(v => String(v)))
  const distinctCount = distinctSet.size

  // Min/max (works for strings and numbers)
  let minVal = null, maxVal = null
  const numericVals = nonNull.map(Number).filter(n => !isNaN(n))
  if (numericVals.length > 0) {
    minVal = String(Math.min(...numericVals))
    maxVal = String(Math.max(...numericVals))
  } else if (nonNull.length > 0) {
    const sorted = [...nonNull].map(String).sort()
    minVal = sorted[0]?.substring(0, 100)
    maxVal = sorted[sorted.length - 1]?.substring(0, 100)
  }

  // Top 5 most common values
  const freq = {}
  nonNull.forEach(v => {
    const key = String(v).substring(0, 100)
    freq[key] = (freq[key] || 0) + 1
  })
  const topValues = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([value, count]) => ({ value, count }))

  // Freshness — check if column looks like a date
  let freshnessHours = null
  if (columnName.includes('fecha') || columnName.includes('updated_at') || columnName.includes('created_at')) {
    const dates = nonNull.map(v => new Date(v)).filter(d => !isNaN(d.getTime()))
    if (dates.length > 0) {
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
      freshnessHours = Math.round((Date.now() - maxDate.getTime()) / 3600000)
    }
  }

  // Quality score calculation
  let qualityScore = 100
  const issues = []

  if (nullPct > 30) {
    qualityScore -= 20
    issues.push(`High null rate: ${nullPct}%`)
  } else if (nullPct > 10) {
    qualityScore -= 10
    issues.push(`Moderate null rate: ${nullPct}%`)
  }

  if (distinctCount === 1 && totalRows > 10) {
    qualityScore -= 15
    issues.push(`All same value: ${topValues[0]?.value}`)
  }

  if (freshnessHours !== null && freshnessHours > 48) {
    qualityScore -= 10
    issues.push(`Stale data: ${freshnessHours}h since last update`)
  }

  if (distinctCount > 0 && distinctCount < totalRows * 0.01 && totalRows > 100) {
    qualityScore -= 5
    issues.push(`Very low cardinality: ${distinctCount} distinct in ${totalRows} rows`)
  }

  // Numeric outlier check
  if (numericVals.length > 10) {
    const mean = numericVals.reduce((a, b) => a + b, 0) / numericVals.length
    const stdDev = Math.sqrt(numericVals.reduce((s, v) => s + (v - mean) ** 2, 0) / numericVals.length)
    if (stdDev > 0) {
      const outliers = numericVals.filter(v => Math.abs(v - mean) > 3 * stdDev).length
      const outlierPct = (outliers / numericVals.length) * 100
      if (outlierPct > 5) {
        qualityScore -= 5
        issues.push(`${outliers} outliers detected (${outlierPct.toFixed(1)}%)`)
      }
    }
  }

  qualityScore = Math.max(0, qualityScore)

  return {
    table_name: tableName,
    column_name: columnName,
    total_rows: totalRows,
    null_count: nullCount,
    null_pct: nullPct,
    distinct_count: distinctCount,
    min_value: minVal,
    max_value: maxVal,
    top_values: topValues,
    quality_score: qualityScore,
    issues,
    freshness_hours: freshnessHours
  }
}

// ── Main ─────────────────────────────────────────────
async function main() {
  console.log('📊 DATA QUALITY PROFILER — CRUZ Build 3')
  console.log('═'.repeat(50))
  const start = Date.now()

  const tableExists = await ensureTable()

  const tableScores = []

  for (const config of TABLES_TO_PROFILE) {
    console.log(`\n🔍 Profiling: ${config.table}`)

    // Fetch rows (up to 5000 for profiling)
    const { data: rows, error } = await supabase
      .from(config.table)
      .select('*')
      .limit(5000)

    if (error) {
      console.log(`  ❌ Error: ${error.message}`)
      tableScores.push({ table: config.table, score: 0, issues: [error.message] })
      continue
    }

    if (!rows || rows.length === 0) {
      console.log(`  ⚠️  No data`)
      tableScores.push({ table: config.table, score: 0, issues: ['Empty table'] })
      continue
    }

    console.log(`  ${rows.length} rows loaded`)

    // Profile each critical column
    const columnResults = []
    for (const col of config.critical_columns) {
      const result = await profileColumn(config.table, col, rows)
      columnResults.push(result)

      const icon = result.quality_score >= 90 ? '✅' :
                   result.quality_score >= 70 ? '🟡' : '🔴'
      console.log(`  ${icon} ${col}: ${result.quality_score}/100` +
        (result.issues.length > 0 ? ` — ${result.issues[0]}` : ''))
    }

    // Save to database
    if (tableExists) {
      // Clear previous reports for this table
      await supabase.from('data_quality_reports')
        .delete()
        .eq('table_name', config.table)

      // Insert new reports
      const inserts = columnResults.map(r => ({
        table_name: r.table_name,
        column_name: r.column_name,
        total_rows: r.total_rows,
        null_count: r.null_count,
        null_pct: r.null_pct,
        distinct_count: r.distinct_count,
        min_value: r.min_value,
        max_value: r.max_value,
        top_values: r.top_values,
        quality_score: r.quality_score,
        issues: r.issues,
      }))

      const { error: insertErr } = await supabase
        .from('data_quality_reports')
        .insert(inserts)

      if (insertErr) console.log(`  ⚠️  Save error: ${insertErr.message}`)
    }

    // Table-level score = average of column scores
    const avgScore = Math.round(
      columnResults.reduce((s, r) => s + r.quality_score, 0) / columnResults.length
    )
    const badCols = columnResults.filter(r => r.null_pct > 10)
    tableScores.push({
      table: config.table,
      score: avgScore,
      rows: rows.length,
      issues: badCols.map(c => `${c.column_name} ${c.null_pct}% null`)
    })
  }

  // ── Print summary ────────────────────────────────
  console.log('\n' + '═'.repeat(50))
  console.log('DATA QUALITY REPORT')
  console.log('═'.repeat(50))

  const lines = []
  for (const ts of tableScores) {
    const icon = ts.score >= 90 ? '🟢' : ts.score >= 70 ? '🟡' : '🔴'
    const issueStr = ts.issues.length > 0 ? ` — ${ts.issues.slice(0, 2).join(', ')}` : ''
    const line = `${icon} ${ts.table}: ${ts.score}/100${issueStr}`
    console.log(line)
    lines.push(line)
  }

  const overallScore = tableScores.length > 0
    ? Math.round(tableScores.reduce((s, t) => s + t.score, 0) / tableScores.length)
    : 0

  console.log(`\nOverall Quality Score: ${overallScore}/100`)
  console.log(`Profiled ${tableScores.length} tables in ${((Date.now() - start) / 1000).toFixed(1)}s`)

  // ── Telegram report ──────────────────────────────
  const report = `📊 <b>DATA QUALITY REPORT</b>
${new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
━━━━━━━━━━━━━━━━━━━━━

${lines.join('\n')}

<b>Overall: ${overallScore}/100</b>
Tables profiled: ${tableScores.length}
━━━━━━━━━━━━━━━━━━━━━
— CRUZ 🦀`

  await sendTG(report)
  console.log('\n✅ Report sent to Telegram')
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message)
  process.exit(1)
})
