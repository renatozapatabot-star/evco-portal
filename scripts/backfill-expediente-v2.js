#!/usr/bin/env node
/**
 * Backfill expediente_documentos v2 — targeted pass
 *
 * The v1 backfill normalized pedimento_id format globally but missed rows where:
 *   1. pedimento_id is a bare number matching traficos.pedimento (not caught by v1 regex)
 *   2. pedimento_id is full format "26 24 3596 XXXXXXX"
 *   3. company_id is wrong/missing for the doc (e.g., loaded before client onboarded)
 *
 * This script:
 *   - For each EVCO + MAFESA tráfico that has 0 docs
 *   - Searches expediente_documentos for matching pedimento number in ANY format
 *   - Updates pedimento_id to the tráfico code + fixes company_id
 *
 * Usage:
 *   node scripts/backfill-expediente-v2.js --dry-run
 *   node scripts/backfill-expediente-v2.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const PORTAL_DATE_FROM = '2024-01-01'

const CLIENTS = [
  { company_id: 'evco', clave_cliente: '9254', label: 'EVCO' },
  { company_id: 'mafesa', clave_cliente: '4598', label: 'MAFESA' },
]

async function run() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no changes\n' : '🔧 LIVE RUN\n')

  let totalUpdated = 0
  let totalErrors = 0

  for (const client of CLIENTS) {
    console.log(`\n━━━ ${client.label} (${client.company_id}) ━━━`)

    // 1. Get all tráficos for this client
    const { data: traficos } = await supabase
      .from('traficos')
      .select('trafico, pedimento')
      .eq('company_id', client.company_id)
      .not('pedimento', 'is', null)
      .neq('pedimento', '')
      .limit(5000)

    console.log(`Tráficos with pedimento: ${traficos.length}`)

    // 2. Check which already have docs (by tráfico code)
    const traficoIds = traficos.map(t => t.trafico)
    const withDocs = new Set()
    for (let i = 0; i < traficoIds.length; i += 100) {
      const chunk = traficoIds.slice(i, i + 100)
      const { data: docs } = await supabase
        .from('expediente_documentos')
        .select('pedimento_id')
        .in('pedimento_id', chunk)
      for (const d of (docs || [])) withDocs.add(d.pedimento_id)
    }

    const missing = traficos.filter(t => !withDocs.has(t.trafico))
    console.log(`Already linked: ${withDocs.size}`)
    console.log(`Missing docs: ${missing.length}`)

    if (missing.length === 0) { console.log('Nothing to backfill.'); continue }

    // 3. For each missing tráfico, search for docs by pedimento number
    let linked = 0, noDocsFound = 0, errors = 0

    for (const t of missing) {
      const ped = t.pedimento.trim()
      const trafico = t.trafico

      // Search all format variants
      const variants = [
        ped,                          // bare: "6500168"
        `26 24 3596 ${ped}`,          // full spaces: "26 24 3596 6500168"
        `3596_240_${ped}`,            // underscore: "3596_240_6500168"
      ]

      let foundDocs = []
      for (const variant of variants) {
        const { data: docs } = await supabase
          .from('expediente_documentos')
          .select('id, pedimento_id, company_id')
          .eq('pedimento_id', variant)
          .limit(100)

        if (docs && docs.length > 0) {
          foundDocs.push(...docs)
        }
      }

      if (foundDocs.length === 0) {
        noDocsFound++
        continue
      }

      // Deduplicate by id (same doc may not appear twice but safety first)
      const seen = new Set()
      foundDocs = foundDocs.filter(d => {
        if (seen.has(d.id)) return false
        seen.add(d.id)
        return true
      })

      linked++

      if (DRY_RUN) {
        if (linked <= 5) {
          console.log(`  ${trafico} (ped=${ped}): ${foundDocs.length} docs found as "${foundDocs[0].pedimento_id}" (company_id=${foundDocs[0].company_id})`)
        }
        totalUpdated += foundDocs.length
        continue
      }

      // Update: set pedimento_id to tráfico code + fix company_id
      for (const doc of foundDocs) {
        const { error } = await supabase
          .from('expediente_documentos')
          .update({ pedimento_id: trafico, company_id: client.company_id })
          .eq('id', doc.id)

        if (error) {
          if (error.message.includes('duplicate')) {
            // Already exists under the target — skip silently
          } else {
            errors++
            if (errors <= 3) console.error(`  Error updating ${doc.id}: ${error.message}`)
          }
        } else {
          totalUpdated++
        }
      }
    }

    console.log(`\nResults for ${client.label}:`)
    console.log(`  Tráficos newly linked: ${linked}`)
    console.log(`  Docs ${DRY_RUN ? 'would update' : 'updated'}: ${DRY_RUN ? totalUpdated : totalUpdated}`)
    console.log(`  No docs found anywhere: ${noDocsFound}`)
    if (errors > 0) console.log(`  Errors: ${errors}`)
    totalErrors += errors
  }

  console.log('\n═════════════════════════════════════���═════')
  console.log(`  TOTAL ${DRY_RUN ? 'WOULD UPDATE' : 'UPDATED'}: ${totalUpdated.toLocaleString()} docs`)
  if (totalErrors > 0) console.log(`  TOTAL ERRORS: ${totalErrors}`)
  console.log('═══════════════════════════════════════════')

  if (DRY_RUN) console.log('\nRun without --dry-run to apply.')
}

run().catch(err => {
  console.error('❌ Failed:', err.message)
  process.exit(1)
})
