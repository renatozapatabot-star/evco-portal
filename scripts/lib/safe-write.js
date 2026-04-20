// scripts/lib/safe-write.js — guarded Supabase writes for sync/pipeline scripts.
//
// Born from the 2026-04-16 incident: globalpc-delta-sync.js logged
// "✅ 654 updated" for ~33h while writing zero rows. Root cause was a
// bare `await supabase.from(x).upsert(...)` with no `{ error }` destructure
// — Supabase JS v2 does NOT throw on 400/PGRST errors, it returns them
// inline. Every sync script that doesn't check `{ error }` is one schema
// drift away from the same outage.
//
// Usage:
//   const { safeUpsert, safeInsert } = require('./lib/safe-write')
//   await safeUpsert(supabase, 'traficos', batch, {
//     onConflict: 'trafico',
//     scriptName: 'nightly-pipeline',
//   })
//
// Behavior:
//   - On Supabase error → console.error + 🔴 Telegram alert + throw
//   - On zero-rows-written when rows.length > 0 → console.warn + 🟡 Telegram
//   - On duplicate-key (safeInsert w/ silentOnDuplicate) → no alert, returns { duplicate: true }
//   - Empty input → no-op, returns { count: 0 }
//
// Telegram alerts route through scripts/lib/telegram.js (single source).
// `count: 'exact'` is requested on every write so zero-write drift surfaces
// immediately instead of whispering through for weeks.

const { sendTelegram } = require('./telegram')

async function safeUpsert(supabase, table, rows, { onConflict, ignoreDuplicates = false, scriptName = 'unknown' } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return { count: 0 }
  const { error, count } = await supabase.from(table).upsert(rows, {
    onConflict,
    ignoreDuplicates,
    count: 'exact',
  })
  if (error) {
    console.error(`[${scriptName}] ${table} upsert failed:`, error.message)
    // sendTelegram swallows transport errors internally (console.error
    // log, never throws), so no outer .catch needed. Previously had
    // a .catch(() => {}) that R13 rightly flagged as silent.
    await sendTelegram(`🔴 <b>${scriptName}</b>: ${table} upsert failed — ${error.message}`)
    throw new Error(`${table} upsert failed: ${error.message}`)
  }
  if ((count ?? 0) === 0 && rows.length > 0) {
    console.warn(`[${scriptName}] ${table}: attempted ${rows.length}, 0 written`)
    await sendTelegram(`🟡 <b>${scriptName}</b>: ${table} attempted ${rows.length}, 0 written`)
  }
  return { count: count ?? 0 }
}

async function safeInsert(supabase, table, rows, { scriptName = 'unknown', silentOnDuplicate = false } = {}) {
  const input = Array.isArray(rows) ? rows : rows ? [rows] : []
  if (input.length === 0) return { count: 0 }
  const { error, count } = await supabase.from(table).insert(input, { count: 'exact' })
  if (error) {
    if (silentOnDuplicate && /duplicate key|already exists|unique constraint/i.test(error.message)) {
      return { count: 0, duplicate: true }
    }
    console.error(`[${scriptName}] ${table} insert failed:`, error.message)
    await sendTelegram(`🔴 <b>${scriptName}</b>: ${table} insert failed — ${error.message}`)
    throw new Error(`${table} insert failed: ${error.message}`)
  }
  return { count: count ?? 0 }
}

module.exports = { safeUpsert, safeInsert }
