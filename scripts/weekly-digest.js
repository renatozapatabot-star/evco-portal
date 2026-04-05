#!/usr/bin/env node
/**
 * CRUZ — Weekly Digest Email
 *
 * Generates and sends a weekly operations summary to each client.
 * Includes: traficos this week, status breakdown, T-MEC savings,
 * upcoming deadlines, and a link to the portal.
 *
 * Usage:
 *   node scripts/weekly-digest.js              # Send to all clients
 *   node scripts/weekly-digest.js --dry-run     # Preview only
 *   node scripts/weekly-digest.js --client evco  # Single client
 *
 * Cron: 0 8 * * 1  (Monday 8 AM)
 *
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'weekly-digest'
const DRY_RUN = process.argv.includes('--dry-run')
const SINGLE_CLIENT = process.argv.find(a => a.startsWith('--client='))?.split('=')[1]
  || (process.argv.includes('--client') ? process.argv[process.argv.indexOf('--client') + 1] : null)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'
const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'CRUZ — Renato Zapata & Co. <ai@renatozapata.com>'
const PORTAL_URL = 'https://evco-portal.vercel.app'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CLIENT_CONTACTS = {
  evco: { name: 'Ursula Banda', email: 'ursula.banda@evco.com.mx', company: 'EVCO Plastics de México' },
  // mafesa: { name: '...', email: '...', company: 'MAFESA' },
}

async function sendTelegram(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

function fmtUSD(n) {
  return '$' + Math.round(n).toLocaleString('en-US')
}

function buildDigestHtml(contact, stats) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1A1A1A;max-width:600px;margin:0 auto;padding:20px;">
  <div style="border-bottom:3px solid #C4963C;padding-bottom:12px;margin-bottom:24px;">
    <h2 style="margin:0;font-size:18px;">Renato Zapata &amp; Company</h2>
    <p style="margin:4px 0 0;font-size:13px;color:#6B6B6B;">Resumen semanal · CRUZ Intelligence</p>
  </div>

  <p style="font-size:15px;">Estimado/a <strong>${contact.name}</strong>,</p>
  <p style="font-size:14px;color:#6B6B6B;">Resumen de la semana para <strong>${contact.company}</strong>:</p>

  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr>
      <td style="padding:12px;background:#FAFAF8;border:1px solid #E8E5E0;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#C4963C;font-family:'JetBrains Mono',monospace;">${stats.cruzados}</div>
        <div style="font-size:11px;color:#6B6B6B;text-transform:uppercase;">Cruzados</div>
      </td>
      <td style="padding:12px;background:#FAFAF8;border:1px solid #E8E5E0;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#2563EB;font-family:'JetBrains Mono',monospace;">${stats.enProceso}</div>
        <div style="font-size:11px;color:#6B6B6B;text-transform:uppercase;">En Proceso</div>
      </td>
      <td style="padding:12px;background:#FAFAF8;border:1px solid #E8E5E0;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#16A34A;font-family:'JetBrains Mono',monospace;">${fmtUSD(stats.valorTotal)}</div>
        <div style="font-size:11px;color:#6B6B6B;text-transform:uppercase;">Valor USD</div>
      </td>
    </tr>
  </table>

  ${stats.tmecSavings > 0 ? `
  <div style="background:#F0FDF4;border:1px solid #DCFCE7;border-radius:8px;padding:12px 16px;margin:16px 0;">
    <strong style="color:#166534;">T-MEC</strong>
    <span style="color:#166534;margin-left:8px;">~${fmtUSD(stats.tmecSavings)} USD ahorrados (${stats.tmecOps} operaciones)</span>
  </div>` : ''}

  <div style="text-align:center;margin:28px 0;">
    <a href="${PORTAL_URL}" style="background:#C4963C;color:#FFFFFF;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;display:inline-block;">
      Ver en CRUZ Portal
    </a>
  </div>

  <hr style="border:none;border-top:1px solid #E8E5E0;margin:24px 0;">
  <p style="font-size:11px;color:#9CA3AF;">Renato Zapata &amp; Company · Patente 3596 · Aduana 240 · Est. 1941</p>
</body></html>`
}

async function generateDigest(companyId) {
  const contact = CLIENT_CONTACTS[companyId]
  if (!contact) return null

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico, estatus, importe_total, regimen, fecha_cruce')
    .eq('company_id', companyId)
    .gte('fecha_llegada', '2024-01-01')
    .limit(5000)

  const all = traficos || []
  const cruzadosThisWeek = all.filter(t => t.fecha_cruce && t.fecha_cruce >= weekAgo).length
  const enProceso = all.filter(t => {
    const s = (t.estatus || '').toLowerCase()
    return !s.includes('cruz') && !s.includes('entreg') && !s.includes('complet') && !s.includes('pagado')
  }).length

  const valorTotal = all.reduce((s, t) => s + (Number(t.importe_total) || 0), 0)

  const tmecOps = all.filter(t => {
    const r = (t.regimen || '').toUpperCase()
    return r === 'ITE' || r === 'ITR' || r === 'IMD'
  })
  const tmecSavings = tmecOps.reduce((s, t) => s + (Number(t.importe_total) || 0) * 0.05, 0)

  return {
    contact,
    stats: {
      cruzados: cruzadosThisWeek,
      enProceso,
      valorTotal,
      tmecOps: tmecOps.length,
      tmecSavings: Math.round(tmecSavings),
    },
  }
}

async function run() {
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''
  console.log(`\n📬 ${prefix}CRUZ — Weekly Digest`)
  console.log('═'.repeat(50))

  const clients = SINGLE_CLIENT ? [SINGLE_CLIENT] : Object.keys(CLIENT_CONTACTS)
  let sent = 0

  for (const clientId of clients) {
    const digest = await generateDigest(clientId)
    if (!digest) { console.log(`  ⚠️ No contact for ${clientId}`); continue }

    const html = buildDigestHtml(digest.contact, digest.stats)
    const subject = `Resumen semanal — ${digest.contact.company}`

    console.log(`  ${clientId}: ${digest.stats.cruzados} cruzados, ${digest.stats.enProceso} en proceso, ${fmtUSD(digest.stats.valorTotal)} USD`)

    if (!DRY_RUN && RESEND_API_KEY) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: FROM_EMAIL, to: [digest.contact.email], subject, html }),
      })
      if (res.ok) { sent++; console.log(`    ✅ Sent to ${digest.contact.email}`) }
      else { console.log(`    ❌ Failed: ${await res.text()}`) }
    } else {
      console.log(`    📝 Would send to ${digest.contact.email}`)
      sent++
    }
  }

  console.log(`\n  ${prefix}Sent: ${sent} digests`)

  if (sent > 0 && !DRY_RUN) {
    await sendTelegram(`📬 <b>WEEKLY DIGEST</b>\n${sent} resumen${sent !== 1 ? 'es' : ''} enviado${sent !== 1 ? 's' : ''}\n— CRUZ 🦀`)
  }
}

run().catch(async (err) => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
