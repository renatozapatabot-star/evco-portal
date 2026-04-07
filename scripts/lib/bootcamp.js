// scripts/lib/bootcamp.js
// Shared infrastructure for CRUZ Intelligence Bootcamp scripts.
// Consolidates: Supabase init, Telegram, heartbeat, batch fetch,
// upsert chunking, checkpoint/resume, cost tracking, CLI flags.

const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const TELEGRAM_CHAT = '-5085543275'

// ── CLI flag parsing ────────────────────────────────────────────────────────

function parseArgs() {
  const argv = process.argv
  return {
    dryRun: argv.includes('--dry-run'),
    incremental: argv.includes('--incremental'),
    limit: parseInt(argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || 0,
    offset: parseInt(argv.find(a => a.startsWith('--offset='))?.split('=')[1] || '0') || 0,
    company: argv.find(a => a.startsWith('--company='))?.split('=')[1] || null,
    batchSize: parseInt(argv.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '1000') || 1000,
    costCap: parseFloat(argv.find(a => a.startsWith('--cost-cap='))?.split('=')[1] || '0') || 0,
    mode: argv.find(a => a.startsWith('--mode='))?.split('=')[1] || null,
    trafico: argv.find(a => a.startsWith('--trafico='))?.split('=')[1] || null,
    scenario: argv.find(a => a.startsWith('--scenario='))?.split('=')[1] || null,
    target: argv.find(a => a.startsWith('--target='))?.split('=')[1] || null,
    change: (() => {
      const raw = argv.find(a => a.startsWith('--change='))?.split('=').slice(1).join('=')
      if (!raw) return null
      try { return JSON.parse(raw) } catch { return null }
    })(),
  }
}

// ── Init ────────────────────────────────────────────────────────────────────

function initBootcamp(scriptName) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const args = parseArgs()

  async function sendTelegram(msg) {
    if (process.env.TELEGRAM_SILENT === 'true') return
    if (!TELEGRAM_TOKEN) { console.log('[TG skip]', msg); return }
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
    }).catch(e => console.error('Telegram error:', e.message))
  }

  async function logHeartbeat(status, details) {
    await supabase.from('heartbeat_log').insert({
      script: scriptName,
      status,
      details,
    }).then(() => {}, () => {})
  }

  return { supabase, sendTelegram, logHeartbeat, args }
}

// ── Batch fetch with Supabase .range() pagination ───────────────────────────

async function fetchBatched(supabase, table, selectCols, filters = {}, batchSize = 1000) {
  const rows = []
  let offset = 0

  while (true) {
    let query = supabase.from(table).select(selectCols)

    for (const [key, value] of Object.entries(filters)) {
      if (value === null) {
        query = query.is(key, null)
      } else if (typeof value === 'object' && value.op) {
        // Support { op: 'gte', value: '2024-01-01' }
        query = query[value.op](key, value.value)
      } else {
        query = query.eq(key, value)
      }
    }

    const { data, error } = await query.range(offset, offset + batchSize - 1)

    if (error) throw new Error(`fetchBatched(${table}) error at offset ${offset}: ${error.message}`)
    if (!data || data.length === 0) break

    rows.push(...data)
    offset += batchSize

    // Progress indicator
    if (offset % (batchSize * 10) === 0) {
      process.stdout.write(`\r  ${table}: ${rows.length.toLocaleString()} rows fetched...`)
    }

    if (data.length < batchSize) break // last page
  }

  if (rows.length > 0) {
    process.stdout.write(`\r  ${table}: ${rows.length.toLocaleString()} rows fetched ✓\n`)
  }

  return rows
}

// ── Upsert in chunks (Supabase max ~500 per request) ────────────────────────

async function upsertChunked(supabase, table, rows, conflictKey, chunkSize = 500) {
  let upserted = 0

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from(table).upsert(chunk, {
      onConflict: conflictKey,
      ignoreDuplicates: false,
    })

    if (error) {
      console.error(`upsertChunked(${table}) error at chunk ${i}: ${error.message}`)
      throw error
    }

    upserted += chunk.length
  }

  return upserted
}

// ── Checkpoint for resumable batch jobs ─────────────────────────────────────

function checkpointPath(scriptName) {
  return `/tmp/bootcamp-${scriptName}.checkpoint.json`
}

function saveCheckpoint(scriptName, data) {
  fs.writeFileSync(checkpointPath(scriptName), JSON.stringify(data, null, 2))
}

function loadCheckpoint(scriptName) {
  try {
    return JSON.parse(fs.readFileSync(checkpointPath(scriptName), 'utf8'))
  } catch {
    return null
  }
}

// ── Cost tracking for AI calls ──────────────────────────────────────────────

async function logCost(supabase, model, usage, action, clientCode) {
  await supabase.from('api_cost_log').insert({
    model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    action,
    client_code: clientCode || 'system',
    latency_ms: usage.latency_ms || 0,
  }).then(() => {}, () => {})
}

// ── Fatal error handler ─────────────────────────────────────────────────────

async function fatalHandler(scriptName, sendTelegram, logHeartbeat, error) {
  console.error(`Fatal [${scriptName}]:`, error.message)
  await sendTelegram(`🔴 <b>${scriptName} FAILED</b>\n${error.message}`)
  await logHeartbeat('failed', { error: error.message })
  process.exit(1)
}

// ── Stats helpers ───────────────────────────────────────────────────────────

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0
  const idx = Math.ceil(p / 100 * sortedArr.length) - 1
  return sortedArr[Math.max(0, idx)]
}

function stdDev(arr) {
  if (arr.length < 2) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  const variance = arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

function mean(arr) {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function topN(map, n = 5) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key)
}

module.exports = {
  initBootcamp,
  fetchBatched,
  upsertChunked,
  saveCheckpoint,
  loadCheckpoint,
  logCost,
  fatalHandler,
  percentile,
  stdDev,
  mean,
  topN,
}
