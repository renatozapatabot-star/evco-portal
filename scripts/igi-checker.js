const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN; const TELEGRAM_CHAT = '-5085543275'; const CLAVE = '9254'
function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }
function fmtMXN(n) { return '$' + Number(n || 0).toLocaleString('es-MX') }
async function sendTG(msg) { if (!TELEGRAM_TOKEN) { console.log(msg); return }; await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }) }) }

async function runIGIChecker() {
  console.log('🔍 IGI Post-Pedimento Checker\n')
  const cutoff = new Date(Date.now() - 48 * 3600000).toISOString().split('T')[0]
  const { data: facturas } = await supabase.from('aduanet_facturas').select('referencia, pedimento, proveedor, valor_usd, igi, fecha_pago').eq('clave_cliente', CLAVE).gt('igi', 0).gte('fecha_pago', cutoff).order('fecha_pago', { ascending: false })
  console.log(`Recent pedimentos with IGI > 0: ${(facturas || []).length}`)
  if (!facturas || facturas.length === 0) { console.log('✅ No recent pedimentos with IGI paid'); return }

  const alerts = []
  for (const f of facturas) {
    if (!f.proveedor) continue
    const { data: hist } = await supabase.from('aduanet_facturas').select('referencia').eq('clave_cliente', CLAVE).eq('proveedor', f.proveedor).eq('igi', 0).limit(1)
    if ((hist || []).length > 0) {
      alerts.push(f)
      console.log(`  ⚠️  ${f.referencia} — ${f.proveedor} — IGI: ${fmtMXN(f.igi)} (has T-MEC history)`)
    } else { console.log(`  ✅ ${f.referencia} — ${f.proveedor} (no T-MEC history — IGI expected)`) }
  }

  if (alerts.length === 0) { console.log('\n✅ All recent IGI payments expected'); return }
  const totalIGI = alerts.reduce((s, a) => s + (a.igi || 0), 0)
  await sendTG([`🚨 <b>IGI ALERT — T-MEC NO APLICADO</b>`, `${alerts.length} pedimento(s) · IGI total: <b>${fmtMXN(totalIGI)}</b>`, '', ...alerts.slice(0, 5).map(a => `🔴 ${a.referencia} · ${(a.proveedor || '').substring(0, 35)} · IGI: ${fmtMXN(a.igi)}`), '', `⚡ Verificar certificados T-MEC`, `— CRUZ 🦀`].join('\n'))
  console.log(`\n🚨 Alert sent — ${alerts.length} pedimentos with avoidable IGI`)
}
module.exports = { runIGIChecker }
runIGIChecker().catch(err => { console.error('Fatal:', err); process.exit(1) })
