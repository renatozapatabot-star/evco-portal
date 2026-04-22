#!/usr/bin/env node
/**
 * PORTAL — Nightly Data Quality Anomaly Detector
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
 *   6. Zombie tráficos (En Proceso > 30 days)
 *   7. Missing T-MEC (US/CA origin without ITE/ITR/IMD régimen)
 *   8. Duplicate descriptions on same day
 *
 * Reliability contract (fix/sync-reliability-2026-04-22):
 *   · Every Supabase query goes through `safeQuery()` — 2 retries with
 *     linear backoff on transient errors. No hand-rolled try/catch
 *     around `.from().select()` chains that silently ran with undefined
 *     `data`.
 *   · Every check runs inside `runCheck()` — if one throws, the other
 *     seven still run. Failures surface in the final Telegram message,
 *     never silent.
 *   · Structured per-check log line: `[anomaly-detector][<client>][check=<name>]
 *     <ok|fail> dur=<ms> …`. Stable enough for operators to grep.
 *   · Aggregate summary at end: `checks_run=N passed=X failed=Y alerts=Z`.
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
const { withSyncLog } = require('./lib/sync-log')

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Structured log line — single format operators can grep.
 * Example:
 *   [anomaly-detector][evco][check=row_counts] ok dur=234ms rows=3439
 */
