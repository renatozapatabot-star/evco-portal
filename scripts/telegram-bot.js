const TelegramBot = require('node-telegram-bot-api')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = '-5085543275'
const COMPANY_ID = 'evco'
const CLAVE = '9254'

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env.local')
  process.exit(1)
}

const bot = new TelegramBot(TOKEN, { polling: true })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function fmt(n) { return Number(n || 0).toLocaleString('es-MX') }
function fmtUSD(n) { return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }

function nowCST() {
  return new Date().toLocaleString('es-MX', {
    timeZone: 'America/Chicago',
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  })
}

function timeAgo(dateStr) {
  const ms = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(ms / 3600000)
  if (hours < 1) return 'hace minutos'
  if (hours < 24) return `hace ${hours}h`
  return `hace ${Math.floor(hours / 24)}d`
}

// ── HANDLERS ──────────────────────────────────────────────

async function handleStatus() {
  const [trafRes, entRes, factRes] = await Promise.all([
    supabase.from('traficos').select('estatus, peso_bruto').eq('company_id', COMPANY_ID),
    supabase.from('entradas').select('tiene_faltantes, mercancia_danada').eq('company_id', COMPANY_ID),
    supabase.from('aduanet_facturas').select('valor_usd, igi, pedimento').eq('clave_cliente', CLAVE),
  ])

  const traf = trafRes.data || []
  const ent = entRes.data || []
  const fact = factRes.data || []

  const enProceso = traf.filter(t => t.estatus === 'En Proceso').length
  const cruzados = traf.filter(t => t.estatus === 'Cruzado').length
  const detenidos = traf.filter(t => t.estatus === 'Detenido').length
  const faltantes = ent.filter(e => e.tiene_faltantes).length
  const danos = ent.filter(e => e.mercancia_danada).length
  const valorTotal = fact.reduce((s, f) => s + (f.valor_usd || 0), 0)
  const pedimentos = new Set(fact.map(f => f.pedimento).filter(Boolean)).size
  const tmec = fact.filter(f => (f.igi || 0) === 0).length

  return [
    `📊 <b>STATUS — CRUZ</b>`,
    `EVCO Plastics · ${nowCST()}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `<b>TRÁFICOS</b>`,
    `🟡 En Proceso: ${fmt(enProceso)}`,
    `🟢 Cruzados: ${fmt(cruzados)}`,
    detenidos > 0 ? `🔴 Detenidos: ${fmt(detenidos)}` : `✅ Sin detenidos`,
    ``,
    `<b>ENTRADAS: ${fmt(ent.length)}</b>`,
    faltantes > 0 ? `⚠️ Con faltantes: ${fmt(faltantes)}` : `✅ Sin faltantes`,
    danos > 0 ? `🔴 Con daños: ${fmt(danos)}` : `✅ Sin daños`,
    ``,
    `<b>FINANCIERO</b>`,
    `💰 Valor: ${fmtUSD(valorTotal)}`,
    `📄 Pedimentos: ${fmt(pedimentos)} (T-MEC: ${fmt(tmec)})`,
    ``,
    `🌐 evco-portal.vercel.app`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `— CRUZ 🦀`
  ].join('\n')
}

async function handleTraficos(search) {
  let q = supabase.from('traficos')
    .select('trafico, estatus, fecha_llegada, peso_bruto, pedimento')
    .eq('company_id', COMPANY_ID)
    .order('fecha_llegada', { ascending: false })
    .limit(5)

  if (search) q = q.ilike('trafico', `%${search}%`)

  const { data } = await q
  const rows = data || []

  if (rows.length === 0) return `❌ No se encontraron tráficos${search ? ` para "${search}"` : ''}`

  const lines = [`🚢 <b>TRÁFICOS RECIENTES</b>`, `━━━━━━━━━━━━━━━━━━━━`]
  rows.forEach(t => {
    const icon = t.estatus === 'Cruzado' ? '🟢' : t.estatus === 'Detenido' ? '🔴' : '🟡'
    lines.push(`${icon} <b>${t.trafico}</b>`)
    lines.push(`   ${t.estatus} · ${t.fecha_llegada ? new Date(t.fecha_llegada).toLocaleDateString('es-MX') : '—'}`)
    if (t.pedimento) lines.push(`   Ped: ${t.pedimento}`)
    if (t.peso_bruto) lines.push(`   ${fmt(t.peso_bruto)} kg`)
    lines.push(``)
  })
  lines.push(`— CRUZ 🦀`)
  return lines.join('\n')
}

async function handleEntradas() {
  const { data } = await supabase.from('entradas')
    .select('cve_entrada, descripcion_mercancia, fecha_llegada_mercancia, cantidad_bultos, peso_bruto, tiene_faltantes, trafico')
    .eq('company_id', COMPANY_ID)
    .order('fecha_llegada_mercancia', { ascending: false })
    .limit(5)

  const rows = data || []
  if (rows.length === 0) return '❌ Sin entradas recientes'

  const lines = [`📦 <b>ENTRADAS RECIENTES</b>`, `━━━━━━━━━━━━━━━━━━━━`]
  rows.forEach(e => {
    lines.push(`<b>${e.cve_entrada}</b> · ${e.fecha_llegada_mercancia ? new Date(e.fecha_llegada_mercancia).toLocaleDateString('es-MX') : '—'}`)
    if (e.descripcion_mercancia) lines.push(`   ${e.descripcion_mercancia.substring(0, 40)}`)
    lines.push(`   ${e.cantidad_bultos || '?'} bultos · ${e.peso_bruto ? fmt(e.peso_bruto) + ' kg' : '—'}`)
    if (e.tiene_faltantes) lines.push(`   ⚠️ CON FALTANTES`)
    if (e.trafico) lines.push(`   Tráfico: ${e.trafico}`)
    lines.push(``)
  })
  lines.push(`— CRUZ 🦀`)
  return lines.join('\n')
}

async function handleFinanciero() {
  const { data } = await supabase.from('aduanet_facturas')
    .select('valor_usd, dta, igi, iva, proveedor, fecha_pago, pedimento')
    .eq('clave_cliente', CLAVE)
    .order('fecha_pago', { ascending: false })
    .limit(100)

  const rows = data || []
  const total = rows.reduce((s, f) => s + (f.valor_usd || 0), 0)
  const totalIGI = rows.reduce((s, f) => s + (f.igi || 0), 0)
  const totalIVA = rows.reduce((s, f) => s + (f.iva || 0), 0)
  const totalDTA = rows.reduce((s, f) => s + (f.dta || 0), 0)
  const tmec = rows.filter(f => (f.igi || 0) === 0).length
  const peds = new Set(rows.map(f => f.pedimento).filter(Boolean)).size

  return [
    `💰 <b>RESUMEN FINANCIERO</b>`,
    `EVCO · Patente 3596 · Aduana 240`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Valor Total: <b>${fmtUSD(total)}</b>`,
    `DTA: ${fmtUSD(totalDTA * 0.057)}`,
    `IGI: ${totalIGI === 0 ? '✅ T-MEC $0' : fmtUSD(totalIGI * 0.057)}`,
    `IVA: ${fmtUSD(totalIVA * 0.057)}`,
    ``,
    `Pedimentos: ${fmt(peds)}`,
    `T-MEC aplicado: ${fmt(tmec)}/${fmt(rows.length)}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `— CRUZ 🦀`
  ].join('\n')
}

// ── /aprobar — List pending items with inline approve/reject buttons ──

async function handleAprobar(chatId) {
  // Fetch pending drafts
  const { data: drafts } = await supabase
    .from('pedimento_drafts')
    .select('id, trafico_id, draft_data, status, created_at')
    .in('status', ['draft', 'pending', 'pending_review'])
    .order('created_at', { ascending: true })
    .limit(10)

  // Fetch overdue documento_solicitudes
  const { data: solicitudes } = await supabase
    .from('documento_solicitudes')
    .select('id, trafico_id, doc_type, status, solicitado_at')
    .eq('status', 'solicitado')
    .order('solicitado_at', { ascending: true })
    .limit(10)

  // Fetch entradas with faltantes (need confirmation)
  const { data: entradas } = await supabase
    .from('entradas')
    .select('cve_entrada, trafico, descripcion_mercancia, tiene_faltantes, fecha_llegada_mercancia')
    .eq('company_id', COMPANY_ID)
    .eq('tiene_faltantes', true)
    .order('fecha_llegada_mercancia', { ascending: false })
    .limit(5)

  const pendingDrafts = drafts || []
  const pendingSolicitudes = solicitudes || []
  const pendingEntradas = entradas || []
  const totalPending = pendingDrafts.length + pendingSolicitudes.length + pendingEntradas.length

  if (totalPending === 0) {
    bot.sendMessage(chatId,
      `✅ <b>Sin pendientes de aprobación</b>\n\nTodo al día. — CRUZ 🦀`,
      { parse_mode: 'HTML' }
    )
    return
  }

  // Send header
  bot.sendMessage(chatId,
    `📋 <b>PENDIENTES DE APROBACIÓN</b>\n${nowCST()}\n━━━━━━━━━━━━━━━━━━━━\n${totalPending} item(s) esperando tu decisión`,
    { parse_mode: 'HTML' }
  )

  // Send each draft with inline buttons
  for (const draft of pendingDrafts) {
    const dd = draft.draft_data || {}
    const supplier = dd.extraction?.supplier || dd.supplier || '—'
    const value = dd.extraction?.value_usd || dd.value_usd
    const valueStr = value ? fmtUSD(value) + ' USD' : '—'
    const confidence = dd.confidence ? `${Math.round(dd.confidence)}%` : '—'
    const age = timeAgo(draft.created_at)

    const text = [
      `📄 <b>Borrador</b> · ${draft.status}`,
      `Tráfico: <code>${draft.trafico_id || '—'}</code>`,
      `Proveedor: ${supplier}`,
      `Valor: ${valueStr}`,
      `Confianza: ${confidence} · ${age}`,
    ].join('\n')

    bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Aprobar', callback_data: `aprobar_${draft.id}` },
          { text: '❌ Rechazar', callback_data: `rechazar_${draft.id}` },
          { text: '✏️ Corregir', callback_data: `corregir_${draft.id}` },
        ]]
      }
    })
  }

  // Send solicitudes summary (no individual buttons — just info)
  if (pendingSolicitudes.length > 0) {
    const solLines = pendingSolicitudes.slice(0, 5).map(s =>
      `  • ${s.trafico_id}: ${s.doc_type} — ${timeAgo(s.solicitado_at)}`
    )
    bot.sendMessage(chatId, [
      `📨 <b>Documentos solicitados (${pendingSolicitudes.length})</b>`,
      ...solLines,
      pendingSolicitudes.length > 5 ? `  ... y ${pendingSolicitudes.length - 5} más` : '',
    ].filter(Boolean).join('\n'), { parse_mode: 'HTML' })
  }

  // Send entradas with faltantes
  if (pendingEntradas.length > 0) {
    const entLines = pendingEntradas.map(e =>
      `  • ${e.cve_entrada}: ${(e.descripcion_mercancia || '').substring(0, 35)}${e.trafico ? ` (${e.trafico})` : ''}`
    )
    bot.sendMessage(chatId, [
      `⚠️ <b>Entradas con faltantes (${pendingEntradas.length})</b>`,
      ...entLines,
    ].join('\n'), { parse_mode: 'HTML' })
  }
}

// ── /pendientes — Show counts grouped by type ──

async function handlePendientes() {
  const [draftsRes, solRes, entRes] = await Promise.all([
    supabase.from('pedimento_drafts')
      .select('id, status, created_at', { count: 'exact' })
      .in('status', ['draft', 'pending', 'pending_review']),
    supabase.from('documento_solicitudes')
      .select('id, solicitado_at', { count: 'exact' })
      .eq('status', 'solicitado'),
    supabase.from('entradas')
      .select('cve_entrada', { count: 'exact' })
      .eq('company_id', COMPANY_ID)
      .eq('tiene_faltantes', true),
  ])

  const draftCount = draftsRes.count || 0
  const solCount = solRes.count || 0
  const entCount = entRes.count || 0
  const total = draftCount + solCount + entCount

  // Check for stale items (>24h)
  const staleThreshold = new Date(Date.now() - 24 * 3600000).toISOString()
  const staleDrafts = (draftsRes.data || []).filter(d => d.created_at < staleThreshold).length
  const staleSols = (solRes.data || []).filter(s => s.solicitado_at < staleThreshold).length

  const lines = [
    `📊 <b>PENDIENTES — CRUZ</b>`,
    `${nowCST()}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `📄 Borradores: <b>${draftCount}</b>${staleDrafts > 0 ? ` ⏰ ${staleDrafts} >24h` : ''}`,
    `📨 Docs solicitados: <b>${solCount}</b>${staleSols > 0 ? ` ⏰ ${staleSols} >24h` : ''}`,
    `⚠️ Entradas c/faltantes: <b>${entCount}</b>`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Total: <b>${total}</b>`,
  ]

  if (total === 0) {
    lines.push(`\n✅ Todo al día.`)
  } else if (staleDrafts + staleSols > 0) {
    lines.push(`\n⏰ ${staleDrafts + staleSols} item(s) llevan >24h esperando`)
  }

  lines.push(`\nUsa /aprobar para ver detalle`)
  lines.push(`— CRUZ 🦀`)
  return lines.join('\n')
}

// ── Callback query handler — approve/reject/correct from inline buttons ──

async function handleCallbackQuery(query) {
  const chatId = query.message?.chat?.id
  const userId = query.from?.id
  const username = query.from?.username || query.from?.first_name || 'Tito'
  const data = query.data || ''

  // Answer callback to remove loading state
  await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: query.id, text: 'Procesando...' }),
  })

  if (data.startsWith('aprobar_')) {
    const draftId = data.replace('aprobar_', '')
    return await processApproval(chatId, draftId, username)
  }

  if (data.startsWith('rechazar_')) {
    const draftId = data.replace('rechazar_', '')
    await supabase.from('pedimento_drafts').update({
      status: 'rejected',
      reviewed_by: username,
      reviewed_at: new Date().toISOString(),
    }).eq('id', draftId)

    await supabase.from('audit_log').insert({
      action: 'draft_rejected_telegram',
      details: { draft_id: draftId, rejected_by: username, channel: 'telegram' },
      actor: username,
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {})

    bot.sendMessage(chatId, `❌ Borrador rechazado.\n— CRUZ 🦀`, { parse_mode: 'HTML' })
    return
  }

  if (data.startsWith('corregir_')) {
    const draftId = data.replace('corregir_', '')
    await supabase.from('pedimento_drafts').update({
      status: 'approved_corrected',
      reviewed_by: username,
      reviewed_at: new Date().toISOString(),
    }).eq('id', draftId)

    await supabase.from('audit_log').insert({
      action: 'draft_corrected_telegram',
      details: { draft_id: draftId, corrected_by: username, channel: 'telegram' },
      actor: username,
      timestamp: new Date().toISOString(),
    }).then(() => {}, () => {})

    bot.sendMessage(chatId, `✏️ Borrador marcado para corrección.\nResponde con la nota de corrección.`, { parse_mode: 'HTML' })
    return
  }

  if (data.startsWith('cancelar_')) {
    const draftId = data.replace('cancelar_', '')
    // Only revert if still in approved_pending
    const { data: draft } = await supabase
      .from('pedimento_drafts')
      .select('id, status')
      .eq('id', draftId)
      .single()

    if (draft?.status === 'approved_pending') {
      await supabase.from('pedimento_drafts').update({
        status: 'draft',
        reviewed_by: null,
      }).eq('id', draftId)

      await supabase.from('audit_log').insert({
        action: 'draft_approval_cancelled_telegram',
        details: { draft_id: draftId, cancelled_by: username, channel: 'telegram' },
        actor: username,
        timestamp: new Date().toISOString(),
      }).then(() => {}, () => {})

      bot.sendMessage(chatId, `↩️ Aprobación cancelada. Borrador regresado a revisión.`, { parse_mode: 'HTML' })
    } else {
      bot.sendMessage(chatId, `⚠️ Ventana de cancelación expirada.`, { parse_mode: 'HTML' })
    }
    return
  }
}

async function processApproval(chatId, draftId, username) {
  // Set to approved_pending (5-second cancellation window)
  const { error } = await supabase.from('pedimento_drafts').update({
    status: 'approved_pending',
    reviewed_by: username,
    reviewed_at: new Date().toISOString(),
  }).eq('id', draftId)

  if (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`, { parse_mode: 'HTML' })
    return
  }

  // Audit log
  await supabase.from('audit_log').insert({
    action: 'draft_approved_telegram',
    details: { draft_id: draftId, approved_by: username, channel: 'telegram', status: 'approved_pending' },
    actor: username,
    timestamp: new Date().toISOString(),
  }).then(() => {}, () => {})

  // Send confirmation with 5-second cancel button
  const msg = await bot.sendMessage(chatId,
    `⏳ Aprobando borrador... Tienes 5 segundos para cancelar.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '↩️ Cancelar', callback_data: `cancelar_${draftId}` },
        ]]
      }
    }
  )

  // After 5 seconds, finalize approval and remove cancel button
  setTimeout(async () => {
    // Check if still approved_pending (not cancelled)
    const { data: draft } = await supabase
      .from('pedimento_drafts')
      .select('status')
      .eq('id', draftId)
      .single()

    if (draft?.status === 'approved_pending') {
      await supabase.from('pedimento_drafts').update({
        status: 'approved',
      }).eq('id', draftId)

      // Remove cancel button and show final message
      await fetch(`https://api.telegram.org/bot${TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: msg.message_id,
          text: `✅ Patente 3596 honrada. Gracias, Tito. 🦀`,
          parse_mode: 'HTML',
        }),
      })
    }
  }, 5000)
}

