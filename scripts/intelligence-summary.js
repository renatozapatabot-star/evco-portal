require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function summary() {
  const [risk, comp, pred, sup] = await Promise.all([
    s.from('pedimento_risk_scores').select('*', { count: 'exact', head: true }),
    s.from('compliance_predictions').select('severity').eq('resolved', false),
    s.from('crossing_predictions').select('*', { count: 'exact', head: true }),
    s.from('globalpc_proveedores').select('*', { count: 'exact', head: true }),
  ])
  const critical = comp.data?.filter(c => c.severity === 'critical').length || 0
  const warning = comp.data?.filter(c => c.severity === 'warning').length || 0
  const score = Math.max(0, 100 - (critical * 15) - (warning * 5))

  const msg = [
    '🧠 CRUZ Intelligence — ' + new Date().toLocaleDateString('es-MX'),
    '━━━━━━━━━━━━━━━━━━━━━',
    'Risk scores: ' + (risk.count || 0).toLocaleString(),
    'Crossing predictions: ' + (pred.count || 0).toLocaleString(),
    'Compliance score: ' + score + '/100',
    critical > 0 ? '🔴 Críticos: ' + critical : '✅ Sin críticos',
    warning > 0 ? '🟡 Advertencias: ' + warning : '',
    '— CRUZ 🦀'
  ].filter(Boolean).join('\n')

  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = '-5085543275'
  await fetch(
    'https://api.telegram.org/bot' + token + '/sendMessage',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg })
    }
  )
  console.log('Summary sent:', msg)
}

summary().catch(e => { console.error('❌', e.message); process.exit(1) })