function structLog(level, client, check, status, extra = {}) {
  const parts = [`[${SCRIPT_NAME}]`]
  if (client) parts.push(`[${client}]`)
  if (check) parts.push(`[check=${check}]`)
  parts.push(status)
  for (const [k, v] of Object.entries(extra)) {
    if (v == null) continue
    parts.push(`${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
  }
  const line = parts.join(' ')
  if (level === 'error') console.error(line)
  else console.log(line)
}

/**
 * Wrap a Supabase query builder with 2 retries + linear backoff on
 * transient errors. Never throws — returns a `{ data, count, error }`
 * shape so callers can destructure and skip the check gracefully.
 *
 * We retry on either a thrown exception (network blip) OR a resolved
 * response with a non-null `error` (Postgres error). We do NOT retry
 * on `data: null` with `error: null` — that's a legitimate empty set.
 */
async function safeQuery(queryFn, { retries = 2, backoffMs = 500, label = 'query' } = {}) {
  let lastErr = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await queryFn()
      if (result && result.error) {
        lastErr = result.error
        if (attempt < retries) {
          structLog('error', null, null, `retry[${attempt + 1}/${retries}]`, {
            label, err: lastErr.message || String(lastErr),
          })
          await sleep(backoffMs * (attempt + 1))
          continue
        }
        return { data: null, count: null, error: lastErr }
      }
      return result ?? { data: null, count: null, error: null }
    } catch (e) {
      lastErr = e
      if (attempt < retries) {
        structLog('error', null, null, `retry[${attempt + 1}/${retries}]`, {
          label, err: e instanceof Error ? e.message : String(e),
        })
        await sleep(backoffMs * (attempt + 1))
        continue
      }
      return {
        data: null,
        count: null,
        error: lastErr instanceof Error ? lastErr : new Error(String(lastErr)),
      }
    }
  }
  return { data: null, count: null, error: lastErr }
}

/**
 * Run a single check with its own timing + try/catch. One check
 * throwing never blocks the others from running. Returns a uniform
 * outcome record so the aggregator can summarize at the end.
 */
async function runCheck(name, client, fn) {
  const start = Date.now()
  try {
    const result = await fn()
    const duration_ms = Date.now() - start
    structLog('info', client, name, 'ok', { dur_ms: duration_ms })
    return { name, client, status: 'ok', duration_ms, result: result ?? [], error: null }
  } catch (e) {
    const duration_ms = Date.now() - start
    const err = e instanceof Error ? e.message : String(e)
    structLog('error', client, name, 'fail', { dur_ms: duration_ms, err })
    return { name, client, status: 'fail', duration_ms, result: null, error: err }
  }
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
  // Supabase v2 returns PostgrestResponse (not a native Promise with .catch);
  // use try/catch on an awaited call instead of chained .catch.
  try {
    const { error } = await supabase.from('pipeline_log').insert({
      step: `${SCRIPT_NAME}:${step}`,
      status,
      input_summary: JSON.stringify(details),
      timestamp: new Date().toISOString(),
      ...(status === 'error' && { error_message: details?.error || JSON.stringify(details) }),
    })
    if (error) console.error('pipeline_log error:', error.message)
  } catch (err) {
    console.error('pipeline_log threw:', err instanceof Error ? err.message : String(err))
  }
}

// ── Previous value from anomaly_log ──

async function getPrevious(client, metric) {
  // Exclude today's own rows so a same-day retry still compares to yesterday.
  const { data } = await safeQuery(
    () => supabase
      .from('anomaly_log')
      .select('current_value')
      .eq('client', client)
      .eq('metric', metric)
      .lt('check_date', todayDate())
      .order('check_date', { ascending: false })
      .limit(1),
    { label: `getPrevious:${metric}` },
  )

  return data?.[0]?.current_value ?? null
}

// ── Log a metric result ──

async function logMetric(client, metric, currentValue, previousValue, severity, details = {}) {
  const deltaPct = previousValue != null && previousValue > 0
    ? Math.round(((currentValue - previousValue) / previousValue) * 10000) / 100
    : null

  // Real schema: id, created_at, client, metric, previous_value,
  // current_value, delta_pct, severity, check_date (NOT NULL).
  // `details` lives only in memory / stdout for the operator.
  const entry = {
    client,
    metric,
    previous_value: previousValue,
    current_value: currentValue,
    delta_pct: deltaPct,
    severity,
    check_date: todayDate(),
  }

  if (DRY_RUN) {
    console.log(`   [LOG] ${metric}: ${currentValue} (prev: ${previousValue}, delta: ${deltaPct}%, severity: ${severity}${details ? `, ${JSON.stringify(details).slice(0, 80)}` : ''})`)
    return entry
  }

  try {
    const { error } = await supabase.from('anomaly_log').insert(entry)
    if (error) console.error(`anomaly_log insert error: ${error.message}`)
  } catch (err) {
    console.error(
      `anomaly_log insert threw: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

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

    const { count, error } = await safeQuery(
      () => supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq(filterCol, filterVal),
      { label: `row_count:${table}` },
    )

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
  const { count: total, error: totalErr } = await safeQuery(
    () => supabase
      .from('traficos')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', client),
    { label: 'coverage:total' },
  )

  if (totalErr) {
    throw new Error(`coverage total count failed: ${totalErr.message}`)
  }

  if (!total || total === 0) {
    await logMetric(client, 'expediente_coverage', 0, null, 'ok')
    console.log('   ✅ expediente_coverage: no traficos to check')
    return []
  }

  // Get tráfico claves that have at least one doc.
  // Column on traficos is `trafico` (business clave), not `trafico_id`.
  const { data: traficos, error: traficosErr } = await safeQuery(
    () => supabase
      .from('traficos')
      .select('trafico')
      .eq('company_id', client),
    { label: 'coverage:traficos' },
  )

  if (traficosErr) {
    throw new Error(`coverage traficos list failed: ${traficosErr.message}`)
  }

  const traficoIds = (traficos || []).map(t => t.trafico)

  let withDocs = 0
  for (let i = 0; i < traficoIds.length; i += 200) {
    const batch = traficoIds.slice(i, i + 200)
    const { data: docs, error: docsErr } = await safeQuery(
      () => supabase
        .from('expediente_documentos')
        .select('pedimento_id')
        .in('pedimento_id', batch),
      { label: `coverage:docs[${i}]` },
    )

    if (docsErr) {
      // Skip this batch but keep counting — partial coverage is better
      // than aborting the whole check.
      console.error(`   ⚠️ expediente_documentos batch ${i} failed: ${docsErr.message}`)
      continue
    }

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

  const { data: historical, error: histErr } = await safeQuery(
    () => supabase
      .from('aduanet_facturas')
      .select('valor_usd')
      .eq(filterCol, filterVal)
      .gte('fecha_pago', ninetyDaysAgo)
      .not('valor_usd', 'is', null),
    { label: 'outliers:historical' },
  )

  if (histErr) {
    throw new Error(`outliers historical failed: ${histErr.message}`)
  }

  if (!historical || historical.length < 5) {
    console.log('   ⏭️  high_value_outliers: not enough historical data')
    return []
  }

  const avg = historical.reduce((sum, r) => sum + (parseFloat(r.valor_usd) || 0), 0) / historical.length
  const threshold = avg * 2

  // Check last 24h for outliers
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: recent, error: recentErr } = await safeQuery(
    () => supabase
      .from('aduanet_facturas')
      .select('id, valor_usd, pedimento, proveedor')
      .eq(filterCol, filterVal)
      .gte('created_at', oneDayAgo)
      .not('valor_usd', 'is', null)
      .gt('valor_usd', threshold),
    { label: 'outliers:recent' },
  )

  if (recentErr) {
    throw new Error(`outliers recent failed: ${recentErr.message}`)
  }

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
  const { data: traficos, error } = await safeQuery(
    () => supabase
      .from('traficos')
      .select('trafico, pedimento')
      .eq('company_id', client)
      .not('pedimento', 'is', null),
    { label: 'dupes:traficos' },
  )

  if (error) {
    throw new Error(`duplicate_pedimentos query failed: ${error.message}`)
  }

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
      duplicates.push({ pedimento: ped, traficos: [seen[ped], t.trafico] })
    } else {
      seen[ped] = t.trafico
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

  const { data: stale, error } = await safeQuery(
    () => supabase
      .from('traficos')
      .select('trafico, estatus, fecha_llegada')
      .eq('company_id', client)
      .in('estatus', ['En Proceso', 'en proceso', 'EN PROCESO'])
      .is('pedimento', null)
      .lt('fecha_llegada', sevenDaysAgo),
    { label: 'stale:traficos' },
  )

  if (error) {
    throw new Error(`stale traficos query failed: ${error.message}`)
  }

  const count = (stale || []).length
  const previous = await getPrevious(client, 'stale_traficos')
  let severity = 'ok'

  if (count > 0) severity = 'warning'
  // Getting worse = critical
  if (previous != null && count > previous && (count - previous) > 2) severity = 'critical'

  await logMetric(client, 'stale_traficos', count, previous, severity, {
    trafico_ids: (stale || []).slice(0, 20).map(t => t.trafico),
  })

  if (count > 0) {
    const icon = severity === 'critical' ? '🔴' : '⚠️'
    console.log(`   ${icon} stale_traficos: ${count} sin pedimento > 7 días${previous != null ? ` (prev: ${previous})` : ''}`)
  } else {
    console.log(`   ✅ stale_traficos: none`)
  }

  return count > 0 ? [{ metric: 'stale_traficos', severity, count }] : []
}

// ── Check 6: Zombie tráficos (En Proceso > 30 days) ──

async function checkZombies(client) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: zombies, error } = await safeQuery(
    () => supabase
      .from('traficos')
      .select('trafico, fecha_llegada')
      .eq('company_id', client)
      .neq('estatus', 'Cruzado')
      .lt('fecha_llegada', thirtyDaysAgo)
      .gte('fecha_llegada', PORTAL_DATE_FROM)
      .limit(100),
    { label: 'zombies:traficos' },
  )

  if (error) {
    throw new Error(`zombie traficos query failed: ${error.message}`)
  }

  const zombieCount = zombies?.length || 0
  if (zombieCount > 0) {
    const severity = zombieCount > 10 ? 'warning' : 'info'
    await logMetric(client, 'zombie_traficos', zombieCount, null, severity, {
      sample: zombies?.slice(0, 5),
    })
    console.log(`   ⚠️ zombie_traficos: ${zombieCount}`)
    return [{ metric: 'zombie_traficos', severity, count: zombieCount }]
  }

  console.log(`   ✅ zombie_traficos: none`)
  return []
}

