#!/usr/bin/env node
/**
 * aduanet-facturas-backfill-tenant.js — One-shot backfill that re-derives
 * company_id on existing aduanet_facturas rows using clave_cliente.
 *
 * Why: scripts/aduanet-import.js until 2026-04-29 hardcoded
 * `company_id: 'evco'` on every imported row regardless of clave_cliente,
 * mis-tagging 370 of 459 rows in the 2026-03-09 dump (rows actually
 * belonging to FEDERAL ELECTRICA, etc., were tagged as EVCO). This
 * script reads each row's per-row clave_cliente, looks it up in the
 * active companies allowlist, and updates company_id accordingly.
 *
 * Idempotent: safe to re-run. Rows already correctly tagged are
 * unchanged. Rows with unknown clave are flagged but NOT auto-deleted.
 *
 * Per .claude/rules/tenant-isolation.md: trust cve_cliente, derive
 * company_id, never write either without both.
 *
 * Usage:
 *   node scripts/aduanet-facturas-backfill-tenant.js --dry-run    # preview only
 *   node scripts/aduanet-facturas-backfill-tenant.js              # apply changes
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')

async function pageAll(builder) {
  const out = []
  let from = 0
  while (true) {
    const { data, error } = await builder().range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return out
}

;(async () => {
  console.log(`\n🔧 ADUANET_FACTURAS tenant backfill ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}\n`)

  // 1. Build clave → company_id map from active companies
  const { data: companiesRows } = await supabase
    .from('companies')
    .select('clave_cliente, globalpc_clave, company_id, name')
    .eq('active', true)
  const claveMap = {}
  for (const c of (companiesRows || [])) {
    if (c.clave_cliente) claveMap[c.clave_cliente] = c.company_id
    if (c.globalpc_clave) claveMap[c.globalpc_clave] = c.company_id
  }
  console.log(`Active companies allowlist: ${companiesRows?.length || 0} companies, ${Object.keys(claveMap).length} distinct claves\n`)

  // 2. Pull ALL aduanet_facturas rows
  const allRows = await pageAll(() =>
    supabase.from('aduanet_facturas').select('id, clave_cliente, company_id, pedimento')
  )
  console.log(`aduanet_facturas total rows: ${allRows.length}\n`)

  // 3. Pre-state distribution by company_id
  const beforeByCompany = {}
  const beforeByClave = {}
  for (const r of allRows) {
    const k = r.company_id || 'NULL'
    beforeByCompany[k] = (beforeByCompany[k] || 0) + 1
    const c = r.clave_cliente || 'NULL'
    beforeByClave[c] = (beforeByClave[c] || 0) + 1
  }
  console.log('BEFORE — rows by company_id:')
  for (const [k, n] of Object.entries(beforeByCompany).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${String(n).padStart(4)}`)
  }
  console.log('')

  // 4. Compute target company_id per row.
  //    - Known clave → resolve via claveMap (the active allowlist).
  //    - Unknown clave → NULL the company_id rather than leave it
  //      mis-tagged. Per .claude/rules/tenant-isolation.md, ownership
  //      stays NULL when we cannot prove it. Do NOT default to 'evco'.
  //    - Missing clave → leave alone (no derivation source).
  const updates = []
  const unknownClave = {}
  let alreadyCorrect = 0
  for (const r of allRows) {
    const c = r.clave_cliente
    if (!c) {
      continue
    }
    const target = claveMap[c]
    if (!target) {
      unknownClave[c] = (unknownClave[c] || 0) + 1
      // Mis-tagged as anything (incl. 'evco') gets reset to NULL —
      // ownership is provably unknown.
      if (r.company_id !== null) {
        updates.push({ id: r.id, clave_cliente: c, from: r.company_id, to: null, reason: 'unknown_clave' })
      } else {
        alreadyCorrect++
      }
      continue
    }
    if (r.company_id === target) {
      alreadyCorrect++
      continue
    }
    updates.push({ id: r.id, clave_cliente: c, from: r.company_id, to: target, reason: 'remap' })
  }

  const unknownClaveTotal = Object.values(unknownClave).reduce((a, b) => a + b, 0)
  const remapCount = updates.filter(u => u.reason === 'remap').length
  const nullCount = updates.filter(u => u.reason === 'unknown_clave').length
  console.log('PLAN:')
  console.log(`  Already correct:           ${alreadyCorrect}`)
  console.log(`  To remap (known clave):    ${remapCount}`)
  console.log(`  To NULL (unknown clave):   ${nullCount}`)
  console.log(`  Total updates:             ${updates.length}`)
  if (Object.keys(unknownClave).length > 0) {
    console.log(`  Unknown claves (will be NULLed; ${unknownClaveTotal} rows across ${Object.keys(unknownClave).length} distinct claves):`)
    for (const [k, n] of Object.entries(unknownClave).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(8)} ${n}`)
    }
  }
  console.log('')

  // 5. Pre-state vs target distribution
  const targetByCompany = {}
  for (const [k, n] of Object.entries(beforeByCompany)) targetByCompany[k] = n
  for (const u of updates) {
    targetByCompany[u.from] = (targetByCompany[u.from] || 0) - 1
    targetByCompany[u.to] = (targetByCompany[u.to] || 0) + 1
  }
  console.log('AFTER (projected) — rows by company_id:')
  for (const [k, n] of Object.entries(targetByCompany).sort((a, b) => b[1] - a[1])) {
    if (n === 0 && !beforeByCompany[k]) continue
    console.log(`  ${k.padEnd(20)} ${String(n).padStart(4)}`)
  }
  console.log('')

  if (DRY_RUN) {
    console.log('Dry-run mode — no UPDATE statements issued. Re-run without --dry-run to apply.\n')
    return
  }

  // 6. Apply updates one row at a time (small dataset; 459 rows max)
  console.log('APPLYING…')
  let applied = 0
  let errors = 0
  for (const u of updates) {
    const { error } = await supabase
      .from('aduanet_facturas')
      .update({ company_id: u.to })
      .eq('id', u.id)
    if (error) {
      console.error(`  Row ${u.id}: ${error.message}`)
      errors++
    } else {
      applied++
    }
  }
  console.log(`Applied: ${applied}, Errors: ${errors}\n`)

  // 7. Post-state verification — re-pull and report
  const postRows = await pageAll(() =>
    supabase.from('aduanet_facturas').select('id, clave_cliente, company_id')
  )
  const postByCompany = {}
  for (const r of postRows) {
    const k = r.company_id || 'NULL'
    postByCompany[k] = (postByCompany[k] || 0) + 1
  }
  console.log('AFTER (verified) — rows by company_id:')
  for (const [k, n] of Object.entries(postByCompany).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(20)} ${String(n).padStart(4)}`)
  }
  console.log('')

  // 8. Tenant-isolation invariant check:
  //    - Every (known clave, non-NULL company_id) pair must match the allowlist.
  //    - Unknown claves must have company_id = NULL.
  let mismatchedKnown = 0
  let mismatchedUnknown = 0
  for (const r of postRows) {
    if (!r.clave_cliente) continue
    const expected = claveMap[r.clave_cliente]
    if (expected) {
      if (r.company_id !== expected) mismatchedKnown++
    } else {
      if (r.company_id !== null) mismatchedUnknown++
    }
  }
  if (mismatchedKnown > 0 || mismatchedUnknown > 0) {
    console.log(`⚠️ Post-backfill invariant breach:`)
    console.log(`   ${mismatchedKnown} rows with known clave but wrong company_id`)
    console.log(`   ${mismatchedUnknown} rows with unknown clave but non-NULL company_id`)
    process.exit(1)
  }
  console.log('✅ Tenant invariant holds: every clave_cliente either resolves to its allowlist company_id, or has NULL company_id (unknown ownership).')
})().catch((e) => {
  console.error('FATAL', e.message)
  process.exit(1)
})
