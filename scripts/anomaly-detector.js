#!/usr/bin/env node
/**
 * CRUZ — Nightly Data Quality Anomaly Detector
 *
 * Runs after globalpc-sync completes. Compares today's data vs yesterday
 * for each client. Alerts on regressions — stays silent when healthy.
 *
 * Checks per client:
 *   1. Row count delta (traficos, entradas, aduanet_facturas)
 *   2. Expediente coverage % vs yesterday
 *   3. High-value outliers (valor > 2x rolling average)
 *   4. Duplicate pedimento numbers
 *   5. Stale traficos (missing pedimento for > 7 days)
 *
 * Alert thresholds:
 *   - > 5% regression in any metric → 🔴 Telegram alert
 *   - All stable/improving → silent (no spam)
 *
 * Logs every metric to anomaly_log table for trend analysis.
 *
 * Usage:
 *   node scripts/anomaly-detector.js              # Production
 *   node scripts/anomaly-detector.js --dry-run     # Preview, no DB writes
 *
 * Cron: 30 1 * * *  (after nightly sync at 1 AM)
 *
 * Patente 3596 · Aduana 240 · Nuevo Laredo
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { fetchAll } = require('./lib/paginate')

const SCRIPT_NAME = 'anomaly-detector'
const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'
const DELTA_THRESHOLD = 5.0 // Alert if any metric moves > 5% wrong direction
const PORTAL_DATE_FROM = '2024-01-01'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Clients to monitor — add new clients here as onboarded
const CLIENTS = ['evco']
// Uncomment when MAFESA is live:
// const CLIENTS = ['evco', 'mafesa']

// ── Helpers ──

function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function todayDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) // YYYY-MM-DD
}

async function sendTelegram(message) {
  if (DRY_RUN) { console.log('[TG dry-run]', message.replace(/<[^>]+>/g, '')); return }
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log('[TG]', message.replace(/<[^>]+>/g, '')); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' }),
    })
  } catch (e) {
    console.error('Telegram error:', e.message)
  }
}

async function logPipeline(step, status, details) {
  if (DRY_RUN) return
  await supabase.from('pipeline_log').insert({
    step: `${SCRIPT_NAME}:${step}`,
    status,
    input_summary: JSON.stringify(details),
    timestamp: new Date().toISOString(),
    ...(status === 'error' && { error_message: details?.error || JSON.stringify(details) }),
  }).catch((err) => console.error('pipeline_log error:', err.message))
}

// ── Previous value from anomaly_log ──

async function getPrevious(client, metric) {
  const { data } = await supabase
    .from('anomaly_log')
    .select('current_value')
    .eq('client', client)
    .eq('metric', metric)
    .order('check_date', { ascending: false })
    .limit(1)

  return data?.[0]?.current_value ?? null
}

// ── Log a metric result ──

async function logMetric(client, metric, currentValue, previousValue, severity, details = {}) {
  const deltaPct = previousValue != null && previousValue > 0
    ? Math.round(((currentValue - previousValue) / previousValue) * 10000) / 100
    : null

  const entry = {
    check_date: todayDate(),
    client,
    metric,
    previous_value: previousValue,
    current_value: currentValue,
    delta_pct: deltaPct,
    severity,
    details,
  }

  if (DRY_RUN) {
    console.log(`   [LOG] ${metric}: ${currentValue} (prev: ${previousValue}, delta: ${deltaPct}%, severity: ${severity})`)
    return entry
  }

  await supabase.from('anomaly_log').insert(entry)
    .catch((err) => console.error(`anomaly_log insert error: ${err.message}`))

  return entry
}

// ── Check 1: Row counts ──

async function checkRowCounts(client) {
  const tables = ['traficos', 'entradas', 'aduanet_facturas']
  const results = []

  for (const table of tables) {
    // company_id for traficos/entradas, clave_cliente for aduanet_facturas
    const filterCol = table === 'aduanet_facturas' ? 'clave_cliente' : 'company_id'
    const filterVal = table === 'aduanet_facturas' ? getClientClave(client) : client

    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq(filterCol, filterVal)

    if (error) {
      console.error(`   ❌ ${table} count failed: ${error.message}`)
      continue
    }

    const current = count || 0
    const previous = await getPrevious(client, `row_count_${table}`)
    let severity = 'ok'

    if (previous != null && previous > 0) {
      const delta = ((current - previous) / previous) * 100
      // Row count dropping > 5% is suspicious (data loss?)
      if (delta < -DELTA_THRESHOLD) severity = 'critical'
      // Row count increasing > 20% in one night is also suspicious
      else if (delta > 20) severity = 'warning'
    }

    const entry = await logMetric(client, `row_count_${table}`, current, previous, severity)
    results.push({ table, ...entry })

    const icon = severity === 'ok' ? '✅' : severity === 'warning' ? '⚠️' : '🔴'
    console.log(`   ${icon} ${table}: ${current} rows${previous != null ? ` (prev: ${previous})` : ''}`)
  }

  return results
}

// ── Check 2: Expediente coverage ──

async function checkCoverage(client) {
  // Coverage = traficos with at least one doc in expediente_documentos
  const { count: total } = await supabase
    .from('traficos')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', client)

  if (!total || total === 0) {
    await logMetric(client, 'expediente_coverage', 0, null, 'ok')
    console.log('   ✅ expediente_coverage: no traficos to check')
    return []
  }

  // Get tráfico IDs that have at least one doc
  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico_id')
    .eq('company_id', client)

  const traficoIds = (traficos || []).map(t => t.trafico_id)

  let withDocs = 0
  // Check in batches
  for (let i = 0; i < traficoIds.length; i += 200) {
    const batch = traficoIds.slice(i, i + 200)
    const { data: docs } = await supabase
      .from('expediente_documentos')
      .select('pedimento_id')
      .in('pedimento_id', batch)

    const unique = new Set((docs || []).map(d => d.pedimento_id))
    withDocs += unique.size
  }

  const coveragePct = Math.round((withDocs / total) * 10000) / 100
  const previous = await getPrevious(client, 'expediente_coverage')
  let severity = 'ok'

  if (previous != null) {
    const delta = coveragePct - previous
    if (delta < -DELTA_THRESHOLD) severity = 'critical'
  }

  const entry = await logMetric(client, 'expediente_coverage', coveragePct, previous, severity, {
    with_docs: withDocs,
    total,
  })

  const icon = severity === 'ok' ? '✅' : '🔴'
  console.log(`   ${icon} expediente_coverage: ${coveragePct}% (${withDocs} de ${total})`)

  return [{ metric: 'expediente_coverage', ...entry }]
}

// ── Check 3: High-value outliers ──

async function checkHighValueOutliers(client) {
  const filterCol = 'clave_cliente'
  const filterVal = getClientClave(client)

  // 90-day average valor_usd
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: historical } = await supabase
    .from('aduanet_facturas')
    .select('valor_usd')
    .eq(filterCol, filterVal)
    .gte('fecha_pago', ninetyDaysAgo)
    .not('valor_usd', 'is', null)

  if (!historical || historical.length < 5) {
    console.log('   ⏭️  high_value_outliers: not enough historical data')
    return []
  }

  const avg = historical.reduce((sum, r) => sum + (parseFloat(r.valor_usd) || 0), 0) / historical.length
  const threshold = avg * 2

  // Check last 24h for outliers
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: recent } = await supabase
    .from('aduanet_facturas')
    .select('id, valor_usd, pedimento, proveedor')
    .eq(filterCol, filterVal)
    .gte('created_at', oneDayAgo)
    .not('valor_usd', 'is', null)
    .gt('valor_usd', threshold)

  const outlierCount = (recent || []).length
  const severity = outlierCount > 0 ? 'warning' : 'ok'

  await logMetric(client, 'high_value_outliers', outlierCount, null, severity, {
    avg_90d_usd: Math.round(avg),
    threshold_usd: Math.round(threshold),
    outliers: (recent || []).map(r => ({
      valor_usd: r.valor_usd,
      pedimento: r.pedimento,
      proveedor: r.proveedor,
    })),
  })

  if (outlierCount > 0) {
    console.log(`   ⚠️  high_value_outliers: ${outlierCount} facturas > $${Math.round(threshold).toLocaleString()} USD (2x avg)`)
    for (const r of recent) {
      console.log(`      → $${parseFloat(r.valor_usd).toLocaleString()} USD — ${r.proveedor || 'sin proveedor'}`)
    }
  } else {
    console.log(`   ✅ high_value_outliers: none (threshold: $${Math.round(threshold).toLocaleString()} USD)`)
  }

  return outlierCount > 0 ? [{ metric: 'high_value_outliers', severity, count: outlierCount }] : []
}

// ── Check 4: Duplicate pedimento numbers ──

async function checkDuplicatePedimentos(client) {
  // Find pedimento numbers that appear more than once for this client
  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico_id, pedimento')
    .eq('company_id', client)
    .not('pedimento', 'is', null)

  if (!traficos || traficos.length === 0) {
    console.log('   ✅ duplicate_pedimentos: no pedimentos to check')
    return []
  }

  const seen = {}
  const duplicates = []

  for (const t of traficos) {
    const ped = (t.pedimento || '').trim()
    if (!ped) continue
    if (seen[ped]) {
      duplicates.push({ pedimento: ped, traficos: [seen[ped], t.trafico_id] })
    } else {
      seen[ped] = t.trafico_id
    }
  }

  const severity = duplicates.length > 0 ? 'critical' : 'ok'

  await logMetric(client, 'duplicate_pedimentos', duplicates.length, null, severity, {
    duplicates: duplicates.slice(0, 10), // Cap at 10 for log size
  })

  if (duplicates.length > 0) {
    console.log(`   🔴 duplicate_pedimentos: ${duplicates.length} duplicates found`)
    for (const d of duplicates.slice(0, 5)) {
      console.log(`      → ${d.pedimento} in ${d.traficos.join(', ')}`)
    }
  } else {
    console.log(`   ✅ duplicate_pedimentos: none`)
  }

  return duplicates.length > 0 ? [{ metric: 'duplicate_pedimentos', severity, count: duplicates.length, duplicates }] : []
}

// ── Check 5: Stale traficos (missing pedimento > 7 days) ──

async function checkStaleTraficos(client) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: stale, error } = await supabase
    .from('traficos')
    .select('trafico_id, estatus, fecha_llegada')
    .eq('company_id', client)
    .in('estatus', ['En Proceso', 'en proceso', 'EN PROCESO'])
    .is('pedimento', null)
    .lt('fecha_llegada', sevenDaysAgo)

  if (error) {
    console.error(`   ❌ stale traficos query failed: ${error.message}`)
    return []
  }

  const count = (stale || []).length
  const previous = await getPrevious(client, 'stale_traficos')
  let severity = 'ok'

  if (count > 0) severity = 'warning'
  // Getting worse = critical
  if (previous != null && count > previous && (count - previous) > 2) severity = 'critical'

  await logMetric(client, 'stale_traficos', count, previous, severity, {
    trafico_ids: (stale || []).slice(0, 20).map(t => t.trafico_id),
  })

  if (count > 0) {
    const icon = severity === 'critical' ? '🔴' : '⚠️'
    console.log(`   ${icon} stale_traficos: ${count} sin pedimento > 7 días${previous != null ? ` (prev: ${previous})` : ''}`)
  } else {
    console.log(`   ✅ stale_traficos: none`)
  }

  return count > 0 ? [{ metric: 'stale_traficos', severity, count }] : []
}

// ── Client clave mapping ──
// aduanet_facturas uses clave_cliente (numeric string), not company_id slug

function getClientClave(companyId) {
  const map = {
    evco: '9254',
    // mafesa: '<clave>' // Add when onboarded
  }
  return map[companyId] || companyId
}

// ── Main ──

async function run() {
  const startTime = Date.now()
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''

  console.log(`\n🔍 ${prefix}CRUZ — Anomaly Detector`)
  console.log(`   ${nowCST()}`)
  console.log(`   Patente 3596 · Aduana 240`)
  console.log('═'.repeat(55))

  await logPipeline('startup', 'success', { mode: DRY_RUN ? 'dry-run' : 'production', clients: CLIENTS })

  const allAlerts = []

  for (const client of CLIENTS) {
    console.log(`\n── Cliente: ${client.toUpperCase()}`)

    const rowResults = await checkRowCounts(client)
    const coverageResults = await checkCoverage(client)
    const outlierResults = await checkHighValueOutliers(client)
    const dupeResults = await checkDuplicatePedimentos(client)
    const staleResults = await checkStaleTraficos(client)

    // Collect alerts (warning + critical only)
    const clientAlerts = []

    for (const r of rowResults) {
      if (r.severity === 'critical') {
        clientAlerts.push(`🔴 <b>${r.table}</b>: rows ${r.current_value} (was ${r.previous_value}, ${r.delta_pct > 0 ? '+' : ''}${r.delta_pct}%)`)
      }
    }

    for (const r of coverageResults) {
      if (r.severity === 'critical') {
        clientAlerts.push(`🔴 <b>expediente coverage</b>: ${r.current_value}% (was ${r.previous_value}%)`)
      }
    }

    for (const r of outlierResults) {
      if (r.severity !== 'ok') {
        clientAlerts.push(`⚠️ <b>valor alto</b>: ${r.count} factura(s) > 2x promedio 90d`)
      }
    }

    for (const r of dupeResults) {
      if (r.severity !== 'ok') {
        clientAlerts.push(`🔴 <b>pedimentos duplicados</b>: ${r.count}`)
      }
    }

    for (const r of staleResults) {
      if (r.severity === 'critical') {
        clientAlerts.push(`🔴 <b>tráficos estancados</b>: ${r.count} sin pedimento > 7 días`)
      } else if (r.severity === 'warning') {
        clientAlerts.push(`⚠️ <b>tráficos estancados</b>: ${r.count} sin pedimento > 7 días`)
      }
    }

    // ── Check 6: Zombie tráficos (En Proceso > 30 days) ──
    console.log('   Check 6: zombie_traficos...')
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
    const { data: zombies } = await supabase
      .from('traficos')
      .select('trafico, fecha_llegada')
      .eq('company_id', client)
      .neq('estatus', 'Cruzado')
      .lt('fecha_llegada', thirtyDaysAgo)
      .gte('fecha_llegada', PORTAL_DATE_FROM)
      .limit(100)
    const zombieCount = zombies?.length || 0
    if (zombieCount > 0) {
      clientAlerts.push(`🟡 <b>zombies</b>: ${zombieCount} tráficos "En Proceso" > 30 días`)
      await logMetric(client, 'zombie_traficos', zombieCount, null, zombieCount > 10 ? 'warning' : 'info', { sample: zombies?.slice(0, 5) })
      console.log(`   ⚠️ zombie_traficos: ${zombieCount}`)
    } else {
      console.log(`   ✅ zombie_traficos: none`)
    }

    // ── Check 7: Missing T-MEC (from US/CA without T-MEC flag) ──
    console.log('   Check 7: missing_tmec...')
    const usTrafs = await fetchAll(supabase
      .from('traficos')
      .select('trafico, regimen, pais_procedencia')
      .eq('company_id', client)
      .gte('fecha_llegada', PORTAL_DATE_FROM)
      .in('pais_procedencia', ['US', 'USA', 'ESTADOS UNIDOS', 'CA', 'CAN', 'CANADA']))
    const missingTmec = (usTrafs || []).filter(t => {
      const r = (t.regimen || '').toUpperCase()
      return r !== 'ITE' && r !== 'ITR' && r !== 'IMD'
    })
    if (missingTmec.length > 0) {
      clientAlerts.push(`💰 <b>T-MEC faltante</b>: ${missingTmec.length} de US/CA sin régimen preferencial`)
      await logMetric(client, 'missing_tmec', missingTmec.length, null, 'warning', { sample: missingTmec.slice(0, 5).map(t => t.trafico) })
      console.log(`   ⚠️ missing_tmec: ${missingTmec.length}`)
    } else {
      console.log(`   ✅ missing_tmec: none`)
    }

    // ── Check 8: Duplicate descriptions on same day (double entry) ──
    console.log('   Check 8: duplicate_descriptions...')
    const recentTrafs = await fetchAll(supabase
      .from('traficos')
      .select('trafico, descripcion_mercancia, fecha_llegada')
      .eq('company_id', client)
      .gte('fecha_llegada', new Date(Date.now() - 30 * 86400000).toISOString()))
    const dayDescMap = new Map()
    const dupDescs = []
    for (const t of (recentTrafs || [])) {
      const day = (t.fecha_llegada || '').split('T')[0]
      const desc = (t.descripcion_mercancia || '').toLowerCase().trim()
      if (!day || !desc) continue
      const key = `${day}:${desc}`
      if (dayDescMap.has(key)) {
        dupDescs.push({ trafico: t.trafico, dup_of: dayDescMap.get(key), day, desc: desc.substring(0, 40) })
      } else {
        dayDescMap.set(key, t.trafico)
      }
    }
    if (dupDescs.length > 0) {
      clientAlerts.push(`⚠️ <b>posible doble entrada</b>: ${dupDescs.length} con misma descripción en mismo día`)
      await logMetric(client, 'duplicate_descriptions', dupDescs.length, null, 'info', { sample: dupDescs.slice(0, 5) })
      console.log(`   ⚠️ duplicate_descriptions: ${dupDescs.length}`)
    } else {
      console.log(`   ✅ duplicate_descriptions: none`)
    }

    if (clientAlerts.length > 0) {
      allAlerts.push({ client, alerts: clientAlerts })
    }
  }

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n' + '═'.repeat(55))

  await logPipeline('complete', allAlerts.length > 0 ? 'partial' : 'success', {
    clients_checked: CLIENTS.length,
    alerts: allAlerts.length,
    duration_s: parseFloat(elapsed),
  })

  // Telegram — only if there are alerts (no spam when healthy)
  if (allAlerts.length > 0) {
    const lines = [
      `🚨 <b>ANOMALY DETECTOR — ALERTA</b>`,
      `${nowCST()}`,
      '',
    ]

    for (const { client, alerts } of allAlerts) {
      lines.push(`<b>${client.toUpperCase()}</b>:`)
      for (const a of alerts) lines.push(`  ${a}`)
      lines.push('')
    }

    lines.push(`— CRUZ 🦀`)
    await sendTelegram(lines.join('\n'))
    console.log(`\n⚠️  ${allAlerts.reduce((n, a) => n + a.alerts.length, 0)} anomalía(s) detectada(s) — alerta enviada`)

    // Log to Operational Brain
    try {
      const { logDecision } = require('./decision-logger')
      const totalAnomalies = allAlerts.reduce((n, a) => n + a.alerts.length, 0)
      await logDecision({ decision_type: 'anomaly_resolution', decision: `${totalAnomalies} anomalías detectadas`, reasoning: allAlerts.map(a => `${a.client}: ${a.alerts.map(al => al.metric).join(', ')}`).join('; ') })
    } catch {}
  } else {
    console.log(`\n✅ Sin anomalías. Duración: ${elapsed}s`)
  }
}

run().catch(async (err) => {
  console.error('Fatal:', err)
  await logPipeline('fatal', 'error', { error: err.message })
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
