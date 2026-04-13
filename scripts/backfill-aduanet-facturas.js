#!/usr/bin/env node
/**
 * One-shot orchestrator that backfills aduanet_facturas by walking the
 * AduanaNet puppeteer scraper backwards in 30-day chunks. Run manually
 * from Throne when you want to fill historical CBP payment data.
 *
 *   node scripts/backfill-aduanet-facturas.js                 # default 2024-01-01 → today
 *   node scripts/backfill-aduanet-facturas.js --from=2025-01-01
 *   node scripts/backfill-aduanet-facturas.js --reset         # clear checkpoint and start over
 *
 * Why this is NOT in pm2:
 *   - The job runs for hours (one chunk per ~30 days, each chunk hits
 *     puppeteer + AduanaNet + writes ~30-60 rows per EVCO month).
 *   - It hammers the AduanaNet session — wrong to share with the daily
 *     scraper. Keep it manual until proven stable.
 *
 * Resume:
 *   - Persists progress to scripts/.backfill-checkpoints/aduanet.json
 *   - On crash or Ctrl-C, the next invocation continues from the last
 *     successfully scraped chunk (or pass --reset to start fresh).
 *
 * Telegram:
 *   - Reuses the scraper's tg() helper indirectly: each child invocation
 *     sends its own ✅/❌ alert. This script logs progress to stdout +
 *     fires one summary Telegram on completion (or fatal failure).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const SCRAPER = path.join(__dirname, 'aduanet-puppeteer-scraper.js')
const CHECKPOINT_DIR = path.join(__dirname, '.backfill-checkpoints')
const CHECKPOINT = path.join(CHECKPOINT_DIR, 'aduanet.json')

const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'

const DEFAULT_FROM = '2024-01-01'
const CHUNK_DAYS = 30

const args = process.argv.slice(2)
const fromArg = args.find(a => a.startsWith('--from='))?.split('=')[1] ?? DEFAULT_FROM
const reset = args.includes('--reset')

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TG) { console.log('[TG]', msg); return }
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

function loadCheckpoint() {
  if (reset || !fs.existsSync(CHECKPOINT)) return { lastCompletedTo: null }
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'))
  } catch {
    return { lastCompletedTo: null }
  }
}

function saveCheckpoint(state) {
  if (!fs.existsSync(CHECKPOINT_DIR)) fs.mkdirSync(CHECKPOINT_DIR, { recursive: true })
  fs.writeFileSync(CHECKPOINT, JSON.stringify(state, null, 2))
}

function runScraperForWindow(daysParam) {
  // The existing scraper accepts --days=N and pulls from "now - N days" to today.
  // To fetch a historical window we'd ideally pass a date range, but the scraper
  // only accepts --days. Workaround: set a longer window and accept overlap —
  // upserts are idempotent (onConflict: 'pedimento'), so re-pulling already-known
  // pedimentos doesn't corrupt data.
  return new Promise((resolve, reject) => {
    const child = spawn('node', [SCRAPER, `--days=${daysParam}`], {
      stdio: 'inherit',
      env: process.env,
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`scraper exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

async function main() {
  const state = loadCheckpoint()
  const startTo = state.lastCompletedTo ? new Date(state.lastCompletedTo) : new Date()
  const from = new Date(fromArg)
  const today = new Date()

  console.log('\n🔄 ADUANET BACKFILL')
  console.log(`   from:  ${from.toISOString().slice(0, 10)}`)
  console.log(`   to:    ${today.toISOString().slice(0, 10)}`)
  console.log(`   resume:${state.lastCompletedTo ? ' from ' + state.lastCompletedTo.slice(0, 10) : ' (fresh start)'}`)
  console.log('═'.repeat(50))

  await tg(`🔄 <b>Aduanet backfill iniciado</b>\nfrom: ${from.toISOString().slice(0,10)}\nresume: ${state.lastCompletedTo?.slice(0,10) ?? 'fresh'}`)

  // Walk backward in CHUNK_DAYS-sized hops.
  // The scraper only accepts --days, so we increment the days param until
  // it covers the next chunk. Overlap is harmless (upsert by pedimento).
  let cursor = new Date(startTo)
  let chunksRun = 0

  while (cursor > from) {
    const daysFromToday = Math.ceil((today.getTime() - cursor.getTime()) / 86400000) + CHUNK_DAYS
    const chunkStart = new Date(cursor)
    chunkStart.setDate(chunkStart.getDate() - CHUNK_DAYS)
    if (chunkStart < from) chunkStart.setTime(from.getTime())

    console.log(`\n→ Chunk: ${chunkStart.toISOString().slice(0,10)} → ${cursor.toISOString().slice(0,10)} (--days=${daysFromToday})`)
    try {
      await runScraperForWindow(daysFromToday)
      chunksRun++
      state.lastCompletedTo = chunkStart.toISOString()
      saveCheckpoint(state)
    } catch (err) {
      console.error(`✗ Chunk failed: ${err.message}`)
      await tg(`🔴 <b>Aduanet backfill paused</b>\nChunk ${chunkStart.toISOString().slice(0,10)} → ${cursor.toISOString().slice(0,10)} failed.\nResume by re-running the script (checkpoint persisted).`)
      process.exit(1)
    }

    cursor = chunkStart
  }

  console.log(`\n✅ Backfill complete — ${chunksRun} chunks scraped`)
  await tg(`✅ <b>Aduanet backfill completo</b>\n${chunksRun} chunks ejecutados desde ${from.toISOString().slice(0,10)}`)

  // Re-run the tariff-rates seeder so IGI inference learns from the bigger
  // historical sample.
  console.log('\n📊 Re-seeding tariff_rates from new history...')
  await new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(__dirname, 'seed-tariff-rates.js')], {
      stdio: 'inherit',
      env: process.env,
    })
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error('seed-tariff-rates failed')))
    child.on('error', reject)
  }).catch((e) => console.warn('Tariff seed warning:', e.message))

  saveCheckpoint({ lastCompletedTo: from.toISOString(), completedAt: new Date().toISOString() })
}

main().catch(async (err) => {
  console.error('Fatal:', err)
  await tg(`🔴 <b>Aduanet backfill FATAL</b>\n${err.message}`)
  process.exit(1)
})
