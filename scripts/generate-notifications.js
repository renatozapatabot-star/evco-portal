#!/usr/bin/env node

// ============================================================
// CRUZ Notification Generator — creates notifications from data
// Runs every 30 min to detect events and create notification rows.
// Cron: */30 * * * *
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const PORTAL_DATE_FROM = '2024-01-01'

const CLIENTS = [
  { company_id: 'evco', clave: '9254' },
  { company_id: 'mafesa', clave: '4598' },
]

async function createNotif(companyId, type, severity, title, description, traficoId) {
  if (DRY_RUN) {
    console.log(`  [DRY] ${severity} — ${title}`)
    return
  }
  // Dedup: don't create if same title exists in last 24h
  const cutoff = new Date(Date.now() - 86400000).toISOString()
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('company_id', companyId)
    .eq('title', title)
    .gte('created_at', cutoff)
    .limit(1)
  if (existing && existing.length > 0) return

  await supabase.from('notifications').insert({
    type, severity, title, description,
    trafico_id: traficoId || null,
    company_id: companyId,
    read: false,
  }).then(() => {}, () => {})
}

async function processClient(client) {
  const { company_id } = client
  let created = 0

  // 1. Tráficos crossed in last 24h
  const yesterday = new Date(Date.now() - 86400000).toISOString()
  const { data: crossed } = await supabase
    .from('traficos')
    .select('trafico, descripcion_mercancia')
    .eq('company_id', company_id)
    .ilike('estatus', '%cruz%')
    .gte('fecha_cruce', yesterday)
    .limit(10)

  for (const t of (crossed || [])) {
    await createNotif(company_id, 'success', 'info', `Cruzado: ${t.trafico}`, (t.descripcion_mercancia || '').substring(0, 60), t.trafico)
    created++
  }

  // 2. Missing documents > 3 days
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString()
  const { data: missingDocs } = await supabase
    .from('traficos')
    .select('trafico')
    .eq('company_id', company_id)
    .is('pedimento', null)
    .neq('estatus', 'Cruzado')
    .lt('fecha_llegada', threeDaysAgo)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .limit(5)

  if ((missingDocs || []).length > 0) {
    await createNotif(company_id, 'action_required', 'warning',
      `${missingDocs.length} tráfico(s) sin pedimento > 3 días`,
      'Requieren asignación de pedimento', null)
    created++
  }

  // 3. Pending approvals (admin notification)
  const { count: pendingDrafts } = await supabase
    .from('pedimento_drafts')
    .select('*', { count: 'exact', head: true })
    .in('status', ['draft', 'pending', 'pending_review'])
  if ((pendingDrafts || 0) > 0) {
    await createNotif(company_id, 'action_required', 'info',
      `${pendingDrafts} borrador(es) pendiente(s)`,
      'Usa /aprobar en Telegram para revisar', null)
    created++
  }

  return created
}

async function main() {
  console.log(`🔔 Notification Generator — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  let total = 0
  for (const client of CLIENTS) {
    console.log(`  ${client.company_id}...`)
    const created = await processClient(client)
    total += created
  }

  console.log(`\n✅ ${total} notifications created`)
  process.exit(0)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
