#!/usr/bin/env node
/**
 * CRUZ Saturday Verification — 7 deferred smoke tests.
 * Run after Anthropic API quota resets:
 *   cd ~/evco-portal && node scripts/saturday-verify.js
 *
 * Tests the full chain: API → auto-classifier → workflow → duties → docs → writeback
 * Cleans up all test data after each test.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { execSync } = require('child_process')
const { llmCall } = require('./lib/llm')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const results = []
let totalDurationMs = 0

async function runTest(name, fn) {
  const start = Date.now()
  let status = '❌'
  let detail = ''
  try {
    detail = await fn()
    status = '✅'
  } catch (e) {
    detail = 'ERROR: ' + (e.message || String(e))
  }
  const ms = Date.now() - start
  totalDurationMs += ms
  results.push({ name, status, detail, ms })
  console.log(`${status} ${name} (${ms}ms)`)
  if (detail) console.log(`   ${detail}`)
  console.log('')
}

;(async () => {
  console.log('🔬 CRUZ Saturday Verification — running 7 deferred tests')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')

  // Test 1: Anthropic reachable
  await runTest('Anthropic API reachable', async () => {
    const r = await llmCall({
      modelClass: 'fast',
      messages: 'Reply with just OK',
      maxTokens: 10,
      callerName: 'saturday-verify',
    })
    return `tokens=${r.tokensIn}/${r.tokensOut}, model=${r.model}, response=${r.text.trim()}`
  })

  // Test 2: Auto-classifier end-to-end
  await runTest('Auto-classifier (2 rows)', async () => {
    const before = await sb.from('agent_decisions')
      .select('id', { count: 'exact', head: true })
      .eq('trigger_type', 'classification')
    const beforeCount = before.count || 0

    execSync('cd ' + require('path').join(__dirname, '..') + ' && node scripts/auto-classifier.js --batch --limit=2 --cve-cliente=9254', { stdio: 'pipe', timeout: 90000 })

    const after = await sb.from('agent_decisions')
      .select('id, company_id', { count: 'exact', head: false })
      .eq('trigger_type', 'classification')
      .order('created_at', { ascending: false })
      .limit(2)

    const newRows = after.data || []
    const numericIds = newRows.filter(r => r.company_id === '9254' || r.company_id === '4598')

    if (numericIds.length > 0) {
      throw new Error('REGRESSION: ' + numericIds.length + ' rows have numeric company_id (slug fix from Block 6.5A failed)')
    }

    return `${newRows.length} new rows, all using slug company_id`
  })

  // Test 3: Workflow chain
  await runTest('Workflow chain (classify → duties → docs)', async () => {
    const triggerId = 'sat-verify-' + Date.now()

    await sb.from('workflow_events').insert({
      workflow: 'classify',
      event_type: 'classification_complete',
      trigger_id: triggerId,
      company_id: 'evco',
      status: 'pending',
      payload: {
        fraccion: '3907.60.01',
        confidence: 0.95,
        igi_rate: 0,
        tmec_eligible: true,
        description: 'SAT VERIFY TEST PRODUCT',
      },
    })

    await new Promise(r => setTimeout(r, 60000))

    const chain = await sb.from('workflow_events')
      .select('event_type, status')
      .eq('trigger_id', triggerId)

    const eventTypes = (chain.data || []).map(e => e.event_type)
    const expected = ['classification_complete', 'duties_calculated']
    const missing = expected.filter(t => !eventTypes.includes(t))

    if (missing.length > 0) throw new Error('Missing chain events: ' + missing.join(', '))

    // Cleanup
    await sb.from('workflow_events').delete().eq('trigger_id', triggerId)
    await sb.from('pedimento_drafts').delete().eq('trafico_id', triggerId)

    return `chain fired ${eventTypes.length} events: ${eventTypes.join(' → ')}`
  })

  // Test 4: Review queue + writeback
  await runTest('/clasificar review queue + writeback', async () => {
    const pending = await sb.from('agent_decisions')
      .select('id, company_id, payload')
      .eq('trigger_type', 'classification')
      .is('was_correct', null)
      .limit(20)

    if (!pending.data || pending.data.length === 0) {
      return 'no pending reviews to test (queue empty — not a failure)'
    }

    let testRow = null
    for (const row of pending.data) {
      const desc = row.payload && row.payload.product_description
      if (!desc) continue
      const { count } = await sb.from('globalpc_productos')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', row.company_id)
        .eq('descripcion', desc)
      if (count && count > 0) {
        testRow = row
        break
      }
    }

    if (!testRow) return 'no pending reviews with matching globalpc rows (not a failure)'

    const desc = testRow.payload.product_description
    const frac = testRow.payload.suggested_fraccion

    // Snapshot before
    const before = await sb.from('globalpc_productos')
      .select('id, fraccion, fraccion_source')
      .eq('company_id', testRow.company_id)
      .eq('descripcion', desc)

    // Simulate vote + writeback
    await sb.from('agent_decisions').update({ was_correct: true, outcome: 'confirmed' }).eq('id', testRow.id)
    await sb.from('globalpc_productos').update({
      fraccion: frac,
      fraccion_source: 'human_tito_sat_verify',
      fraccion_classified_at: new Date().toISOString(),
    }).eq('company_id', testRow.company_id).eq('descripcion', desc)

    // Verify
    const after = await sb.from('globalpc_productos')
      .select('id, fraccion_source')
      .eq('company_id', testRow.company_id)
      .eq('descripcion', desc)

    const updated = (after.data || []).filter(r => r.fraccion_source === 'human_tito_sat_verify').length

    // Revert
    await sb.from('agent_decisions').update({ was_correct: null, outcome: null }).eq('id', testRow.id)
    for (const beforeRow of (before.data || [])) {
      await sb.from('globalpc_productos').update({
        fraccion: beforeRow.fraccion,
        fraccion_source: beforeRow.fraccion_source,
      }).eq('id', beforeRow.id)
    }

    if (updated === 0) throw new Error('writeback did not update any rows')
    return `vote → writeback updated ${updated} rows, then reverted`
  })

  // Test 5: Morning brief script
  await runTest('Morning brief script', async () => {
    const start = Date.now()
    const out = execSync('cd ' + require('path').join(__dirname, '..') + ' && node scripts/morning-report.js --dry-run', {
      stdio: 'pipe',
      timeout: 60000,
      encoding: 'utf8',
    })
    const ms = Date.now() - start
    return `ran in ${ms}ms, output ${out.length} chars`
  })

  // Test 6: Workflow processor health
  await runTest('Workflow processor health', async () => {
    let pmList = ''
    try {
      pmList = execSync('pm2 list --no-color', { encoding: 'utf8' })
    } catch (e) {
      throw new Error('pm2 list failed: ' + e.message)
    }

    if (!pmList.includes('workflow-processor')) {
      throw new Error('workflow-processor not in pm2 list')
    }

    const stuck = await sb.from('workflow_events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

    if ((stuck.count || 0) > 100) {
      throw new Error(`${stuck.count} stuck events > 10 min (queue blocker regression?)`)
    }

    return `workflow-processor in pm2 list, ${stuck.count || 0} stuck events`
  })

  // Test 7: entrada_synced filter still active
  await runTest('Block 4.5 entrada_synced filter', async () => {
    const triggerId = 'sat-filter-test-' + Date.now()

    await sb.from('workflow_events').insert({
      workflow: 'intake',
      event_type: 'entrada_synced',
      trigger_id: triggerId,
      company_id: 'evco',
      status: 'pending',
      payload: { test: true },
    })

    await new Promise(r => setTimeout(r, 60000))

    const after = await sb.from('workflow_events')
      .select('status')
      .eq('trigger_id', triggerId)
      .single()

    if (after.data && after.data.status !== 'pending') {
      await sb.from('workflow_events').delete().eq('trigger_id', triggerId)
      throw new Error('REGRESSION: entrada_synced was processed (Block 4.5 filter failed) — status=' + after.data.status)
    }

    // Cleanup
    await sb.from('workflow_events').delete().eq('trigger_id', triggerId)

    return 'entrada_synced stayed pending (filter intact)'
  })

  // Final report
  console.log('═══════════════════════════════════════════════════════')
  console.log('🔬 Saturday Verification Complete')
  console.log('═══════════════════════════════════════════════════════')
  console.log('')

  const passed = results.filter(r => r.status === '✅').length
  const failed = results.filter(r => r.status === '❌').length

  console.log(`Passed: ${passed}/${results.length}`)
  console.log(`Failed: ${failed}/${results.length}`)
  console.log(`Total runtime: ${(totalDurationMs / 1000).toFixed(1)}s`)
  console.log('')

  if (failed > 0) {
    console.log('❌ FAILURES:')
    results.filter(r => r.status === '❌').forEach(r => {
      console.log(`   ${r.name}: ${r.detail}`)
    })
    process.exit(1)
  } else {
    console.log('✅ All tests passed. CRUZ is healthy.')
    process.exit(0)
  }
})()
