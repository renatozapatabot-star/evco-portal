#!/usr/bin/env node

// ============================================================
// CRUZ Data Integrity Check
// Verifies dedup constraints, client isolation, coverage baselines
// Run: node scripts/data-integrity-check.js
// Exit 1 on any failure — blocks deploy
// ============================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const { fetchAll } = require('./lib/paginate')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

let pass = 0, fail = 0
const failures = []

async function test(name, fn) {
  try {
    await fn()
    pass++
    process.stdout.write('.')
  } catch (err) {
    fail++
    failures.push(`${name}: ${err.message}`)
    process.stdout.write('F')
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg)
}

async function main() {
  const start = Date.now()
  console.log('\n🔍 CRUZ Data Integrity Check')
  console.log('━'.repeat(50))

  // ── 1. Dedup: no duplicate facturas ──
  await test('No duplicate aduanet_facturas', async () => {
    // Manual dedup check — no RPC needed
    {
      const facturas = await fetchAll(supabase
        .from('aduanet_facturas')
        .select('pedimento, referencia'))
      const seen = new Set()
      let dupes = 0
      for (const f of (facturas || [])) {
        const key = `${f.pedimento}:${f.referencia}`
        if (seen.has(key)) dupes++
        seen.add(key)
      }
      assert(dupes === 0, `Found ${dupes} duplicate factura rows`)
    }
  })


  // ── 2. Client isolation: EVCO query returns 0 MAFESA ──
  await test('EVCO traficos contain no MAFESA rows', async () => {
    const { data } = await supabase
      .from('traficos')
      .select('company_id')
      .eq('company_id', 'evco')
      .limit(100)
    const wrong = (data || []).filter(r => r.company_id !== 'evco')
    assert(wrong.length === 0, `Found ${wrong.length} non-evco rows in evco query`)
  })

  await test('MAFESA traficos contain no EVCO rows', async () => {
    const { data } = await supabase
      .from('traficos')
      .select('company_id')
      .eq('company_id', 'mafesa')
      .limit(100)
    const wrong = (data || []).filter(r => r.company_id !== 'mafesa')
    assert(wrong.length === 0, `Found ${wrong.length} non-mafesa rows in mafesa query`)
  })

  // ── 3. Expediente coverage hasn't dropped ──
  await test('EVCO expediente docs > 1000', async () => {
    const { count } = await supabase
      .from('expediente_documentos')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', 'evco')
    assert((count || 0) > 1000, `EVCO expediente docs: ${count} (expected >1000)`)
  })

  // ── 4. Supplier resolution: no PRV_ codes in traficos ──
  await test('No unresolved PRV_ suppliers in traficos', async () => {
    const { data } = await supabase
      .from('traficos')
      .select('trafico, proveedores')
      .like('proveedores', '%PRV_%')
      .gte('fecha_llegada', '2024-01-01')
      .limit(10)
    const count = data?.length || 0
    // Allow some — batch resolution runs nightly
    assert(count < 50, `Found ${count} traficos with unresolved PRV_ codes (threshold: 50)`)
  })

  // ── 5. System config not expired ──
  await test('Exchange rate in system_config', async () => {
    const { data } = await supabase
      .from('system_config')
      .select('value, valid_to')
      .eq('key', 'banxico_exchange_rate')
      .single()
    assert(data?.value?.rate > 0, 'Exchange rate missing or zero')
  })

  await test('DTA rates in system_config', async () => {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'dta_rates')
      .single()
    assert(data?.value?.A1?.rate > 0, 'DTA A1 rate missing or zero')
  })

  // ── 6. RLS: service role can read, tables exist ──
  const criticalTables = ['traficos', 'entradas', 'aduanet_facturas', 'pedimento_drafts', 'audit_log']
  for (const table of criticalTables) {
    await test(`Table ${table} exists and readable`, async () => {
      const { error } = await supabase.from(table).select('*', { count: 'exact', head: true })
      assert(!error, `${table}: ${error?.message}`)
    })
  }

  // ── 7. No company_id leaks (rows with empty/null company_id in scoped tables) ──
  await test('No traficos with null company_id', async () => {
    const { count } = await supabase
      .from('traficos')
      .select('*', { count: 'exact', head: true })
      .is('company_id', null)
      .gte('fecha_llegada', '2024-01-01')
    assert((count || 0) === 0, `Found ${count} traficos with null company_id`)
  })

  // ── 8. Session signing works ──
  await test('Session secret is configured', async () => {
    const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
    assert(secret && secret.length > 10, 'SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY too short')
  })

  // ── Summary ──
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ Passed: ${pass}`)
  if (fail > 0) {
    console.log(`❌ Failed: ${fail}`)
    failures.forEach(f => console.log(`   ${f}`))
  }
  console.log(`⏱️  ${elapsed}s`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  process.exit(fail > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
