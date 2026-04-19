#!/usr/bin/env node
/**
 * PORTAL · Morning Revenue Alert
 *
 * Fires daily at 8 AM America/Chicago (PM2 cron).
 * Sends Tito a Spanish snapshot:
 *   "Buenos días, patrón. Ayer: N pedimentos cruzados, ~$X MXN.
 *    Mes al día: N pedimentos, ~$X MXN. Vs mes anterior: ±%."
 *
 * Counts are real (pedimentos table). Fees are ESTIMATED at $125 std /
 * $400 IMMEX in USD, converted via the live Banxico rate from
 * system_config. When estimator is the only source, the message says so.
 *
 * Operational resilience (per .claude/rules/operational-resilience.md):
 *   - Logs every run to pipeline_log
 *   - Fires red Telegram on failure
 *   - Exits non-zero on failure so PM2 / cron sees it
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'morning-revenue-alert'
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// ─── Telegram ───────────────────────────────────────────────
async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG silent]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  if (!TELEGRAM_TOKEN) {
    console.log('[TG skip]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function logPipeline(step, status, details, durationMs) {
  const entry = {
    step: `${SCRIPT_NAME}:${step}`,
    status,
    input_summary: typeof details === 'string' ? details : JSON.stringify(details),
    timestamp: new Date().toISOString(),
    ...(durationMs != null && { duration_ms: durationMs }),
    ...(status === 'error' && {
      error_message: typeof details === 'object' ? (details.error || JSON.stringify(details)) : details,
    }),
  }
  await supabase.from('pipeline_log').insert(entry).then(({ error }) => {
    if (error) console.error('pipeline_log insert error:', error.message)
  })
}

// ─── Fee estimator (same constants as src/lib/revenue/estimator.ts) ──
const IMMEX_CLAVES = new Set(['IN', 'IMD', 'ITE', 'ITR', 'RT', 'AF', 'BM', 'F4', 'IM'])
const FEE_USD_STANDARD = 125
const FEE_USD_IMMEX = 400

function estimateFeeUSD(clavePedimento) {
  if (!clavePedimento) return FEE_USD_STANDARD
  return IMMEX_CLAVES.has(String(clavePedimento).trim().toUpperCase()) ? FEE_USD_IMMEX : FEE_USD_STANDARD
}

// ─── Date helpers (America/Chicago for "ayer" cutoff) ──────
function chicagoTodayBounds() {
  // Compute "today in Chicago" bounds in UTC ISO
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' })
  const todayStr = fmt.format(new Date()) // YYYY-MM-DD
  // Today 00:00 Chicago — represented as the same wall-clock midnight in CST/CDT, then converted to UTC.
  // Easier: use a Date constructed in UTC then offset by Chicago offset for that day.
  // Simpler approach: midnight UTC of todayStr, then push back by 6h (CST) or 5h (CDT). The DST offset
  // varies; instead compute by parsing a date at noon Chicago then anchoring.
  const chicagoNoon = new Date(`${todayStr}T12:00:00-06:00`) // assume CST baseline; DST corrected next
  // Compute the Chicago offset for this date by comparing
  const chicagoString = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', timeZoneName: 'short',
  }).format(chicagoNoon)
  const isCDT = /CDT/.test(chicagoString)
  const offsetH = isCDT ? 5 : 6
  const startUTC = new Date(`${todayStr}T00:00:00Z`)
  startUTC.setUTCHours(startUTC.getUTCHours() + offsetH)
  const endUTC = new Date(startUTC); endUTC.setUTCDate(endUTC.getUTCDate() + 1)
  const yesterdayStartUTC = new Date(startUTC); yesterdayStartUTC.setUTCDate(yesterdayStartUTC.getUTCDate() - 1)
  return { yesterdayStartUTC, todayStartUTC: startUTC, tomorrowStartUTC: endUTC, todayStr }
}

function ymKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function pedimentoMonth(p) {
  const raw = p.fecha_pago || p.fecha_entrada || p.updated_at
  if (!raw) return null
  const d = new Date(raw)
  if (isNaN(d.getTime())) return null
  return ymKey(d)
}

// ─── Exchange rate ─────────────────────────────────────────
async function fetchExchangeRate() {
  try {
    const { data } = await supabase
      .from('system_config').select('value, valid_to').eq('key', 'banxico_exchange_rate').single()
    if (!data) return { rate: 20, source: 'fallback (no row)' }
    if (data.valid_to && new Date(data.valid_to) < new Date()) {
      return { rate: Number(data.value?.rate ?? data.value) || 20, source: 'EXPIRED' }
    }
    return { rate: Number(data.value?.rate ?? data.value) || 20, source: 'system_config' }
  } catch (e) {
    return { rate: 20, source: `error: ${e.message}` }
  }
}

// ─── Money formatting ──────────────────────────────────────
function fmtMXN(amount) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(amount)
}
function fmtNum(n) {
  return new Intl.NumberFormat('es-MX').format(Math.round(n))
}
function fmtPct(p) {
  if (p === null || !Number.isFinite(p)) return 's/d'
  const sign = p > 0 ? '+' : ''
  return `${sign}${p.toFixed(1)}%`
}

// ─── Main ──────────────────────────────────────────────────
async function run() {
  const startTime = Date.now()
  await logPipeline('start', 'started', '8 AM revenue snapshot')

  const bounds = chicagoTodayBounds()
  const { rate, source: rateSource } = await fetchExchangeRate()

  // Pull last ~70 days of pedimentos (covers MTD + prior month + yesterday in one query)
  const lookback = new Date(bounds.todayStartUTC); lookback.setUTCDate(lookback.getUTCDate() - 70)

  const { data: peds, error } = await supabase
    .from('pedimentos')
    .select('clave_pedimento, updated_at, fecha_pago, fecha_entrada')
    .gte('updated_at', lookback.toISOString())
    .limit(20000)

  if (error) throw new Error(`pedimentos query failed: ${error.message}`)

  // Freshness check — if most-recent pedimento is older than 2 days,
  // flag it so Tito doesn't think "0 pedimentos" means a quiet day.
  let freshnessLine = null
  const mostRecent = (peds || []).reduce((acc, p) => {
    const ts = p.fecha_pago || p.fecha_entrada || p.updated_at
    if (!ts) return acc
    const t = new Date(ts).getTime()
    return t > acc ? t : acc
  }, 0)
  if (mostRecent > 0) {
    const ageHours = (Date.now() - mostRecent) / 3_600_000
    if (ageHours > 48) {
      const days = Math.floor(ageHours / 24)
      freshnessLine = `⚠ <b>Datos pendientes de sincronizar</b> · último pedimento registrado hace ${days} día${days === 1 ? '' : 's'}. La cifra de "ayer" puede subir cuando sincronice.`
    }
  } else {
    freshnessLine = `⚠ Sin pedimentos en los últimos 70 días.`
  }

  // Bucket: yesterday | MTD current | MTD prior month
  const currentMonth = ymKey(bounds.todayStartUTC)
  const priorMonthDate = new Date(bounds.todayStartUTC); priorMonthDate.setUTCMonth(priorMonthDate.getUTCMonth() - 1)
  const priorMonth = ymKey(priorMonthDate)

  let yestCount = 0, yestUSD = 0
  let mtdCount = 0, mtdUSD = 0
  let priorMtdCount = 0, priorMtdUSD = 0

  // For the prior-month MTD comparison: count only days 1..(today's day) of the prior month
  const todayChicagoDay = Number(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', day: '2-digit',
  }).format(new Date()))

  for (const p of (peds || [])) {
    const m = pedimentoMonth(p)
    if (!m) continue
    const fee = estimateFeeUSD(p.clave_pedimento)

    // Yesterday (Chicago)
    const tsRaw = p.fecha_pago || p.fecha_entrada || p.updated_at
    if (tsRaw) {
      const ts = new Date(tsRaw)
      if (ts >= bounds.yesterdayStartUTC && ts < bounds.todayStartUTC) {
        yestCount++; yestUSD += fee
      }
    }

    // MTD current month
    if (m === currentMonth) { mtdCount++; mtdUSD += fee }

    // MTD-equivalent of prior month (same calendar-day window)
    if (m === priorMonth && tsRaw) {
      const dayOfMonth = new Date(tsRaw).getUTCDate()
      if (dayOfMonth <= todayChicagoDay) { priorMtdCount++; priorMtdUSD += fee }
    }
  }

  const yestMXN = yestUSD * rate
  const mtdMXN = mtdUSD * rate
  const priorMtdMXN = priorMtdUSD * rate

  const momPct = priorMtdCount === 0 ? null : ((mtdCount - priorMtdCount) / priorMtdCount) * 100
  const direction = momPct === null ? '' : (momPct > 0 ? '⬆' : momPct < 0 ? '⬇' : '→')

  // Compose Spanish message — tone: co-owner brief, not corporate report
  const lines = [
    `<b>Buenos días, patrón.</b> 🦞`,
    ``,
    `<b>Ayer:</b> ${fmtNum(yestCount)} pedimentos cruzados · ~${fmtMXN(yestMXN)}`,
    `<b>Mes al día:</b> ${fmtNum(mtdCount)} pedimentos · ~${fmtMXN(mtdMXN)}`,
    `<b>Vs mes anterior (MTD):</b> ${fmtNum(priorMtdCount)} → ${fmtNum(mtdCount)} ${direction} ${fmtPct(momPct)}`,
    ...(freshnessLine ? [``, freshnessLine] : []),
    ``,
    `<i>Estimación: $125 estándar / $400 IMMEX USD por pedimento. TC ${rate.toFixed(4)} (${rateSource}).</i>`,
  ]

  const msg = lines.join('\n')
  console.log('---')
  console.log(msg.replace(/<[^>]+>/g, ''))
  console.log('---')

  await tg(msg)

  const durationMs = Date.now() - startTime
  await logPipeline('run', 'success', {
    yest_count: yestCount, yest_mxn: Math.round(yestMXN),
    mtd_count: mtdCount, mtd_mxn: Math.round(mtdMXN),
    prior_mtd_count: priorMtdCount, prior_mtd_mxn: Math.round(priorMtdMXN),
    mom_pct: momPct, rate, rate_source: rateSource,
  }, durationMs)
}

run().catch(async (err) => {
  console.error(err)
  await logPipeline('run', 'error', { error: err.message }, null)
  await tg(`🔴 <b>${SCRIPT_NAME} FAILED</b>\n${err.message}\n— PORTAL 🦞`)
  process.exit(1)
})
