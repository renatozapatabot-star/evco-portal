const { createClient } = require('@supabase/supabase-js')
const { google } = require('googleapis')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const CLAVE = '9254'
const AUTO_SEND = process.env.AUTO_SEND === 'true'

const TO = 'ursula_b@evcoplastics.com.mx'
const CC = 'tito@renatozapata.com, ai@renatozapata.com'
const FROM = process.env.GMAIL_FROM || 'ai@renatozapata.com'

function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }
function fmtMXN(n) { return '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 }) }

async function sendTelegram(msg) {
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  })
}

function getWeekRange() {
  const now = new Date(); const day = now.getDay()
  const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - 7)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return {
    start: mon.toISOString().split('T')[0], end: sun.toISOString().split('T')[0],
    label: `${mon.toLocaleDateString('es-MX', { day: '2-digit', month: 'long' })} — ${sun.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    weekNum: getWeekNum(mon),
  }
}

function getWeekNum(d) {
  const date = new Date(d); date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7)
  const w1 = new Date(date.getFullYear(), 0, 4)
  return 1 + Math.round(((date - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7)
}

async function generateEmailContent() {
  const week = getWeekRange()
  console.log(`📧 Generating weekly audit email — ${week.label}`)

  const [trafRes, factRes, entRes] = await Promise.all([
    supabase.from('traficos').select('trafico, estatus, fecha_llegada, descripcion_mercancia, peso_bruto, importe_total')
      .eq('company_id', 'evco').gte('fecha_llegada', week.start).lte('fecha_llegada', week.end).order('fecha_llegada', { ascending: false }),
    supabase.from('aduanet_facturas').select('referencia, pedimento, proveedor, valor_usd, dta, igi, iva, fecha_pago')
      .eq('clave_cliente', CLAVE).gte('fecha_pago', week.start).lte('fecha_pago', week.end),
    supabase.from('entradas').select('cve_entrada, tiene_faltantes, mercancia_danada')
      .eq('company_id', 'evco').limit(200),
  ])

  const traficos = trafRes.data || []
  const facturas = factRes.data || []
  const entradas = entRes.data || []
  const totalValor = facturas.reduce((s, f) => s + (f.valor_usd || 0), 0)
  const totalDTA = facturas.reduce((s, f) => s + (f.dta || 0), 0)
  const totalIGI = facturas.reduce((s, f) => s + (f.igi || 0), 0)
  const totalIVA = facturas.reduce((s, f) => s + (f.iva || 0), 0)
  const tmecCount = facturas.filter(f => (f.igi || 0) === 0).length
  const faltantes = entradas.filter(e => e.tiene_faltantes).length
  const danadas = entradas.filter(e => e.mercancia_danada).length

  const subject = `Auditoría Semanal EVCO — Semana ${week.weekNum}, ${week.label}`

  const bodyHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F7F6F3;margin:0;padding:20px;color:#18160F}
.c{max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E6E3DC}
.hdr{background:#0D2340;padding:28px 32px}.hdr h1{color:#fff;margin:0;font-size:20px;font-weight:700}
.hdr p{color:rgba(255,255,255,0.5);margin:6px 0 0;font-size:13px}
.gold-bar{height:3px;background:linear-gradient(90deg,#C9A84C,#E8C84A)}
.body{padding:28px 32px}.kpi-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:20px 0}
.kpi{background:#F7F6F3;border:1px solid #E6E3DC;border-radius:8px;padding:12px 16px}
.kpi-l{font-size:10px;color:#9C9690;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;font-weight:700}
.kpi-v{font-size:18px;font-weight:700;color:#0D2340}
table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#F7F6F3;padding:8px 12px;text-align:left;font-size:10px;color:#9C9690;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #E6E3DC}
td{padding:8px 12px;border-bottom:1px solid #F0F0F0;font-size:12px;color:#333}
.green{color:#166534}.amber{color:#92400E}.red{color:#991B1B}
.ft{padding:20px 32px;border-top:1px solid #E6E3DC;font-size:11px;color:#9C9690;line-height:1.6}
.sig{margin-top:24px;font-size:13px}.sig strong{color:#18160F;display:block;font-size:14px}.sig span{color:#68635A}
</style></head><body><div class="c">
<div class="hdr"><h1>Auditoría Semanal de Importaciones</h1><p>EVCO Plastics de México · Semana ${week.weekNum}, ${new Date().getFullYear()}</p></div>
<div class="gold-bar"></div>
<div class="body">
<p style="font-size:15px;line-height:1.6">Estimada Ursula,</p>
<p style="font-size:13px;color:#68635A;line-height:1.6">Adjunto el resumen de operaciones aduanales correspondiente a la semana del <strong>${week.label}</strong>.</p>

<div class="kpi-grid">
<div class="kpi"><div class="kpi-l">Tráficos</div><div class="kpi-v">${traficos.length}</div></div>
<div class="kpi"><div class="kpi-l">Valor Importado</div><div class="kpi-v">${fmtUSD(totalValor)}</div></div>
<div class="kpi"><div class="kpi-l">Pedimentos</div><div class="kpi-v">${facturas.length}</div></div>
<div class="kpi"><div class="kpi-l">T-MEC Aplicado</div><div class="kpi-v class="green"">${tmecCount}/${facturas.length}</div></div>
</div>

<div style="background:#F7F6F3;border:1px solid #E6E3DC;border-radius:8px;padding:12px 16px;margin:16px 0">
<p style="margin:0;font-size:12px;color:#68635A"><strong>DTA:</strong> ${fmtMXN(totalDTA)} · <strong>IGI:</strong> ${totalIGI === 0 ? '<span class="green">T-MEC $0 ✓</span>' : fmtMXN(totalIGI)} · <strong>IVA:</strong> ${fmtMXN(totalIVA)}</p>
</div>

${traficos.length > 0 ? `<table><thead><tr><th>Tráfico</th><th>Estado</th><th>Fecha</th><th>Descripción</th></tr></thead><tbody>
${traficos.slice(0, 10).map(t => `<tr><td style="font-weight:600;color:#0D2340">${t.trafico}</td><td>${t.estatus || '—'}</td><td style="color:#9C9690">${t.fecha_llegada ? new Date(t.fecha_llegada).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—'}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(t.descripcion_mercancia || '—').substring(0, 40)}</td></tr>`).join('')}
</tbody></table>` : '<p style="color:#9C9690;font-size:13px">Sin tráficos en este período.</p>'}

${(faltantes > 0 || danadas > 0) ? `<div style="background:#FEF3C7;border:1px solid #F59E0B30;border-radius:8px;padding:12px 16px;margin:16px 0">
<p style="margin:0;font-size:12px;color:#92400E;font-weight:600">⚠️ Incidencias: ${faltantes} faltantes · ${danadas} con daño</p></div>` : ''}

<p style="font-size:13px;color:#68635A;margin-top:20px">Para consultar el estado de sus operaciones en tiempo real:</p>
<a href="https://evco-portal.vercel.app" style="display:inline-block;background:#0D2340;color:#fff;padding:10px 20px;border-radius:7px;text-decoration:none;font-size:13px;font-weight:600;margin:8px 0">Ver Portal EVCO →</a>

<div class="sig"><strong>Renato Zapata III</strong><span>Director General — Renato Zapata & Company</span><span>Patente 3596 · Aduana 240 Nuevo Laredo</span></div>
</div>
<div class="ft">CRUZ Intelligence Platform · Reporte generado automáticamente<br>Grupo Aduanal Renato Zapata S.C. · evco-portal.vercel.app</div>
</div></body></html>`

  const bodyText = `Auditoría Semanal EVCO — ${week.label}\nTráficos: ${traficos.length}\nValor: ${fmtUSD(totalValor)}\nPedimentos: ${facturas.length}\nT-MEC: ${tmecCount}/${facturas.length}\n\nPortal: evco-portal.vercel.app`

  return { subject, bodyHtml, bodyText, week, stats: { traficos: traficos.length, valor: totalValor, pedimentos: facturas.length, tmec: tmecCount } }
}