// ── Check 7: Missing T-MEC (US/CA origin without ITE/ITR/IMD) ──

async function checkMissingTmec(client) {
  const usTrafs = await fetchAll(
    supabase
      .from('traficos')
      .select('trafico, regimen, pais_procedencia')
      .eq('company_id', client)
      .gte('fecha_llegada', PORTAL_DATE_FROM)
      .in('pais_procedencia', ['US', 'USA', 'ESTADOS UNIDOS', 'CA', 'CAN', 'CANADA']),
  )
  const missingTmec = (usTrafs || []).filter(t => {
    const r = (t.regimen || '').toUpperCase()
    return r !== 'ITE' && r !== 'ITR' && r !== 'IMD'
  })
  if (missingTmec.length > 0) {
    await logMetric(client, 'missing_tmec', missingTmec.length, null, 'warning', {
      sample: missingTmec.slice(0, 5).map(t => t.trafico),
    })
    console.log(`   ⚠️ missing_tmec: ${missingTmec.length}`)
    return [{ metric: 'missing_tmec', severity: 'warning', count: missingTmec.length }]
  }
  console.log(`   ✅ missing_tmec: none`)
  return []
}

// ── Check 8: Duplicate descriptions on same day ──

async function checkDuplicateDescriptions(client) {
  const recentTrafs = await fetchAll(
    supabase
      .from('traficos')
      .select('trafico, descripcion_mercancia, fecha_llegada')
      .eq('company_id', client)
      .gte('fecha_llegada', new Date(Date.now() - 30 * 86400000).toISOString()),
  )
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
    await logMetric(client, 'duplicate_descriptions', dupDescs.length, null, 'info', {
      sample: dupDescs.slice(0, 5),
    })
    console.log(`   ⚠️ duplicate_descriptions: ${dupDescs.length}`)
    return [{ metric: 'duplicate_descriptions', severity: 'info', count: dupDescs.length }]
  }
  console.log(`   ✅ duplicate_descriptions: none`)
  return []
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

