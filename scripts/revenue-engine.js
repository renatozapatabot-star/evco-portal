#!/usr/bin/env node
/**
 * CRUZ Revenue Engine
 * Calculates platform value and savings generated
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log('\n💰 REVENUE ENGINE')
  console.log('═'.repeat(40))

  const { data: companies } = await supabase
    .from('companies').select('*').eq('active', true)
  const activeClients = companies?.length || 0

  // T-MEC savings
  const { data: tmecOps } = await supabase
    .from('aduanet_facturas')
    .select('valor_usd, igi')
    .eq('igi', 0)
    .limit(10000)
  const tmecSavings = (tmecOps || []).reduce((s, f) => s + (f.valor_usd || 0) * 0.05, 0)

  // Pedimentos processed
  const { count: pedCount } = await supabase
    .from('aduanet_facturas')
    .select('*', { count: 'exact', head: true })

  // Documents auto-processed
  const { count: docCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
  const { count: expDocCount } = await supabase
    .from('expediente_documentos')
    .select('*', { count: 'exact', head: true })

  // Alerts sent
  const { count: alertCount } = await supabase
    .from('communication_events')
    .select('*', { count: 'exact', head: true })

  // CRUZ conversations
  const { count: convCount } = await supabase
    .from('cruz_conversations')
    .select('*', { count: 'exact', head: true })

  // Scrape runs (automation)
  const { count: scrapeCount } = await supabase
    .from('scrape_runs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'success')

  const revenue = {
    active_clients: activeClients,
    pedimentos_processed: pedCount || 0,
    tmec_savings_usd: Math.round(tmecSavings),
    tmec_savings_mxn: Math.round(tmecSavings * 17.5),
    documents_processed: (docCount || 0) + (expDocCount || 0),
    alerts_sent: alertCount || 0,
    ai_conversations: convCount || 0,
    automation_runs: scrapeCount || 0,
    estimated_hours_saved: Math.round(((scrapeCount || 0) * 0.5) + ((docCount || 0) * 0.02)),
    saas_value_monthly_mxn: activeClients * 3500,
    saas_value_annual_mxn: activeClients * 3500 * 12,
    calculated_at: new Date().toISOString()
  }

  console.log(`  Clients: ${revenue.active_clients}`)
  console.log(`  Pedimentos: ${revenue.pedimentos_processed}`)
  console.log(`  T-MEC savings: $${revenue.tmec_savings_usd.toLocaleString()} USD`)
  console.log(`  Documents: ${revenue.documents_processed}`)
  console.log(`  Hours saved: ${revenue.estimated_hours_saved}`)
  console.log(`  SaaS value: MX$${revenue.saas_value_monthly_mxn.toLocaleString()}/month`)

  await supabase.from('financial_intelligence').upsert({
    company_id: 'platform',
    metric_name: 'revenue_metrics',
    metric_value: revenue.saas_value_annual_mxn,
    details: revenue,
    calculated_at: new Date().toISOString()
  }, { onConflict: 'company_id,metric_name' })
}

run().catch(console.error)
