#!/usr/bin/env node
/**
 * cleanup-hallucinated-briefings-2026-04-28.js
 *
 * One-shot cleanup of today's client_briefings rows that contain
 * hallucinated 6+ digit ID sequences (pedimento serials, trafico
 * IDs, etc.). The render-time sanitizer in MorningBriefing.tsx
 * already hides them visually, but the raw rows are dirty in the
 * database. This script removes them so tomorrow's 7 AM cron
 * (generate-client-briefing.js, now with the no-IDs prompt) is
 * the first record on disk.
 *
 * Window: generated_at >= 2026-04-28 00:00 America/Chicago
 *         (= 2026-04-28 05:00 UTC, since CDT = UTC-5).
 *
 * Modes:
 *   --dry-run  Print count + sample, no writes.
 *   (no flag)  Actually delete the matching rows.
 *
 * Safe to re-run: idempotent. After delete the regex won't match.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const DRY_RUN = process.argv.includes('--dry-run')
const HALLUCINATED_ID_RE = /\b\d{6,}\b/
// 2026-04-28 00:00 America/Chicago = 2026-04-28 05:00:00 UTC (CDT, UTC-5)
const WINDOW_START_UTC = '2026-04-28T05:00:00.000Z'

async function main() {
  console.log(`\n🧹 cleanup-hallucinated-briefings-2026-04-28`)
  console.log(`   mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE (will DELETE)'}`)
  console.log(`   window: generated_at >= ${WINDOW_START_UTC} (= 2026-04-28 00:00 CDT)`)

  // Pull all today's rows (page-safe at this scale; today's run touches
  // ~30 active clients max).
  const { data, error } = await supabase
    .from('client_briefings')
    .select('id, company_id, briefing_text, generated_at')
    .gte('generated_at', WINDOW_START_UTC)
    .order('generated_at', { ascending: true })

  if (error) {
    console.error(`✗ select failed: ${error.message}`)
    process.exit(1)
  }

  const total = data?.length ?? 0
  const matches = (data ?? []).filter((r) =>
    typeof r.briefing_text === 'string' && HALLUCINATED_ID_RE.test(r.briefing_text),
  )

  console.log(`\n   total rows in window: ${total}`)
  console.log(`   rows matching /\\b\\d{6,}\\b/: ${matches.length}`)

  if (matches.length === 0) {
    console.log(`\n✓ Nothing to clean — exiting clean.`)
    return 0
  }

  console.log(`\n   sample row:`)
  const sample = matches[0]
  console.log(`     id:           ${sample.id}`)
  console.log(`     company_id:   ${sample.company_id}`)
  console.log(`     generated_at:   ${sample.generated_at}`)
  console.log(`     briefing_text (first 200 chars):`)
  console.log(`       "${sample.briefing_text.slice(0, 200)}${sample.briefing_text.length > 200 ? '…' : ''}"`)
  console.log(`     matched tokens: ${(sample.briefing_text.match(/\b\d{6,}\b/g) ?? []).slice(0, 5).join(', ')}`)

  if (DRY_RUN) {
    console.log(`\n   (dry-run — no rows deleted)`)
    return 0
  }

  console.log(`\n   ► Deleting ${matches.length} row(s)…`)
  const ids = matches.map((r) => r.id)
  const { error: delError, count } = await supabase
    .from('client_briefings')
    .delete({ count: 'exact' })
    .in('id', ids)

  if (delError) {
    console.error(`✗ delete failed: ${delError.message}`)
    process.exit(1)
  }

  console.log(`✓ Deleted ${count ?? ids.length} row(s).`)
  return 0
}

main()
  .then((code) => process.exit(code ?? 0))
  .catch((err) => {
    console.error(`Fatal: ${err?.message ?? err}`)
    process.exit(1)
  })
