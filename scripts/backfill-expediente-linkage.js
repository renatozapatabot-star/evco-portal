#!/usr/bin/env node
/**
 * Backfill expediente_documentos.pedimento_id → tráfico codes
 *
 * Problem: Three loaders wrote pedimento_id in different formats:
 *   - GlobalPC-final: "9254-Y4060" (correct tráfico code) ✅
 *   - GlobalPC-v2:    "0001125" (traficos.pedimento number) ❌
 *   - Others:         "26 24 3596 6500168" (full pedimento) ❌
 *
 * This script normalizes all to tráfico codes so the portal join works.
 *
 * Usage:
 *   node scripts/backfill-expediente-linkage.js --dry-run   # report only
 *   node scripts/backfill-expediente-linkage.js              # apply updates
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 500

// ─── Helpers ────────────────────────────────────────────────

function isTraficoFormat(pid) {
  // Tráfico codes: XXXX-YNNNN (4 digits, dash, letter+digits)
  return /^\d{4}-[A-Z]\d+$/.test(pid)
}

function extractPedimentoNum(pid) {
  // Full pedimento format with spaces: "26 24 3596 6500168" → "6500168"
  const fullSpaces = pid.match(/^\d{2}\s\d{2}\s\d{4}\s(\d{5,7})$/)
  if (fullSpaces) return fullSpaces[1]

  // Full pedimento format with underscores: "3596_240_6500168" → "6500168"
  // Also handles other patentes: "3902_240_4008802" → "4008802"
  const fullUnder = pid.match(/^\d{4}_\d{3}_(\d{5,7})$/)
  if (fullUnder) return fullUnder[1]

  // Already a bare number (the common GlobalPC-v2 case)
  if (/^\d{5,7}$/.test(pid)) return pid

  return null
}

// ─── Main ───────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no changes will be made\n' : '🔧 LIVE RUN — updating rows\n')

  // Step 1: Build lookup Map<pedimento_number, trafico_code> from traficos
  // Paginate to get ALL traficos (not just first 1000)
  console.log('Step 1: Building pedimento → tráfico lookup...')
  const allTraficos = []
  let tOffset = 0
  while (true) {
    const { data: batch, error: tErr } = await supabase
      .from('traficos')
      .select('trafico, pedimento')
      .not('pedimento', 'is', null)
      .neq('pedimento', '')
      .range(tOffset, tOffset + 4999)

    if (tErr) { console.error('Failed to fetch traficos:', tErr.message); process.exit(1) }
    if (!batch || batch.length === 0) break
    allTraficos.push(...batch)
    tOffset += batch.length
    if (batch.length < 5000) break
  }

  // Map pedimento number → trafico code
  // Some pedimento numbers appear on multiple traficos — use the first match
  const pedToTrafico = new Map()
  // Also build reverse: trafico → pedimento (for validation)
  const traficoSet = new Set()

  for (const t of allTraficos) {
    if (!t.pedimento || !t.trafico) continue
    const ped = t.pedimento.trim()
    traficoSet.add(t.trafico)
    if (ped && !pedToTrafico.has(ped)) {
      pedToTrafico.set(ped, t.trafico)
    }
  }
  console.log(`  Traficos loaded: ${allTraficos.length}`)
  console.log(`  Unique pedimento numbers in lookup: ${pedToTrafico.size}`)

  // Step 2: Fetch expediente_documentos in batches, classify & resolve
  console.log('\nStep 2: Scanning expediente_documentos...')

  let offset = 0
  let totalScanned = 0
  let alreadyCorrect = 0
  let resolved = 0
  let unresolved = 0
  let nullOrEmpty = 0
  const unresolvedSamples = []
  const updateBatch = [] // { id, old_pedimento_id, new_pedimento_id }

  while (true) {
    const { data: rows, error: fetchErr } = await supabase
      .from('expediente_documentos')
      .select('id, pedimento_id')
      .range(offset, offset + BATCH_SIZE - 1)

    if (fetchErr) { console.error('Fetch error at offset', offset, ':', fetchErr.message); break }
    if (!rows || rows.length === 0) break

    for (const row of rows) {
      totalScanned++
      const pid = (row.pedimento_id || '').trim()

      if (!pid) {
        nullOrEmpty++
        continue
      }

      // Already a tráfico code — no change needed
      if (isTraficoFormat(pid)) {
        alreadyCorrect++
        continue
      }

      // Try to extract pedimento number and resolve to tráfico
      const pedNum = extractPedimentoNum(pid)
      if (pedNum && pedToTrafico.has(pedNum)) {
        const newPid = pedToTrafico.get(pedNum)
        resolved++
        updateBatch.push({ id: row.id, old: pid, new: newPid })
      } else {
        unresolved++
        if (unresolvedSamples.length < 20) {
          unresolvedSamples.push(pid)
        }
      }
    }

    offset += rows.length
    if (offset % 10000 === 0) {
      process.stdout.write(`  Scanned ${offset.toLocaleString()}...\r`)
    }

    if (rows.length < BATCH_SIZE) break
  }

  // Step 3: Report
  console.log('\n\n═══════════════════════════════════════════')
  console.log('  BACKFILL REPORT')
  console.log('═══════════════════════════════════════════')
  console.log(`  Total scanned:      ${totalScanned.toLocaleString()}`)
  console.log(`  Already correct:    ${alreadyCorrect.toLocaleString()} (tráfico format)`)
  console.log(`  Resolved:           ${resolved.toLocaleString()} (will update)`)
  console.log(`  Unresolved:         ${unresolved.toLocaleString()} (no matching tráfico)`)
  console.log(`  Null/empty:         ${nullOrEmpty.toLocaleString()}`)
  console.log('───────────────────────────────────────────')
  console.log(`  Update rate:        ${(resolved / (totalScanned || 1) * 100).toFixed(1)}%`)
  console.log(`  Post-fix correct:   ${((alreadyCorrect + resolved) / (totalScanned || 1) * 100).toFixed(1)}%`)
  console.log('═══════════════════════════════════════════')

  if (unresolvedSamples.length > 0) {
    console.log('\n  Unresolved samples:')
    unresolvedSamples.forEach(s => console.log(`    ${s}`))
  }

  // Sample of what would change
  if (updateBatch.length > 0) {
    console.log('\n  Sample updates (first 10):')
    updateBatch.slice(0, 10).forEach(u => {
      console.log(`    "${u.old}" → "${u.new}"`)
    })
  }

  // Step 4: Apply updates (unless dry-run)
  if (DRY_RUN) {
    console.log(`\n🔍 DRY RUN complete. ${resolved.toLocaleString()} rows would be updated.`)
    console.log('   Run without --dry-run to apply.')
    return
  }

  if (updateBatch.length === 0) {
    console.log('\nNothing to update.')
    return
  }

  console.log(`\nApplying ${updateBatch.length.toLocaleString()} updates in batches of ${BATCH_SIZE}...`)
  let applied = 0
  let errors = 0

  for (let i = 0; i < updateBatch.length; i += BATCH_SIZE) {
    const chunk = updateBatch.slice(i, i + BATCH_SIZE)

    // Supabase doesn't support batch UPDATE by ID natively — use individual updates
    // but parallelize within each chunk
    const promises = chunk.map(u =>
      supabase
        .from('expediente_documentos')
        .update({ pedimento_id: u.new })
        .eq('id', u.id)
        .then(({ error }) => {
          if (error) {
            errors++
            if (errors <= 5) console.error(`  Update error for ${u.id}: ${error.message}`)
          } else {
            applied++
          }
        })
    )

    await Promise.all(promises)
    process.stdout.write(`  Applied ${applied.toLocaleString()} / ${updateBatch.length.toLocaleString()}...\r`)
  }

  console.log(`\n\n✅ Backfill complete: ${applied.toLocaleString()} updated, ${errors} errors`)
}

run().catch(err => {
  console.error('❌ Backfill failed:', err.message)
  process.exit(1)
})
