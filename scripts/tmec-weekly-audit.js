const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const CLAVE = '9254'
function fmtMXN(n) { return '$' + Number(n || 0).toLocaleString('es-MX') }

function getLastWeek() { const now = new Date(); const day = now.getDay(); const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7); mon.setHours(0,0,0,0); const sun = new Date(mon); sun.setDate(mon.getDate() + 6); return { start: mon.toISOString().split('T')[0], end: sun.toISOString().split('T')[0] } }

async function generateTMECAuditSection() {
  const week = getLastWeek()
  const { data: facturas } = await supabase.from('aduanet_facturas').select('referencia, pedimento, proveedor, valor_usd, igi, fecha_pago').eq('clave_cliente', CLAVE).gte('fecha_pago', week.start).lte('fecha_pago', week.end).order('fecha_pago', { ascending: false })
  const all = facturas || []; const tmec = all.filter(f => (f.igi || 0) === 0); const igi = all.filter(f => (f.igi || 0) > 0)
  return { period: `${week.start} — ${week.end}`, total_ops: all.length, tmec_ops: tmec.length, igi_ops: igi.length, tmec_pct: all.length > 0 ? ((tmec.length / all.length) * 100).toFixed(1) : '0', total_igi_mxn: igi.reduce((s, f) => s + (f.igi || 0), 0), total_valor_usd: all.reduce((s, f) => s + (f.valor_usd || 0), 0), igi_pedimentos: igi.map(f => ({ referencia: f.referencia, pedimento: f.pedimento, proveedor: (f.proveedor || '').substring(0, 35), igi: f.igi, valor: f.valor_usd })) }
}

async function runTMECWeeklyAudit() {
  console.log('📊 T-MEC Weekly Audit Section\n')
  const data = await generateTMECAuditSection()
  console.log(`Period: ${data.period}`); console.log(`Total: ${data.total_ops} · T-MEC: ${data.tmec_ops} (${data.tmec_pct}%) · IGI: ${data.igi_ops}`)
  console.log(`Total IGI MXN: ${fmtMXN(data.total_igi_mxn)}`)
  if (data.igi_pedimentos.length > 0) { console.log('\nPedimentos with IGI:'); data.igi_pedimentos.forEach(p => console.log(`  ${p.referencia} — ${p.proveedor} — IGI: ${fmtMXN(p.igi)}`)) }
  else console.log('\n✅ T-MEC applied on ALL operations this week')
  return data
}
module.exports = { generateTMECAuditSection, runTMECWeeklyAudit }
runTMECWeeklyAudit().catch(console.error)
