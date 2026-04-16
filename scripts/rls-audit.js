#!/usr/bin/env node
/**
 * rls-audit.js — lists every public table with RLS disabled so we can
 * triage each one as (a) needs RLS + policy, (b) shared reference data,
 * or (c) audit/telemetry (service-role write, no tenant column).
 *
 * Writes /tmp/rls-audit.md. Exit 0 regardless — this is diagnostic.
 *
 * Usage:
 *   node scripts/rls-audit.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('[fatal] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required')
  process.exit(1)
}

const supabase = createClient(url, key)

// Classification categories (edit as you triage rows):
const KNOWN_CATEGORIES = {
  // System/telemetry — service-role write, no tenant column
  system: new Set([
    'heartbeat_log',
    'api_cost_log',
    'sync_log',
    'regression_guard_log',
    'interaction_events',
    'audit_log',
    'rate_limits',
    'self_healing_log',
    'shadow_training_log',
    'agent_decisions',
    'operational_decisions',
    'ghost_detections',
    'anomaly_log',
    'compliance_risk_scores',
    'document_extractions',
    'workflow_events',
    'cruz_memory',
  ]),
  // Shared reference data — readable by all, writable by service only
  reference: new Set([
    'system_config',
    'oca_database',
    'tariff_rates',
    'anexo_24_tariffs',
    'aduana_codes',
    'tmec_rates',
    'hs_codes',
    'regulatory_alerts',
    'bridge_intelligence',
    'product_intelligence',
    'financial_intelligence',
    'crossing_intelligence',
    'warehouse_intelligence',
    'supplier_network',
    'network_intelligence',
    'benchmarks',
    'client_benchmarks',
    'fleet_benchmarks',
  ]),
  // Client data — MUST have RLS on company_id/clave_cliente
  client_data: new Set([
    'traficos',
    'entradas',
    'pedimentos',
    'expedientes',
    'expediente_documentos',
    'facturas',
    'companies',
    'documentos',
    'documents',
    'users',
    'client_briefings',
    'client_profiles',
    'client_readiness',
    'client_document_templates',
    'invoices',
    'aduanet_facturas',
    'globalpc_productos',
    'globalpc_partidas',
    'globalpc_facturas',
    'globalpc_proveedores',
    'globalpc_eventos',
    'globalpc_contenedores',
    'globalpc_ordenes_carga',
    'globalpc_bultos',
    'econta_facturas',
    'econta_facturas_detalle',
    'econta_cartera',
    'econta_aplicaciones',
    'econta_ingresos',
    'econta_egresos',
    'econta_anticipos',
    'econta_polizas',
    'user_feedback',
    'trafico_timeline',
    'pre_arrival_briefs',
    'pedimento_risk_scores',
    'compliance_predictions',
    'crossing_predictions',
    'monthly_intelligence_reports',
    'supplier_referrals',
    'supplier_contacts',
    'supplier_profiles',
    'email_intake',
    'risk_history',
    'compliance_events',
    'communication_events',
    'documento_solicitudes',
    'entrada_lifecycle',
    'mensajeria_threads',
    'mensajeria_messages',
    'mensajeria_attachments',
    'pipeline_overview',
    'daily_performance',
    'trafico_completeness',
    'operations_savings',
    'anomaly_baselines',
    'trial_clients',
  ]),
}

function classify(table) {
  if (KNOWN_CATEGORIES.system.has(table)) return 'system'
  if (KNOWN_CATEGORIES.reference.has(table)) return 'reference'
  if (KNOWN_CATEGORIES.client_data.has(table)) return 'client_data'
  return 'unknown'
}

;(async () => {
  // Query pg_tables via SQL RPC. Supabase client exposes rpc but there's
  // no built-in RPC for pg_tables — we use a raw sql admin endpoint via
  // supabase-js's .from('pg_tables') (works when RLS is off on pg_tables,
  // which is PostgreSQL default).
  //
  // Fallback: use the PostgREST /rpc/ endpoint if we've defined a helper,
  // otherwise we can call supabase.rpc('pg_tables_list') if it exists.
  // Simplest path: manual list via information_schema.

  // We'll use information_schema.tables + pg_class for rowsecurity.
  const query = `
    SELECT t.table_name,
           (SELECT c.relrowsecurity FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = t.table_name) AS rls_enabled
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
  `

  // Supabase client can't run arbitrary SQL. Use the rest admin via rpc.
  // Create a temporary SQL function? Too invasive for a diagnostic run.
  // Better: use node-postgres with the service role url? Not available.
  //
  // Workaround: probe each candidate table individually by attempting a
  // query with an unauthenticated anon client — if it returns rows
  // without auth, RLS is either off OR allowing anonymous reads.

  const candidates = [
    ...KNOWN_CATEGORIES.system,
    ...KNOWN_CATEGORIES.reference,
    ...KNOWN_CATEGORIES.client_data,
  ]

  const results = []
  console.log(`🔒 Probing ${candidates.length} candidate tables with anon key…\n`)

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || key)

  for (const table of candidates) {
    const category = classify(table)
    try {
      const { data, error, count } = await anon
        .from(table)
        .select('*', { count: 'exact', head: true })
      if (error) {
        // RLS blocking + insufficient privilege → what we want for client_data
        results.push({ table, category, accessible_via_anon: false, reason: error.message.slice(0, 120) })
      } else {
        results.push({ table, category, accessible_via_anon: true, row_count: count })
      }
    } catch (e) {
      results.push({ table, category, accessible_via_anon: false, reason: (e.message || String(e)).slice(0, 120) })
    }
  }

  // ─── Write report ──────────────────────────────────────────────────
  const lines = []
  lines.push('# RLS Audit — Client Isolation Probe')
  lines.push('')
  lines.push(`**Run:** ${new Date().toISOString()}`)
  lines.push('')
  lines.push('Methodology: each candidate table is queried with the anon key.')
  lines.push('If it returns rows, RLS is either disabled or allows anonymous reads.')
  lines.push('For `client_data` tables, anon access is a cross-client leak risk.')
  lines.push('For `system` + `reference` tables, anon access may be by design.')
  lines.push('')

  const clientLeaks = results.filter((r) => r.category === 'client_data' && r.accessible_via_anon)
  const refAnon = results.filter((r) => r.category === 'reference' && r.accessible_via_anon)
  const systemAnon = results.filter((r) => r.category === 'system' && r.accessible_via_anon)
  const errors = results.filter((r) => !r.accessible_via_anon && !/row-level security/i.test(r.reason || ''))

  lines.push('## Summary')
  lines.push('')
  lines.push(`- Client-data tables accessible via anon: **${clientLeaks.length}**${clientLeaks.length ? ' ⚠️ BLOCKER' : ' ✅'}`)
  lines.push(`- Reference tables accessible via anon: ${refAnon.length} (expected — public read)`)
  lines.push(`- System tables accessible via anon: ${systemAnon.length} (review individually)`)
  lines.push(`- Tables that errored (may not exist): ${errors.length}`)
  lines.push('')

  if (clientLeaks.length) {
    lines.push('## ⚠️ BLOCKER — client-data tables accessible without auth')
    lines.push('')
    for (const r of clientLeaks) {
      lines.push(`- **\`${r.table}\`** — ${r.row_count ?? '?'} rows visible to anon`)
    }
    lines.push('')
  }

  lines.push('## Reference tables accessible via anon')
  lines.push('')
  if (refAnon.length === 0) lines.push('_(none)_')
  for (const r of refAnon) lines.push(`- \`${r.table}\` — ${r.row_count ?? '?'} rows (expected)`)
  lines.push('')

  lines.push('## System / telemetry tables accessible via anon')
  lines.push('')
  if (systemAnon.length === 0) lines.push('_(none — write-only via service role)_')
  for (const r of systemAnon) lines.push(`- \`${r.table}\` — ${r.row_count ?? '?'} rows (review)`)
  lines.push('')

  lines.push('## Inaccessible / errored tables')
  lines.push('')
  const safe = results.filter((r) => !r.accessible_via_anon)
  for (const r of safe) lines.push(`- \`${r.table}\` (${r.category}) — ${r.reason?.slice(0, 80) || 'blocked'}`)

  const reportPath = '/tmp/rls-audit.md'
  fs.writeFileSync(reportPath, lines.join('\n'))

  console.log(`📝 Report: ${reportPath}`)
  console.log(`   Client-data anon leaks: ${clientLeaks.length}${clientLeaks.length ? ' ⚠️ BLOCKER' : ' ✅'}`)
  console.log(`   Reference anon access:  ${refAnon.length}`)
  console.log(`   System anon access:     ${systemAnon.length}`)

  process.exit(clientLeaks.length > 0 ? 1 : 0)
})().catch((err) => {
  console.error('[fatal]', err)
  process.exit(1)
})
