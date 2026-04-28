#!/usr/bin/env node
/**
 * V1 Readiness — NULL-company_id audit.
 * Reports counts of tenant-scoped rows with company_id IS NULL.
 * Read-only. Exit 0 always.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const TABLES = [
  'traficos',
  'entradas',
  'expediente_documentos',
  'pedimentos',
  'pedimento_drafts',
  'globalpc_productos',
  'globalpc_partidas',
  'globalpc_facturas',
  'globalpc_eventos',
  'globalpc_proveedores',
  'anexo24_partidas',
  'aduanet_facturas',
  'facturas',
  'productos',
  'trafico_events',
  'operational_decisions',
  'agent_decisions',
  'operator_actions',
  'notifications',
  'mensajeria_messages',
  'whatsapp_conversations',
  'workflow_events',
  'pedimento_transportistas',
  'trade_prospects',
  'documento_solicitudes',
  'supplier_network_scores',
]

async function auditTable(t) {
  const totalRes = await supabase.from(t).select('*', { count: 'exact', head: true })
  if (totalRes.error) {
    return { table: t, status: totalRes.error.code === '42P01' ? 'MISSING' : 'ERROR', err: totalRes.error.message }
  }
  const total = totalRes.count ?? 0

  const nullRes = await supabase.from(t).select('*', { count: 'exact', head: true }).is('company_id', null)
  if (nullRes.error) {
    // Table may not have company_id column (e.g. platform tables)
    return { table: t, status: 'NO_COMPANY_ID', total, err: nullRes.error.message }
  }
  const nulls = nullRes.count ?? 0
  return { table: t, status: nulls === 0 ? 'OK' : 'LEAK', total, nulls, pct: total ? ((nulls / total) * 100).toFixed(2) : '0.00' }
}

;(async () => {
  console.log('Table'.padEnd(30), 'Status'.padEnd(14), 'Total'.padStart(12), 'NULL'.padStart(10), '% NULL'.padStart(8))
  console.log('-'.repeat(80))
  let leaks = 0
  for (const t of TABLES) {
    const r = await auditTable(t)
    if (r.status === 'LEAK') leaks++
    const totalStr = r.total != null ? String(r.total) : '-'
    const nullStr = r.nulls != null ? String(r.nulls) : '-'
    const pctStr = r.pct != null ? `${r.pct}%` : '-'
    console.log(
      r.table.padEnd(30),
      r.status.padEnd(14),
      totalStr.padStart(12),
      nullStr.padStart(10),
      pctStr.padStart(8),
      r.err ? `(${r.err.slice(0, 50)})` : '',
    )
  }
  console.log('-'.repeat(80))
  console.log(`Tables with NULL company_id: ${leaks}`)
})()
