const {createClient} = require('@supabase/supabase-js')
require('dotenv').config({path: '.env.local'})
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const tables = [
  'traficos','entradas','expediente_documentos','companies',
  'cruz_memory','benchmarks','fraccion_patterns','learned_patterns',
  'email_classification_history','shadow_classifications',
  'agent_decisions','operational_decisions','workflow_events',
  'po_predictions','staged_traficos','po_prediction_accuracy',
  'inventory_estimates','stockout_warnings','cost_savings',
  'exception_hypotheses','negotiation_briefs','doc_templates',
  'compliance_risk_scores','carrier_scoreboard','client_profitability',
  'competitive_intel','client_profiles','client_readiness',
  'autonomy_config','self_healing_log'
]

async function run() {
  console.log('=== CRUZ AUDIT ===')
  for (const t of tables) {
    const r = await sb.from(t).select('id',{count:'exact',head:true})
    const mark = r.error ? 'X ' : (r.count > 0 ? 'OK' : '..')
    const val = r.error ? 'MISSING' : (r.count ?? 0)
    console.log(mark, t.padEnd(35), val)
  }
}
run()
