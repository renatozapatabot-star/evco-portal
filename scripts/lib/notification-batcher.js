/**
 * CRUZ Notification Batcher
 *
 * Accumulates review items and flushes them as a single Telegram summary
 * every FLUSH_INTERVAL_MS or when the buffer reaches MAX_BUFFER items,
 * whichever comes first.
 *
 * This module is designed to be required from any handler that would
 * otherwise send a Telegram per event. Replaces N Telegrams with 1.
 *
 * Usage:
 *   const batcher = require('./lib/notification-batcher');
 *   batcher.queueReview({
 *     trigger_id: 'abc123',
 *     company_id: 'evco',
 *     description: 'POLYCARBONATE RESIN',
 *     options: [{fraccion: '3907.40.01', confidence: 75}, ...]
 *   });
 *
 * Patente 3596 · Aduana 240
 */

const { sendTelegram } = require('./telegram')

const FLUSH_INTERVAL_MS = 60_000  // flush every 60 seconds
const MAX_BUFFER = 10             // OR when 10 items accumulate

const buffers = new Map()  // company_id → array of review items
let flushTimer = null

function formatBatch(companyId, items) {
  const lines = [
    '🔍 <b>' + items.length + ' clasificaciones requieren revisión</b>',
    '<b>Cliente:</b> ' + companyId,
    '',
  ]

  // Show first 5 items in detail, summarize the rest
  const detailed = items.slice(0, 5)
  const remaining = items.length - detailed.length

  for (const item of detailed) {
    const top = (item.options || [])[0]
    const fracStr = top ? top.fraccion + ' (' + top.confidence + '%)' : '?'
    lines.push('• ' + (item.description || '(sin descripción)').slice(0, 50))
    lines.push('  → ' + fracStr + ' · trigger: ' + (item.trigger_id || '?').slice(0, 20))
  }

  if (remaining > 0) {
    lines.push('')
    lines.push('... y ' + remaining + ' más')
  }

  lines.push('')
  lines.push('— CRUZ Workflow')
  return lines.join('\n')
}

async function flush(companyId) {
  const items = buffers.get(companyId) || []
  if (items.length === 0) return
  buffers.set(companyId, [])
  await sendTelegram(formatBatch(companyId, items))
}

async function flushAll() {
  for (const companyId of Array.from(buffers.keys())) {
    await flush(companyId)
  }
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(async () => {
    flushTimer = null
    await flushAll()
  }, FLUSH_INTERVAL_MS)
  flushTimer.unref?.() // don't hold the event loop open
}

function queueReview({ trigger_id, company_id, description, options }) {
  if (!company_id) {
    console.error('[notification-batcher] queueReview missing company_id')
    return
  }

  if (!buffers.has(company_id)) buffers.set(company_id, [])
  const buf = buffers.get(company_id)
  buf.push({ trigger_id, description, options })

  // Flush immediately if buffer hit MAX_BUFFER
  if (buf.length >= MAX_BUFFER) {
    flush(company_id)
    return
  }

  // Otherwise schedule a delayed flush
  scheduleFlush()
}

// Graceful shutdown — flush whatever's pending
process.on('SIGTERM', () => { flushAll().then(() => process.exit(0)) })
process.on('SIGINT', () => { flushAll().then(() => process.exit(0)) })

module.exports = {
  queueReview,
  flush,
  flushAll,
  // exposed for testing
  _internals: { buffers, FLUSH_INTERVAL_MS, MAX_BUFFER },
}
