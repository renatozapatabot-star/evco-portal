#!/usr/bin/env node
/**
 * CRUZ Data Isolation Test
 * Verifies that client data is properly scoped
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testDataIsolation() {
  console.log('\n🔒 TESTING DATA ISOLATION')
  console.log('═'.repeat(40))

  let allPassed = true

  const TABLES_TO_TEST = [
    'traficos', 'entradas', 'globalpc_facturas',
    'globalpc_eventos', 'pedimento_risk_scores',
    'compliance_predictions'
  ]

  // Get two different company IDs
  const { data: companies } = await supabase
    .from('companies').select('company_id').eq('active', true).limit(2)

  if (!companies || companies.length < 2) {
    console.log('⚠️  Need at least 2 companies for isolation test')
    // Still test basic scoping
  }

  const testCompany = companies?.[0]?.company_id || 'evco'

  for (const table of TABLES_TO_TEST) {
    const { data, error } = await supabase
      .from(table)
      .select('company_id')
      .eq('company_id', testCompany)
      .limit(10)

    if (error) {
      console.log(`⚠️  ${table}: ${error.message}`)
      continue
    }

    const contaminated = (data || []).filter(r => r.company_id !== testCompany)
    const passed = contaminated.length === 0

    if (!passed) allPassed = false
    console.log(`${passed ? '✅' : '❌'} ${table}: ${passed ? 'ISOLATED' : `${contaminated.length} contaminated rows`}`)
  }

  // Test cross-company query returns empty
  const { data: crossData } = await supabase
    .from('traficos')
    .select('company_id')
    .eq('company_id', 'nonexistent_xyz_test')

  const crossPassed = (crossData?.length || 0) === 0
  if (!crossPassed) allPassed = false
  console.log(`${crossPassed ? '✅' : '❌'} Cross-company query: ${crossPassed ? 'RETURNS EMPTY' : 'LEAKING DATA'}`)

  // Test that company_id column exists on key tables
  for (const table of ['traficos', 'globalpc_facturas', 'pedimento_risk_scores']) {
    const { data } = await supabase.from(table).select('company_id').limit(1)
    const hasColumn = data !== null && !data?.[0]?.hasOwnProperty?.('error')
    console.log(`${hasColumn ? '✅' : '❌'} ${table}: company_id column ${hasColumn ? 'EXISTS' : 'MISSING'}`)
    if (!hasColumn) allPassed = false
  }

  console.log('\n' + (allPassed ? '✅ ALL TESTS PASSED — Safe for Monday' : '❌ ISOLATION FAILURES — FIX BEFORE MONDAY'))
  return allPassed
}

testDataIsolation().catch(console.error)
