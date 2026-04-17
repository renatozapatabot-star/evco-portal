/**
 * CRUZ · Shared sync-log helper.
 *
 * Every sync script writes a row to `sync_log` at start + finish.
 * Failures fire a Telegram alert via the existing dispatcher (or
 * a direct bot-token call as the last-resort fallback).
 *
 * Usage:
 *   const { openSyncLog, closeSyncLog } = require('./lib/sync-log')
 *   const id = await openSyncLog(supabase, { sync_type: 'globalpc', company_id: null })
 *   try {
 *     // do the sync work, track row count
 *     await closeSyncLog(supabase, id, { status: 'success', rows_synced: 1234 })
 *   } catch (e) {
 *     await closeSyncLog(supabase, id, { status: 'failed', error_message: e.message })
 *     throw e
 *   }
 *
 * Why this exists: the baseline operational-resilience rule requires
 * every script to log to Supabase + fire Telegram on failure. Before
 * this helper, only nightly-pipeline.js wrote sync_log. Standalone
 * runs of globalpc-sync (and siblings) had no audit trail — so
 * pm2 restarts could miss failures for 10 days without anyone noticing.
 */

const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'

async function dispatch(text) {
  if (!TG || process.env.TELEGRAM_SILENT === 'true') return
  try {
    await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'Markdown' }),
    })
  } catch {
    // Never let a Telegram failure propagate — the sync_log row is
    // the source of truth; Telegram is just the nudge.
  }
}

/**
 * Start a sync-log row. Returns the row id so `closeSyncLog` can
 * update it. Never throws — returns null on error and the caller
 * should log locally + still run the sync.
 */
async function openSyncLog(supabase, { sync_type, company_id = null }) {
  try {
    const { data, error } = await supabase
      .from('sync_log')
      .insert({
        sync_type,
        company_id,
        started_at: new Date().toISOString(),
        status: 'running',
      })
      .select('id')
      .single()
    if (error) {
      console.warn(`[sync-log] open failed for ${sync_type}:`, error.message)
      return null
    }
    return data?.id ?? null
  } catch (e) {
    console.warn(`[sync-log] open exception for ${sync_type}:`, e.message)
    return null
  }
}

/**
 * Close a sync-log row. When status is 'failed' or 'error', also
 * fires a Telegram alert. Idempotent: closing an already-closed row
 * just updates the row.
 */
async function closeSyncLog(supabase, id, { status, rows_synced = null, error_message = null }) {
  if (!id) {
    // Couldn't open — at least fire Telegram on failure so it's not silent.
    if (status === 'failed' || status === 'error') {
      await dispatch(`🔴 *Sync sin sync_log*\nstatus: ${status}\n${error_message ?? ''}`)
    }
    return
  }
  try {
    await supabase
      .from('sync_log')
      .update({
        status,
        completed_at: new Date().toISOString(),
        rows_synced,
        error_message,
      })
      .eq('id', id)
  } catch (e) {
    console.warn(`[sync-log] close failed for id ${id}:`, e.message)
  }

  if (status === 'failed' || status === 'error') {
    // Read-back the row to get the sync_type for the alert.
    let syncType = 'unknown'
    try {
      const { data } = await supabase.from('sync_log').select('sync_type').eq('id', id).single()
      if (data?.sync_type) syncType = data.sync_type
    } catch {}
    await dispatch(`🔴 *Sync falló · ${syncType}*\n${error_message ?? 'sin detalle'}`)
  }
}

/**
 * All-in-one wrapper for scripts that prefer a try/catch style.
 * Runs the given async fn, automatically open/close the sync_log.
 */
async function withSyncLog(supabase, opts, fn) {
  const id = await openSyncLog(supabase, opts)
  try {
    const result = await fn()
    await closeSyncLog(supabase, id, {
      status: 'success',
      rows_synced: typeof result?.rows_synced === 'number' ? result.rows_synced : null,
    })
    return result
  } catch (e) {
    await closeSyncLog(supabase, id, { status: 'failed', error_message: e.message })
    throw e
  }
}

module.exports = { openSyncLog, closeSyncLog, withSyncLog }
