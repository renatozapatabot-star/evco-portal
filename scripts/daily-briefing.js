require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-5085543275'

async function sendTelegram(text) {
  if (process.env.TELEGRAM_SILENT === 'true') {
    console.log('SILENT MODE — would have sent:\n', text)
    return
  }
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
    }
  )
  const json = await res.json()
  if (!json.ok) throw new Error(`Telegram error: ${JSON.stringify(json)}`)
  console.log('✅ Briefing sent to Telegram')
}

async function run() {
  const today = new Date().toISOString().split('T')[0]

  // Pipeline summary
  const { data: pipeline } = await sb
    .from('pipeline_overview')
    .select('pipeline_stage, company_id')

  const stages = {
    needs_docs: (pipeline || []).filter(t => t.pipeline_stage === 'needs_docs').length,
    in_progress: (pipeline || []).filter(t => t.pipeline_stage === 'in_progress').length,
    ready_to_file: (pipeline || []).filter(t => t.pipeline_stage === 'ready_to_file').length,
    ready_to_cross: (pipeline || []).filter(t => t.pipeline_stage === 'ready_to_cross').length,
  }

  // Per-client breakdown
  const clientMap = {}
  for (const t of (pipeline || [])) {
    const cid = t.company_id || 'SIN CLAVE'
    if (!clientMap[cid]) clientMap[cid] = { activos: 0, listos: 0 }
    clientMap[cid].activos++
    if (t.pipeline_stage === 'ready_to_cross') clientMap[cid].listos++
  }
  const topClients = Object.entries(clientMap)
    .sort((a, b) => b[1].activos - a[1].activos)
    .slice(0, 5)

  // Blocking tráficos
  const { data: blocking } = await sb
    .from('trafico_completeness')
    .select('trafico_id, blocking_count')
    .gt('blocking_count', 0)
    .order('blocking_count', { ascending: false })
    .limit(5)

  // Semáforo rojos
  const { data: rojos } = await sb
    .from('traficos')
    .select('trafico, company_id')
    .eq('semaforo', 'rojo')
    .limit(5)

  // Recent entradas (last 24h)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: nuevasEntradas } = await sb
    .from('entradas')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', yesterday)

  // Build message
  const blockingLines = (blocking || []).slice(0, 5)
    .map(b => `   → ${b.trafico_id} (${b.blocking_count} docs faltantes)`)
    .join('\n')

  const rojoLines = (rojos || []).slice(0, 5)
    .map(r => `   → ${r.trafico} (${r.company_id})`)
    .join('\n')

  const message = `☀️ <b>BRIEFING MATUTINO | ${today}</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Renato Zapata &amp; Company

📊 <b>PIPELINE</b>
   Necesitan docs:     ${stages.needs_docs}
   En progreso:        ${stages.in_progress}
   Listos p/despacho:  ${stages.ready_to_file}
   Listos p/cruce:     ${stages.ready_to_cross}
   <b>Total activos: ${Object.values(stages).reduce((a,b) => a+b, 0)}</b>

📦 <b>POR CLIENTE</b>
${topClients.map(([cid, s]) => `   → ${cid}: ${s.activos} activos, ${s.listos} listos p/cruce`).join('\n')}

${blockingLines ? `🚫 <b>DOCS BLOQUEANTES (top 5)</b>\n${blockingLines}\n` : '✅ Sin documentos bloqueantes\n'}
${rojoLines ? `🔴 <b>SEMÁFORO ROJO</b>\n${rojoLines}\n` : ''}
📥 Nuevas entradas (24h): ${nuevasEntradas || 0}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@CRUZ_RZ_BOT | CRUZ Intelligence`

  console.log('Sending briefing...')
  await sendTelegram(message)
}

run().catch(console.error)