// ── /activar — activate a client for portal access ──

async function handleActivar(chatId, companyId) {
  if (!companyId) {
    bot.sendMessage(chatId, `Uso: /activar [company_id]\nEjemplo: /activar garlock`, { parse_mode: 'HTML' })
    return
  }

  bot.sendMessage(chatId, `⏳ Activando ${companyId}...`, { parse_mode: 'HTML' })

  try {
    const { execSync } = require('child_process')
    const output = execSync(`node scripts/activate-client.js --company ${companyId}`, {
      cwd: require('path').resolve(__dirname, '..'),
      timeout: 30000,
      encoding: 'utf8',
    })
    // activate-client.js sends its own Telegram message
  } catch (err) {
    bot.sendMessage(chatId, `❌ Error activando ${companyId}: ${err.message?.substring(0, 100)}`, { parse_mode: 'HTML' })
  }
}

function handleHelp() {
  return [
    `🦀 <b>CRUZ — Comandos</b>`,
    `Renato Zapata &amp; Company`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `/status — Estado general del sistema`,
    `/traficos — Últimos 5 tráficos`,
    `/traficos [ID] — Buscar tráfico específico`,
    `/entradas — Últimas 5 entradas`,
    `/financiero — Resumen financiero`,
    `/aprobar — Pendientes de aprobación`,
    `/pendientes — Conteo de pendientes`,
    `/activar [id] — Activar portal para cliente`,
    `/help — Esta lista`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `Portal: evco-portal.vercel.app`,
    `— CRUZ 🦀`
  ].join('\n')
}

