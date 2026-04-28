#!/usr/bin/env node

// ============================================================
// CRUZ · Anexo 24 UMC audit (read-only)
//
// Sanity-checks `globalpc_productos.umt` coverage per tenant. The
// reference Excel from GlobalPC for EVCO 2026-Q1 shows UMC empty on
// every row — that's a data-source gap, not an export bug. This
// script reports the gap so we can decide whether to backfill from
// `globalpc_partidas.umt` (where it sometimes survives the import)
// or from a fracción → UMC catalog.
//
// Run:  node scripts/anexo24-umc-audit.js [--company evco]
// Exit: 0 always — read-only audit, never blocks anything.
// ============================================================

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function auditTenant(companyId) {
  // Total productos for the tenant.
  const { count: total, error: totalErr } = await sb
    .from('globalpc_productos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
  if (totalErr) throw new Error(`productos count: ${totalErr.message}`)

  // Null-umt productos.
  const { count: nullCount, error: nullErr } = await sb
    .from('globalpc_productos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .is('umt', null)
  if (nullErr) throw new Error(`null umt count: ${nullErr.message}`)

  // Active parts (parts with at least one partida) for the tenant.
  const { data: activeRows, error: activeErr } = await sb
    .from('globalpc_partidas')
    .select('cve_producto')
    .eq('company_id', companyId)
    .not('cve_producto', 'is', null)
    .limit(50000)
  if (activeErr) throw new Error(`active parts: ${activeErr.message}`)

  const active = new Set()
  for (const r of activeRows ?? []) if (r.cve_producto) active.add(r.cve_producto)

  // Active productos with null umt — the backfill target.
  let activeNullUmt = 0
  if (active.size > 0) {
    const cves = Array.from(active)
    for (let i = 0; i < cves.length; i += 1000) {
      const batch = cves.slice(i, i + 1000)
      const { count, error } = await sb
        .from('globalpc_productos')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('umt', null)
        .in('cve_producto', batch)
      if (error) throw new Error(`active+null umt: ${error.message}`)
      activeNullUmt += count ?? 0
    }
  }

  return {
    company_id: companyId,
    total_productos: total ?? 0,
    null_umt: nullCount ?? 0,
    null_umt_pct: total ? Math.round(((nullCount ?? 0) / total) * 1000) / 10 : 0,
    active_partidas: activeRows?.length ?? 0,
    active_distinct_cves: active.size,
    active_null_umt: activeNullUmt,
    active_null_umt_pct: active.size ? Math.round((activeNullUmt / active.size) * 1000) / 10 : 0,
  }
}

async function main() {
  const argCompany = process.argv.find((a) => a.startsWith('--company='))?.split('=')[1]
  const companies = argCompany
    ? [argCompany]
    : (await sb.from('companies').select('company_id').eq('active', true)).data?.map((c) => c.company_id) ?? []

  console.log(`Auditing ${companies.length} tenant(s)...\n`)
  for (const companyId of companies) {
    try {
      const report = await auditTenant(companyId)
      const line1 = `[${report.company_id}] productos: ${report.total_productos} · null umt: ${report.null_umt} (${report.null_umt_pct}%)`
      const line2 = `  active distinct cves: ${report.active_distinct_cves} · active+null umt: ${report.active_null_umt} (${report.active_null_umt_pct}%)`
      console.log(line1)
      console.log(line2)
      if (report.active_null_umt_pct >= 80) {
        console.log('  → SOURCE GAP: GlobalPC mirror has no UMC for most active parts. Backfill via partidas.umt or fracción catalog.')
      } else if (report.active_null_umt_pct >= 30) {
        console.log('  → PARTIAL GAP: a sync-script fix may close this. Investigate before backfill.')
      } else {
        console.log('  → OK: UMC coverage on active parts is acceptable.')
      }
      console.log()
    } catch (err) {
      console.error(`[${companyId}] ${err.message}`)
    }
  }
}

main().catch((err) => {
  console.error(err.stack || err.message)
  process.exit(1)
})