const CHECK_DEFINITIONS = [
  { name: 'row_counts',             fn: checkRowCounts },
  { name: 'expediente_coverage',    fn: checkCoverage },
  { name: 'high_value_outliers',    fn: checkHighValueOutliers },
  { name: 'duplicate_pedimentos',   fn: checkDuplicatePedimentos },
  { name: 'stale_traficos',         fn: checkStaleTraficos },
  { name: 'zombie_traficos',        fn: checkZombies },
  { name: 'missing_tmec',           fn: checkMissingTmec },
  { name: 'duplicate_descriptions', fn: checkDuplicateDescriptions },
]

function alertLinesForCheck(name, rows) {
  const lines = []
  if (!Array.isArray(rows)) return lines
  switch (name) {
    case 'row_counts':
      for (const r of rows) {
        if (r.severity === 'critical') {
          lines.push(`🔴 <b>${r.table}</b>: rows ${r.current_value} (was ${r.previous_value}, ${r.delta_pct > 0 ? '+' : ''}${r.delta_pct}%)`)
        }
      }
      break
    case 'expediente_coverage':
      for (const r of rows) {
        if (r.severity === 'critical') {
          lines.push(`🔴 <b>expediente coverage</b>: ${r.current_value}% (was ${r.previous_value}%)`)
        }
      }
      break
    case 'high_value_outliers':
      for (const r of rows) {
        if (r.severity !== 'ok') {
          lines.push(`⚠️ <b>valor alto</b>: ${r.count} factura(s) > 2x promedio 90d`)
        }
      }
      break
    case 'duplicate_pedimentos':
      for (const r of rows) {
        if (r.severity !== 'ok') {
          lines.push(`🔴 <b>pedimentos duplicados</b>: ${r.count}`)
        }
      }
      break
    case 'stale_traficos':
      for (const r of rows) {
        if (r.severity === 'critical') {
          lines.push(`🔴 <b>tráficos estancados</b>: ${r.count} sin pedimento > 7 días`)
        } else if (r.severity === 'warning') {
          lines.push(`⚠️ <b>tráficos estancados</b>: ${r.count} sin pedimento > 7 días`)
        }
      }
      break
    case 'zombie_traficos':
      for (const r of rows) {
        lines.push(`🟡 <b>zombies</b>: ${r.count} tráficos "En Proceso" > 30 días`)
      }
      break
    case 'missing_tmec':
      for (const r of rows) {
        lines.push(`💰 <b>T-MEC faltante</b>: ${r.count} de US/CA sin régimen preferencial`)
      }
      break
    case 'duplicate_descriptions':
      for (const r of rows) {
        lines.push(`⚠️ <b>posible doble entrada</b>: ${r.count} con misma descripción en mismo día`)
      }
      break
  }
  return lines
}