// ── BOT LISTENERS ──────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `🦀 <b>CRUZ activo</b>\nRenato Zapata &amp; Company\nEscribe /help para ver comandos`,
    { parse_mode: 'HTML' }
  )
})

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, handleHelp(), { parse_mode: 'HTML' })
})

bot.onText(/\/status/, async (msg) => {
  try {
    const reply = await handleStatus()
    bot.sendMessage(msg.chat.id, reply, { parse_mode: 'HTML' })
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`)
  }
})

bot.onText(/\/traficos(.*)/, async (msg, match) => {
  try {
    const search = match[1]?.trim() || null
    const reply = await handleTraficos(search)
    bot.sendMessage(msg.chat.id, reply, { parse_mode: 'HTML' })
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`)
  }
})

bot.onText(/\/entradas/, async (msg) => {
  try {
    const reply = await handleEntradas()
    bot.sendMessage(msg.chat.id, reply, { parse_mode: 'HTML' })
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`)
  }
})

bot.onText(/\/financiero/, async (msg) => {
  try {
    const reply = await handleFinanciero()
    bot.sendMessage(msg.chat.id, reply, { parse_mode: 'HTML' })
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`)
  }
})

bot.onText(/\/aprobar$/, async (msg) => {
  try {
    await handleAprobar(msg.chat.id)
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`)
  }
})

bot.onText(/\/pendientes/, async (msg) => {
  try {
    const reply = await handlePendientes()
    bot.sendMessage(msg.chat.id, reply, { parse_mode: 'HTML' })
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`)
  }
})

