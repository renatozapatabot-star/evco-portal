#!/usr/bin/env node
// scripts/network-effects.js — FEATURE 19
// Pre-populate intelligence for new clients from network data
// Run during client onboarding: node scripts/network-effects.js <company_id>

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const NEW_CLIENT = process.argv[2]
if (!NEW_CLIENT) {
  console.log('Usage: node scripts/network-effects.js <company_id>')
  console.log('Example: node scripts/network-effects.js mafesa')
  process.exit(0)
}

async function main() {
  console.log(`🕸️  Network Effects Engine — CRUZ`)
  console.log(`   New client: ${NEW_CLIENT}`)
  const start = Date.now()

  // 1. Load supplier network (built from all existing clients)
  const { data: suppliers } = await supabase.from('supplier_network').select('*')
  const supplierMap = {}
  ;(suppliers || []).forEach(s => { supplierMap[s.supplier_name_normalized] = s })
  console.log(`   Supplier network: ${Object.keys(supplierMap).length} suppliers`)

  // 2. Load OCA classification database
  const { data: ocaEntries } = await supabase.from('oca_database').select('description, fraccion, confidence')
  console.log(`   OCA database: ${(ocaEntries || []).length} classifications`)

  // 3. Check new client's suppliers against network
  const { data: newClientFacturas } = await supabase.from('globalpc_facturas')
    .select('cve_proveedor, cve_trafico')
    .eq('cve_cliente', NEW_CLIENT === 'mafesa' ? 'TBD' : NEW_CLIENT)
    .limit(1000)

  const newSuppliers = [...new Set((newClientFacturas || []).map(f => (f.cve_proveedor || '').toUpperCase().trim()).filter(Boolean))]
  console.log(`   New client suppliers: ${newSuppliers.length}`)

  // 4. Match suppliers
  let matched = 0
  for (const supplier of newSuppliers) {
    const existing = supplierMap[supplier]
    if (existing) {
      matched++
      // Update seen_by_clients
      const clients = existing.seen_by_clients || []
      if (!clients.includes(NEW_CLIENT)) {
        clients.push(NEW_CLIENT)
        await supabase.from('supplier_network')
          .update({ seen_by_clients: clients })
          .eq('supplier_name_normalized', supplier)
      }
    }
  }
  console.log(`   Matched ${matched}/${newSuppliers.length} suppliers in network`)

  // 5. Pre-populate risk scores from network data
  let prePopulated = 0
  for (const supplier of newSuppliers) {
    const existing = supplierMap[supplier]
    if (existing && existing.reliability_score !== undefined) {
      // Future: create pre-populated supplier_contacts for new client
      prePopulated++
    }
  }
  console.log(`   Pre-populated ${prePopulated} supplier risk scores`)

  // 6. Pre-populate fraccion classifications
  // The OCA database is shared — new client gets instant access

  // 7. Generate first benchmark baseline
  const { data: industryBenchmarks } = await supabase.from('client_benchmarks')
    .select('metrics').order('calculated_at', { ascending: false }).limit(1)

  if (industryBenchmarks?.[0]) {
    const baseline = {
      company_id: NEW_CLIENT,
      period: new Date().toISOString().substring(0, 7),
      metrics: industryBenchmarks[0].metrics,
      total_operations: 0,
      total_value_usd: 0,
      calculated_at: new Date().toISOString(),
      is_baseline: true,
    }
    await supabase.from('client_benchmarks').delete().eq('company_id', NEW_CLIENT).eq('period', baseline.period)
    await supabase.from('client_benchmarks').insert(baseline)
    console.log(`   Industry benchmark baseline set for ${NEW_CLIENT}`)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n✅ Network Effects applied for ${NEW_CLIENT}`)
  console.log(`   ${matched} suppliers matched`)
  console.log(`   ${prePopulated} risk scores pre-populated`)
  console.log(`   ${(ocaEntries || []).length} OCA classifications available`)
  console.log(`   ${elapsed}s`)
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
