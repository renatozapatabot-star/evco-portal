const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN; const TELEGRAM_CHAT = '-5085543275'
function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }
function getWeekStart(w = 0) { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1 - w * 7); d.setHours(0, 0, 0, 0); return d.toISOString().split('T')[0] }
async function sendTG(msg) { if (!TELEGRAM_TOKEN) { console.log(msg); return }; await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }) }) }
  if (process.env.TELEGRAM_SILENT === 'true') return
async function getWeek(s, e) { const [t, f] = await Promise.all([supabase.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', 'evco').gte('fecha_llegada', s).lte('fecha_llegada', e), supabase.from('aduanet_facturas').select('valor_usd').eq('clave_cliente', '9254').gte('fecha_pago', s).lte('fecha_pago', e)]); return { traficos: t.count || 0, valor: (f.data || []).reduce((s, x) => s + (x.valor_usd || 0), 0) } }
async function run() {
  console.log('📈 Running KPI Trend Alerts...\n')
  const tw = await getWeek(getWeekStart(0), new Date().toISOString().split('T')[0])
  const weeks = await Promise.all([1,2,3,4].map(i => getWeek(getWeekStart(i), getWeekStart(i - 1))))
  const avgT = weeks.reduce((s, w) => s + w.traficos, 0) / 4; const avgV = weeks.reduce((s, w) => s + w.valor, 0) / 4
  const tPct = avgT > 0 ? ((tw.traficos - avgT) / avgT) * 100 : 0; const vPct = avgV > 0 ? ((tw.valor - avgV) / avgV) * 100 : 0
  console.log(`This week: ${tw.traficos} tráficos · ${fmtUSD(tw.valor)}`); console.log(`4-week avg: ${Math.round(avgT)} tráficos · ${fmtUSD(avgV)}`); console.log(`Change: tráficos ${tPct.toFixed(1)}% · valor ${vPct.toFixed(1)}%`)
  const alerts = []; if (tPct < -30) alerts.push(`📉 VOLUMEN BAJO — Tráficos ${tPct.toFixed(1)}%`); if (tPct > 50) alerts.push(`🚀 VOLUMEN ALTO — +${tPct.toFixed(1)}%`); if (vPct < -40) alerts.push(`📉 VALOR BAJO — ${fmtUSD(tw.valor)} vs ${fmtUSD(avgV)}`)
  if (alerts.length > 0) { await sendTG([`⚠️ <b>KPI ALERT</b>`, ...alerts, `Esta sem: ${tw.traficos} tráf · ${fmtUSD(tw.valor)}`, `Prom 4 sem: ${Math.round(avgT)} tráf · ${fmtUSD(avgV)}`, `— CRUZ 🦀`].join('\n')); console.log(`\n⚠️ ${alerts.length} alert(s) sent`) }
  else console.log('\n✅ KPIs within normal range')
}
run().catch(console.error)
