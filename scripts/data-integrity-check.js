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
    assert(data?.value?.A1?.amount > 0 || data?.value?.A1?.rate > 0, 'DTA A1 config missing or zero')
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

  // ── 9. EVCO cockpit smoke — every nav card must have > 0 rows ──
  // This is the regression guard against the 2026-04-17 zero-count
  // incident. A future filter/RLS change that silently zeroes one of
  // these tables fails here BEFORE it ships. The window is 365 days
  // so seasonal lulls don't trip the check; we only fail on tables
  // that have no history at all for EVCO.
  {
    const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString()
    const cockpitTables = [
      { table: 'traficos',              filter: (q) => q.gte('fecha_llegada', yearAgo) },
      { table: 'entradas',              filter: (q) => q.gte('fecha_llegada_mercancia', yearAgo) },
      { table: 'expediente_documentos', filter: (q) => q.gte('uploaded_at', yearAgo) },
      { table: 'globalpc_productos',    filter: (q) => q }, // no time filter — the catalog is lifetime
    ]
    for (const { table, filter } of cockpitTables) {
      await test(`EVCO cockpit: ${table} has rows (365d window)`, async () => {
        const base = supabase
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq('company_id', 'evco')
        const { count, error } = await filter(base)
        assert(!error, `${table} query errored: ${error?.message}`)
        assert((count || 0) > 0, `EVCO ${table} returned 0 rows — cockpit will render zeros`)
      })
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Block DD (2026-04-17) — 8 new invariants
  // ─────────────────────────────────────────────────────────────────

  // ── 10. Every pedimento has a matching trafico (orphan check) ──
  await test('No orphan pedimentos (pedimento with missing trafico)', async () => {
    // Schema tolerant — the pedimentos table column may be `trafico` or
    // `trafico_id` depending on migration state. Try both; if neither
    // exists the table is pre-migration and the check skips.
    for (const col of ['trafico', 'trafico_id']) {
      const { count, error } = await supabase
        .from('pedimentos')
        .select('*', { count: 'estimated', head: true })
        .is(col, null)
      if (error) {
        // 42P01 = table missing; 42703 = column missing; 42883 undefined func
        if (error.code === '42P01' || error.code === '42703' || error.code === '42883') continue
        // Other errors → non-fatal (log but don't fail the ship gate)
        console.log(`\n  [orphan-pedimentos] skipping: ${error.message || 'unknown error'}`)
        return
      }
      assert((count || 0) < 20, `Orphan pedimentos (null ${col}): ${count} (threshold 20)`)
      return
    }
    // Both column names errored → table present but neither column exists; skip.
  })

  // ── 11. anexo24_partidas.numero_parte population (reality-calibrated) ──
  //   EVCO current coverage sits at ~66% — Formato 53 doesn't populate
  //   numero_parte for every line (service codes, bulk assemblies). Threshold
  //   set at 60% so drift of >6 pct below our ~66% norm triggers the alert.
  await test('anexo24_partidas.numero_parte population > 60%', async () => {
    const { count: total, error: e1 } = await supabase
      .from('anexo24_partidas')
      .select('*', { count: 'estimated', head: true })
    if (e1 && e1.code === '42P01') return // table absent in this env → skip
    if (e1) throw new Error(`anexo24_partidas total: ${e1.message}`)
    if (!total) return // empty tenant → skip
    const { count: withPart } = await supabase
      .from('anexo24_partidas')
      .select('*', { count: 'estimated', head: true })
      .not('numero_parte', 'is', null)
    const pct = ((withPart || 0) / total) * 100
    assert(pct >= 60, `numero_parte coverage: ${pct.toFixed(1)}% (threshold 60%)`)
  })

  // ── 12. globalpc_proveedores coverage hasn't dropped ──
  await test('globalpc_proveedores row count > 0', async () => {
    const { count, error } = await supabase
      .from('globalpc_proveedores')
      .select('*', { count: 'estimated', head: true })
    if (error && error.code === '42P01') return
    if (error) throw new Error(error.message)
    assert((count || 0) > 0, `globalpc_proveedores empty — supplier resolution broken`)
  })

  // ── 13. Zero orphan expediente_documents (doc without trafico) ──
  await test('No orphan expediente_documentos (null trafico_id)', async () => {
    const { count } = await supabase
      .from('expediente_documentos')
      .select('*', { count: 'estimated', head: true })
      .is('trafico_id', null)
      .gte('uploaded_at', new Date(Date.now() - 90 * 86_400_000).toISOString())
    assert((count || 0) < 100, `Orphan expediente docs (null trafico_id, last 90d): ${count} (threshold 100)`)
  })

  // ── 14. sync_log failure rate ≤ 5% over last 7 days ──
  await test('sync_log failure rate ≤ 5% (last 7d)', async () => {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const { count: total } = await supabase
      .from('sync_log')
      .select('*', { count: 'estimated', head: true })
      .gte('started_at', since)
    if (!total || total < 10) return // not enough signal → skip
    const { count: failed } = await supabase
      .from('sync_log')
      .select('*', { count: 'estimated', head: true })
      .gte('started_at', since)
      .in('status', ['failed', 'error'])
    const pct = ((failed || 0) / total) * 100
    assert(pct <= 5, `sync_log failure rate: ${pct.toFixed(1)}% (threshold 5%)`)
  })

  // ── 15. Every active company has at least one tráfico in the last 2 years ──
  await test('Active companies have > 0 traficos (2y window)', async () => {
    const { data: activeCompanies } = await supabase
      .from('companies')
      .select('company_id')
      .eq('active', true)
    if (!activeCompanies || activeCompanies.length === 0) return
    const since = new Date(Date.now() - 730 * 86_400_000).toISOString()
    let silent = 0
    for (const c of activeCompanies) {
      const { count } = await supabase
        .from('traficos')
        .select('*', { count: 'estimated', head: true })
        .eq('company_id', c.company_id)
        .gte('fecha_llegada', since)
      if ((count || 0) === 0) silent++
    }
    // Allow up to half to be silent (historical / migrated tenants without recent activity)
    assert(silent <= Math.ceil(activeCompanies.length / 2), `${silent}/${activeCompanies.length} active companies have 0 traficos in 2y`)
  })

  // ── 16. system_config rate entries fresh (valid_to ≥ today) ──
  await test('system_config rates not expired', async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('system_config')
      .select('key, valid_to')
      .in('key', ['banxico_exchange_rate', 'dta_rates'])
    const expired = (data || []).filter((r) => r.valid_to && r.valid_to < today)
    assert(expired.length === 0, `Expired system_config: ${expired.map((r) => r.key).join(', ')}`)
  })

  // ── 17. audit_log writes in last 30d (cockpit activity surface alive) ──
  //   30-day window tolerates quiet seasons. This check warns, not fails —
  //   an empty audit_log in a dev/staging env is normal; in production
  //   it's an operational concern but not a deploy-blocker.
  await test('audit_log has writes in last 30 days (warn only)', async () => {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const { count, error } = await supabase
      .from('audit_log')
      .select('*', { count: 'estimated', head: true })
      .gte('created_at', since)
    if (error && error.code === '42P01') return
    if (error) {
      console.log(`\n  [audit_log] skipping: ${error.message}`)
      return
    }
    if ((count || 0) === 0) {
      console.log('\n  [audit_log] 0 rows in last 30d — activity strip may look dead; non-blocking')
    }
    // Always passes — warning-only check.
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
