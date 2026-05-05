// scripts/lib/cron-observability.js
//
// Lightweight sync_log instrumentation for PM2 cron jobs that don't
// fit the `withSyncLog` wrapper pattern — typically because they call
// `process.exit(N)` partway through `main()` to drive their exit code.
//
// Born from FIX 5 of audit-sync-pipeline-2026-04-29: 11 PM2 cron
// entries had ZERO rows in sync_log even though they run 1-3× per
// hour. If they died for 10 days, no human would learn about it
// (memory: project_evco_ops_pipeline_2026_03_26 — same incident
// pattern that started this whole observability rule set).
//
// Usage at the top of any cron script's main flow:
//
//   const { recordCronStart } = require('./lib/cron-observability')
//   const tracker = await recordCronStart(supabase, 'semaforo_watch')
//
// On any process exit (clean or via process.exit(N) or unhandled
// throw), the helper finalizes the sync_log row:
//   - exit code 0           → status = 'success'
//   - exit code 2 (warn)    → status = 'success' with notes='exit=2'
//   - any other non-zero    → status = 'failed', error_message = 'exit=N'
//   - thrown to .catch()    → status = 'failed', error_message = e.message
//
// The hook uses process.on('exit') (synchronous) for the resolution,
// AND tracker.finish(...) so the script can override before exit if
// it has richer context.
//
// Idempotent: calling tracker.finish() multiple times is a no-op
// after the first.

async function recordCronStart(supabase, syncType, { companyId = null } = {}) {
  const startedAt = new Date().toISOString()
  let id = null
  try {
    const { data, error } = await supabase
      .from('sync_log')
      .insert({
        sync_type: syncType,
        company_id: companyId,
        started_at: startedAt,
        status: 'running',
      })
      .select('id')
      .single()
    if (!error) id = data?.id ?? null
    else console.warn(`[${syncType}] sync_log open failed: ${error.message}`)
  } catch (e) {
    console.warn(`[${syncType}] sync_log open exception: ${e.message}`)
  }

  let finalized = false
  const finishWith = async (status, errorMessage, rowsSynced) => {
    if (finalized) return
    finalized = true
    if (!id) return
    try {
      await supabase
        .from('sync_log')
        .update({
          status,
          completed_at: new Date().toISOString(),
          error_message: errorMessage ?? null,
          rows_synced: rowsSynced ?? null,
        })
        .eq('id', id)
    } catch (e) {
      console.warn(`[${syncType}] sync_log close exception: ${e.message}`)
    }
  }

  // Best-effort finalizer on synchronous exit. Note: async work
  // inside an 'exit' handler is NOT guaranteed to flush — the better
  // path is for the script to call tracker.finish() before exit,
  // but this catches the cases where it doesn't.
  process.on('exit', code => {
    if (finalized) return
    if (!id) return
    // We can't await inside 'exit' — fire-and-pray. The supabase
    // HTTP client uses keep-alive sockets, so the write often lands
    // before the process actually terminates.
    const status = code === 0 || code === 2 ? 'success' : 'failed'
    const errorMessage = code === 0 ? null : `process.exit(${code})`
    void supabase
      .from('sync_log')
      .update({
        status,
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      })
      .eq('id', id)
      .then(() => {}, () => {})
    finalized = true
  })

  return {
    id,
    syncType,
    finish: finishWith,
  }
}

module.exports = { recordCronStart }