async function queueEmail(to, cc, subject, bodyHtml, bodyText, metadata) {
  // Try email_queue table first, fall back to communication_events
  const record = {
    email_id: `audit-${Date.now()}`,
    tenant_slug: 'evco',
    from_address: FROM,
    subject,
    date: new Date().toISOString(),
    is_urgent: false,
    scanned_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('communication_events').insert(record)
  if (error) console.log('Queue log error:', error.message)

  // Save HTML preview to Desktop
  const previewPath = path.join(process.env.HOME, 'Desktop', `email-preview-${Date.now()}.html`)
  fs.writeFileSync(previewPath, bodyHtml)

  const queueId = `eq-${Date.now()}`

  // Send Telegram approval request
  await sendTelegram([
    `📧 <b>EMAIL PENDIENTE APROBACIÓN</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Para: ${to}`,
    `CC: ${cc}`,
    `Asunto: ${subject}`,
    ``,
    `Preview:`,
    `${bodyText.substring(0, 200)}...`,
    ``,
    `📄 Preview: ~/Desktop/email-preview-*.html`,
    `✅ Aprobar: <code>/aprobar_${queueId}</code>`,
    `❌ Cancelar: <code>/cancelar_${queueId}</code>`,
    `✏️ Portal: evco-portal.vercel.app/comunicaciones`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `— CRUZ 🦀`
  ].join('\n'))

  console.log(`📋 Email queued for approval: ${queueId}`)
  console.log(`   Preview saved: ${previewPath}`)
  return queueId
}

async function sendViaGmail(to, cc, subject, bodyHtml) {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_REFRESH_TOKEN) {
    console.log('⚠️  Gmail OAuth not configured — email NOT sent')
    return false
  }

  const oauth2 = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, 'https://developers.google.com/oauthplayground')
  oauth2.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  const gmail = google.gmail({ version: 'v1', auth: oauth2 })

  const message = [
    `From: "Renato Zapata III" <${FROM}>`,
    `To: ${to}`,
    `Cc: ${cc}`,
    `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    bodyHtml,
  ].join('\r\n')

  const raw = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const { data } = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
  console.log(`✅ Email sent via Gmail: ${data.id}`)
  return true
}

async function run() {
  console.log('📧 Weekly Audit Email Generator\n')

  const { subject, bodyHtml, bodyText, week, stats } = await generateEmailContent()
  console.log(`Week: ${week.label}`)
  console.log(`Stats: ${stats.traficos} tráficos, ${fmtUSD(stats.valor)}, ${stats.pedimentos} pedimentos, T-MEC ${stats.tmec}/${stats.pedimentos}`)

  if (AUTO_SEND) {
    console.log('\n🚀 AUTO_SEND=true — sending immediately')
    const sent = await sendViaGmail(TO, CC, subject, bodyHtml)
    if (sent) await sendTelegram(`✅ <b>Auditoría semanal enviada</b>\nPara: ${TO}\nSemana ${week.weekNum}\n— CRUZ 🦀`)
    else console.log('❌ Failed to send')
  } else {
    console.log('\n⏳ AUTO_SEND=false — queuing for approval')
    await queueEmail(TO, CC, subject, bodyHtml, bodyText, { week: week.weekNum })
  }
}

run().catch(err => { console.error('Fatal:', err); process.exit(1) })