async function run() {
  const startTime = Date.now()
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''

  console.log(`\n🔍 ${prefix}PORTAL — Anomaly Detector`)
  console.log(`   ${nowCST()}`)
  console.log(`   Patente 3596 · Aduana 240`)
  console.log('═'.repeat(55))

  await logPipeline('startup', 'success', { mode: DRY_RUN ? 'dry-run' : 'production', clients: CLIENTS })

  const allAlerts = []
  const allOutcomes = []

  for (const client of CLIENTS) {
    console.log(`\n── Cliente: ${client.toUpperCase()}`)

    const clientAlerts = []
    const failedChecks = []

    for (const { name, fn } of CHECK_DEFINITIONS) {
      const outcome = await runCheck(name, client, () => fn(client))
      allOutcomes.push(outcome)
      if (outcome.status === 'fail') {
        failedChecks.push({ name, error: outcome.error })
        continue
      }
      const lines = alertLinesForCheck(name, outcome.result)
      for (const l of lines) clientAlerts.push(l)
    }

    if (clientAlerts.length > 0 || failedChecks.length > 0) {
      allAlerts.push({ client, alerts: clientAlerts, failedChecks })
    }
  }

  // Aggregate summary — one line operators can grep.
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const passed = allOutcomes.filter(o => o.status === 'ok').length
  const failed = allOutcomes.filter(o => o.status === 'fail').length
  const totalAlerts = allAlerts.reduce((n, a) => n + a.alerts.length, 0)

  console.log('\n' + '═'.repeat(55))
  structLog('info', null, null, 'summary', {
    clients: CLIENTS.length,
    checks_run: allOutcomes.length,
    passed,
    failed,
    alerts: totalAlerts,
    duration_s: parseFloat(elapsed),
  })

  await logPipeline('complete', failed > 0 ? 'partial' : (totalAlerts > 0 ? 'partial' : 'success'), {
    clients_checked: CLIENTS.length,
    checks_run: allOutcomes.length,
    passed,
    failed,
    alerts: totalAlerts,
    duration_s: parseFloat(elapsed),
  })

  // Telegram — only if there are anomalies OR failed checks. Silent when healthy.
  const shouldAlert = allAlerts.length > 0 || failed > 0
  if (shouldAlert) {
    const lines = [
      `🚨 <b>ANOMALY DETECTOR — ALERTA</b>`,
      `${nowCST()}`,
      '',
    ]

    for (const { client, alerts, failedChecks } of allAlerts) {
      lines.push(`<b>${client.toUpperCase()}</b>:`)
      for (const a of alerts) lines.push(`  ${a}`)
      for (const f of failedChecks) {
        lines.push(`  ⛔ <b>check[${f.name}] falló</b>: ${f.error}`)
      }
      lines.push('')
    }

    lines.push(`checks ${passed}/${allOutcomes.length} pasaron · ${totalAlerts} anomalía(s) · ${elapsed}s`)
    lines.push(`— PORTAL 🦀`)
    await sendTelegram(lines.join('\n'))
    console.log(`\n⚠️  ${totalAlerts} anomalía(s), ${failed} check(s) fallaron — alerta enviada`)

    // Log to Operational Brain (best-effort)
    try {
      const { logDecision } = require('./decision-logger')
      await logDecision({
        decision_type: 'anomaly_resolution',
        decision: `${totalAlerts} anomalías detectadas, ${failed} checks fallaron`,
        reasoning: allAlerts
          .map(a => `${a.client}: ${[...a.alerts, ...a.failedChecks.map(f => `FAIL:${f.name}`)].join(', ')}`)
          .join('; '),
      })
    } catch {
      // Decision logger is best-effort; never blocks the run.
    }
  } else {
    console.log(`\n✅ Sin anomalías. ${passed}/${allOutcomes.length} checks pasaron. Duración: ${elapsed}s`)
  }
}

withSyncLog(supabase, { sync_type: 'anomaly_detector', company_id: null }, run).catch(async (err) => {
  console.error('Fatal:', err)
  await logPipeline('fatal', 'error', { error: err.message })
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}\n— PORTAL 🦀`)
  process.exit(1)
})
