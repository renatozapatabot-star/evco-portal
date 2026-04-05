#!/usr/bin/env node
/**
 * CRUZ — Activate Top 15 Clients for 30-Day Portal Trial
 *
 * Scores all clients by data readiness, activates top 15 (score >= 70),
 * generates passwords, creates trial records, outputs WhatsApp messages.
 *
 * DOES NOT send messages — only generates text for Tito.
 * DOES NOT activate clients below score 70.
 *
 * Usage:
 *   node scripts/activate-trial-clients.js --dry-run    # Preview only
 *   node scripts/activate-trial-clients.js              # Activate
 *   node scripts/activate-trial-clients.js --limit 5    # Only top 5
 *
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'activate-trial-clients'
const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '15')
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'
const PORTAL_URL = 'https://portal.renatozapata.com'
const SKIP_CLIENTS = ['evco', 'mafesa'] // Already active

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function sendTelegram(msg) {
  if (DRY_RUN || process.env.TELEGRAM_SILENT === 'true' || !TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

function generatePassword(companyId) {
  // Simple memorable password: shortened company slug + 2026
  const slug = companyId.split('-').slice(0, 2).join('')
  return slug.substring(0, 10) + '2026'
}

function generateWhatsApp(companyName, password) {
  return `Buenos días. Les activamos acceso a su portal de operaciones aduanales. Todo su historial desde 2024 ya está disponible.

Portal: ${PORTAL_URL}
Contraseña: ${password}

Pruébenlo 30 días sin costo. Cualquier duda estamos a sus órdenes.

— Renato Zapata & Company
Patente 3596 · Aduana 240`
}

async function run() {
  const prefix = DRY_RUN ? '[DRY-RUN] ' : ''
  console.log(`\n🚀 ${prefix}CRUZ — Activate Trial Clients`)
  console.log('═'.repeat(70))

  // Get all traficos for scoring
  const { data: allTrafs } = await supabase.from('traficos')
    .select('company_id, pedimento, fecha_cruce, importe_total, descripcion_mercancia, regimen, proveedores, estatus')
    .gte('fecha_llegada', '2024-01-01')
    .not('fecha_llegada', 'is', null)
    .limit(50000)

  const byClient = {}
  for (const t of (allTrafs || [])) {
    if (SKIP_CLIENTS.includes(t.company_id)) continue
    if (!byClient[t.company_id]) byClient[t.company_id] = []
    byClient[t.company_id].push(t)
  }

  // Score each client
  const pct = (n, d) => d > 0 ? Math.round(n / d * 100) : 0
  const scores = []

  for (const [cid, trafs] of Object.entries(byClient)) {
    if (trafs.length < 5) continue
    const total = trafs.length
    const score = Math.round(
      (pct(trafs.filter(t => t.pedimento).length, total) +
       pct(trafs.filter(t => t.fecha_cruce).length, total) +
       pct(trafs.filter(t => Number(t.importe_total) > 0).length, total) +
       pct(trafs.filter(t => t.descripcion_mercancia).length, total) +
       pct(trafs.filter(t => t.proveedores).length, total) +
       pct(trafs.filter(t => t.regimen).length, total)) / 6
    )
    const stale = trafs.filter(t => t.estatus === 'En Proceso' && t.pedimento).length

    scores.push({ company_id: cid, traficos: total, score, stale })
  }

  scores.sort((a, b) => b.score - a.score)
  const qualified = scores.filter(s => s.score >= 70).slice(0, LIMIT)

  console.log(`\nQualified clients (score >= 70): ${qualified.length}`)
  console.log(`Activating top ${LIMIT}\n`)

  // Get company details
  const companyIds = qualified.map(q => q.company_id)
  const { data: companies } = await supabase.from('companies')
    .select('company_id, name, clave_cliente, portal_password')
    .in('company_id', companyIds)

  const companyMap = {}
  for (const c of (companies || [])) companyMap[c.company_id] = c

  // Activate each
  const activated = []
  const whatsappMessages = []

  console.log('Company'.padEnd(40) + 'Score  Trafs  Password'.padEnd(20) + '  Status')
  console.log('─'.repeat(90))

  for (const q of qualified) {
    const company = companyMap[q.company_id]
    if (!company) { console.log(`  ⚠️ ${q.company_id} — not in companies table`); continue }

    const password = company.portal_password || generatePassword(q.company_id)
    const companyName = company.name || q.company_id
    let status = 'READY'
    const issues = []

    // Fix stale if needed
    if (q.stale > 0) issues.push(`${q.stale} stale`)
    if (q.score < 70) { status = 'SKIP (score < 70)'; continue }

    // Activate
    if (!DRY_RUN) {
      // Set password + active
      await supabase.from('companies').update({
        portal_password: password,
        active: true,
      }).eq('company_id', q.company_id)

      // Create trial record
      await supabase.from('trial_clients').insert({
        company_id: q.company_id,
        activated_by: 'activate-trial-clients',
        notes: `Score: ${q.score}, Traficos: ${q.traficos}`,
      }).then(() => {}, () => {})

      // Audit log
      await supabase.from('audit_log').insert({
        action: 'trial_activated',
        entity_type: 'company',
        entity_id: q.company_id,
        details: { score: q.score, traficos: q.traficos, password_set: true },
        company_id: q.company_id,
      }).then(() => {}, () => {})
    }

    activated.push({
      company_id: q.company_id,
      name: companyName,
      clave: company.clave_cliente,
      password,
      score: q.score,
      traficos: q.traficos,
    })

    whatsappMessages.push({
      company: companyName,
      message: generateWhatsApp(companyName, password),
    })

    console.log(
      companyName.substring(0, 39).padEnd(40) +
      String(q.score).padStart(4) + '%  ' +
      String(q.traficos).padStart(5) + '  ' +
      password.padEnd(20) + '  ' +
      (issues.length > 0 ? issues.join(', ') : '✅ ACTIVATED')
    )
  }

  // WhatsApp messages for Tito
  console.log('\n' + '═'.repeat(70))
  console.log('📱 WHATSAPP MESSAGES FOR TITO')
  console.log('═'.repeat(70))

  for (const msg of whatsappMessages) {
    console.log(`\n── ${msg.company} ──`)
    console.log(msg.message)
  }

  // Summary
  console.log('\n' + '═'.repeat(70))
  console.log(`📊 ${prefix}SUMMARY`)
  console.log(`   Activated: ${activated.length} clients`)
  console.log(`   Total tráficos covered: ${activated.reduce((s, a) => s + a.traficos, 0)}`)
  console.log(`   Trial ends: ${new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]}`)

  // Telegram notification
  if (activated.length > 0) {
    await sendTelegram(
      `🚀 <b>TRIAL ACTIVATION</b>\n` +
      `${activated.length} clientes activados para prueba 30 días\n` +
      activated.slice(0, 5).map(a => `• ${a.name.substring(0, 25)}: ${a.traficos} trafs`).join('\n') +
      (activated.length > 5 ? `\n...y ${activated.length - 5} más` : '') +
      `\n— CRUZ 🦀`
    )
  }
}

run().catch(async (err) => {
  console.error('Fatal:', err.message)
  await sendTelegram(`🔴 <b>${SCRIPT_NAME} FATAL</b>: ${err.message}\n— CRUZ 🦀`)
  process.exit(1)
})