bot.onText(/\/activar(.*)/, async (msg, match) => {
  try {
    const companyId = match[1]?.trim() || null
    await handleActivar(msg.chat.id, companyId)
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Error: ${e.message}`)
  }
})

// Handle inline button callbacks
bot.on('callback_query', async (query) => {
  try {
    await handleCallbackQuery(query)
  } catch (e) {
    console.error('Callback error:', e.message)
  }
})

// ── AGENT COMMANDS ──────────────────────────────────────────

bot.onText(/\/agente/, async (msg) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    const [todayRes, weekRes, configRes] = await Promise.all([
      supabase.from('agent_decisions').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      supabase.from('agent_decisions').select('was_correct').gte('created_at', weekAgo).not('was_correct', 'is', null),
      supabase.from('system_config').select('value').eq('key', 'agent_status').single(),
    ])

    const todayCount = todayRes.count || 0
    const reviewed = weekRes.data || []
    const correct = reviewed.filter(d => d.was_correct).length
    const accuracy = reviewed.length > 0 ? Math.round((correct / reviewed.length) * 1000) / 10 : 0
    const paused = configRes.data?.value?.paused || false

    const text =
      `🤖 <b>CRUZ Agent ${paused ? '⏸️ PAUSADO' : '● ACTIVO'}</b>\n\n` +
      `Decisiones hoy: ${todayCount}\n` +
      `Precisión 7d: ${accuracy}% (${reviewed.length} revisadas)\n\n` +
      `— CRUZ Agent 🤖`

    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' })
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`) }
})

