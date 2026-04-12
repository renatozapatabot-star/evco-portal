#!/usr/bin/env node
// scripts/v2c-managed-agent/verify.js
// V2-C Managed Agent — Quick verification script.
// Checks: SDK loads, tables exist, unclassified count, tool schemas valid.
// Does NOT modify any existing files.

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') })
const { createClient } = require('@supabase/supabase-js')

const checks = []
function check(name, pass, detail) {
  checks.push({ name, pass, detail })
  console.log(`  ${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
}

async function main() {
  console.log('\nV2-C MANAGED AGENT — VERIFICATION\n')

  // 1. SDK loads
  try {
    const Anthropic = require('@anthropic-ai/sdk')
    check('SDK loads', true, `@anthropic-ai/sdk found`)
  } catch (e) {
    check('SDK loads', false, e.message)
  }

  // 2. llmCall loads with tool support
  try {
    const { llmCall } = require('../lib/llm')
    check('llmCall loads', typeof llmCall === 'function', typeof llmCall)
  } catch (e) {
    check('llmCall loads', false, e.message)
  }

  // 3. agent-config loads
  try {
    const { SYSTEM_PROMPT, CLASSIFIER_TOOLS, normalizeFraccion } = require('./agent-config')
    check('agent-config', true, `${CLASSIFIER_TOOLS.length} tools, prompt ${SYSTEM_PROMPT.length} chars`)
    check('normalizeFraccion', normalizeFraccion('84439199') === '8443.91.99', normalizeFraccion('84439199'))
  } catch (e) {
    check('agent-config', false, e.message)
  }

  // 4. tool-executor loads
  try {
    const { executeTool, setCurrentProduct } = require('./tool-executor')
    check('tool-executor', typeof executeTool === 'function' && typeof setCurrentProduct === 'function')
  } catch (e) {
    check('tool-executor', false, e.message)
  }

  // 5. run-classifier syntax (already checked by node -c, but verify require path)
  try {
    // Just check the file can be parsed — don't actually run it
    require.resolve('./run-classifier')
    check('run-classifier resolvable', true)
  } catch (e) {
    check('run-classifier resolvable', false, e.message)
  }

  // 6. Supabase connection + tables
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  // globalpc_productos
  const { count: unclassifiedCount, error: e1 } = await sb
    .from('globalpc_productos')
    .select('id', { count: 'exact', head: true })
    .is('fraccion', null)
  check('globalpc_productos accessible', !e1, e1 ? e1.message : `${unclassifiedCount} unclassified`)

  // agent_decisions
  const { error: e2 } = await sb.from('agent_decisions').select('id').limit(1)
  check('agent_decisions accessible', !e2, e2 ? e2.message : 'OK')

  // tariff_rates
  const { count: tariffCount, error: e3 } = await sb
    .from('tariff_rates')
    .select('fraccion', { count: 'exact', head: true })
  check('tariff_rates accessible', !e3, e3 ? e3.message : `${tariffCount} rates`)

  // companies
  const { error: e4 } = await sb.from('companies').select('company_id').limit(1)
  check('companies accessible', !e4, e4 ? e4.message : 'OK')

  // Summary
  const passed = checks.filter(c => c.pass).length
  const total = checks.length
  console.log(`\n  RESULT: ${passed}/${total} checks passed\n`)
  process.exit(passed === total ? 0 : 1)
}

main().catch(err => {
  console.error('Verification failed:', err.message)
  process.exit(1)
})
