#!/usr/bin/env node
/**
 * One-time backfill: oca_database (auto_classifier) → agent_decisions
 * Populates /clasificar review queue with tonight's classifications.
 * Safe to re-run — deduplicates by product_description + company_id.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

;(async () => {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data: ocaRows, error } = await sb.from('oca_database')
    .select('*')
    .eq('source', 'auto_classifier')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error) { console.error('Read error: ' + error.message); process.exit(1) }
  console.log('Found ' + (ocaRows?.length || 0) + ' oca_database rows from last 24h')

  if (!ocaRows || ocaRows.length === 0) { console.log('Nothing to backfill'); process.exit(0) }

  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const row of ocaRows) {
    const slug = row.company_id
    if (!slug) {
      console.log('  SKIP: no company_id for row ' + row.id)
      skipped++
      continue
    }

    // Deduplicate
    const { data: existing } = await sb.from('agent_decisions')
      .select('id')
      .eq('trigger_type', 'classification')
      .eq('company_id', slug)
      .gte('created_at', since)
      .filter('payload->>product_description', 'eq', row.product_description)
      .limit(1)

    if (existing && existing.length > 0) {
      skipped++
      continue
    }

    const { error: insErr } = await sb.from('agent_decisions').insert({
      cycle_id: 'backfill-' + row.id,
      trigger_type: 'classification',
      trigger_id: null,
      company_id: slug,
      workflow: 'classify',
      decision: 'Fraccion ' + row.fraccion + ' sugerida',
      reasoning: 'Backfilled from oca_database (auto-classifier batch)',
      confidence: row.confidence || 0.8,
      autonomy_level: (row.confidence || 0) >= 0.85 ? 2 : 1,
      action_taken: (row.confidence || 0) >= 0.85 ? 'auto-aplicada' : 'pendiente revision',
      processing_ms: null,
      payload: {
        product_description: row.product_description,
        suggested_fraccion: row.fraccion,
        supplier: null,
        precedent_count: 0,
        tmec_eligible: false,
        igi_rate: null,
        alternatives: (row.alternative_fracciones || []).slice(0, 3).map(f => ({
          fraccion: f,
          description: '',
          confidence: 0,
        })),
      },
      created_at: row.created_at,
    })

    if (insErr) {
      console.log('  ERROR: ' + insErr.message)
      errors++
    } else {
      inserted++
    }
  }

  console.log('')
  console.log('=== BACKFILL DONE ===')
  console.log('Inserted: ' + inserted)
  console.log('Skipped:  ' + skipped + ' (no slug or already exists)')
  console.log('Errors:   ' + errors)
  process.exit(0)
})()