bot.onText(/\/decisiones/, async (msg) => {
  try {
    const { data } = await supabase.from('agent_decisions')
      .select('workflow, decision, reasoning, confidence, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (!data || data.length === 0) {
      bot.sendMessage(msg.chat.id, '🤖 Sin decisiones recientes.')
      return
    }

    const lines = data.map(d => {
      const time = new Date(d.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' })
      return `${time} — ${d.reasoning || d.decision} (${d.confidence}%)`
    })

    bot.sendMessage(msg.chat.id,
      `🤖 <b>Últimas 5 decisiones:</b>\n\n${lines.join('\n')}\n\n— CRUZ Agent 🤖`,
      { parse_mode: 'HTML' }
    )
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`) }
})

bot.onText(/\/pausar/, async (msg) => {
  try {
    await supabase.from('system_config').upsert({ key: 'agent_status', value: { paused: true } }, { onConflict: 'key' })
    bot.sendMessage(msg.chat.id, '⏸️ CRUZ Agent pausado. Usa /reanudar para reactivar.')
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`) }
})

bot.onText(/\/reanudar/, async (msg) => {
  try {
    await supabase.from('system_config').upsert({ key: 'agent_status', value: { paused: false } }, { onConflict: 'key' })
    bot.sendMessage(msg.chat.id, '▶️ CRUZ Agent reanudado. Operando normalmente.')
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`) }
})

bot.on('polling_error', (err) => console.error('Polling error:', err.message))

console.log('🦀 CRUZ Telegram bot running...')
console.log('Commands: /start /help /status /traficos /entradas /financiero /aprobar /pendientes /activar /agente /decisiones /pausar /reanudar')
console.log('Press Ctrl+C to stop')
