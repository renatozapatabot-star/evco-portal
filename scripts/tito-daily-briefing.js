#!/usr/bin/env node
/**
 * V1 Polish Pack · Block 8 — Tito's daily briefing email.
 *
 * Aggregates yesterday's activity into a dark-glass HTML executive briefing
 * and sends it to TITO_EMAIL via Resend. Tracks opens via a 1x1 pixel hitting
 * /api/telemetry as `briefing_email_opened` with an HMAC-signed token.
 *
 * Cron: 30 6 * * *  (6:30 AM America/Chicago via ecosystem.config.js)
 *
 * Exit codes:
 *   0 — success (or nothing-to-do after logging decision row)
 *   1 — TITO_EMAIL missing (hard config failure)
 *   2 — Resend or Supabase error (hard runtime failure)
 *
 * Never skips silently. Always logs a decision row on success, always alerts
 * Telegram on failure. Mirrors scripts/send-notifications.js structure.
 */

const path = require('path')
const crypto = require('crypto')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const SCRIPT_NAME = 'tito-daily-briefing'
const FROM_EMAIL = 'Patente 3596 <sistema@renatozapata.com>'
const FROM_FALLBACK = 'Patente 3596 <onboarding@resend.dev>'
const BASE_URL = process.env.BASE_URL || 'https://evco-portal.vercel.app'
const DASHBOARD_URL = `${BASE_URL}/admin/inicio`

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

// ── Telegram (same pattern as send-notifications.js) ──

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') { console.log(message); return }
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' }),
    })
  } catch (err) {
    console.error('Telegram send failed:', err.message)
  }
}

// ── HMAC pixel token (mirrors src/lib/session.ts signing) ──

function signPixelToken(subjectDate) {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET not set')
  const payload = `briefing:${subjectDate}:${Math.floor(Date.now() / 1000)}`
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${sig}`
}

// ── Shadow heuristic (inline minimal port of src/lib/shadow-analysis.ts) ──

function isHumanSourced(row) {
  const r = (row.reasoning ?? '').trim()
  return r.length >= 40
}

async function computeYesterdayShadowAgreement() {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { data } = await sb
    .from('operational_decisions')
    .select('trafico, decision_type, decision, reasoning, created_at')
    .gte('created_at', since)
    .limit(5000)
  if (!data) return { compared: 0, agreed: 0 }

  const groups = new Map()
  for (const r of data) {
    if (!r.trafico) continue
    const key = `${r.trafico}::${r.decision_type}`
    const arr = groups.get(key) ?? []
    arr.push(r)
    groups.set(key, arr)
  }
  let compared = 0
  let agreed = 0
  for (const [, pair] of groups) {
    if (pair.length < 2) continue
    const human = pair.find(isHumanSourced)
    const system = pair.find(r => !isHumanSourced(r))
    if (!human || !system) continue
    compared++
    if ((human.decision || '').trim().toLowerCase() === (system.decision || '').trim().toLowerCase()) {
      agreed++
    }
  }
  return { compared, agreed }
}

// ── Aggregates ──

function startOfDayLaredo(offsetDays = 0) {
  const d = new Date()
  // Convert to Laredo local Y/M/D then back to UTC.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d)
  const y = Number(parts.find(p => p.type === 'year').value)
  const m = Number(parts.find(p => p.type === 'month').value) - 1
  const day = Number(parts.find(p => p.type === 'day').value)
  // Laredo is UTC-5 or UTC-6 depending on DST — use Date constructor in local then adjust.
  return new Date(Date.UTC(y, m, day + offsetDays, 6, 0, 0))
}

async function gatherMetrics() {
  const yesterdayStart = startOfDayLaredo(-1).toISOString()
  const todayStart = startOfDayLaredo(0).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const monthStart = (() => {
    const d = new Date()
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString()
  })()
  const yearStart = (() => {
    const d = new Date()
    return new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).toISOString()
  })()

  // 1. Active traficos today
  const { count: activeToday } = await sb
    .from('traficos')
    .select('trafico', { count: 'exact', head: true })
    .neq('estatus', 'Cruzado')

  // 2. 30-day avg active (rough: distinct traficos touched per day)
  const { count: active30 } = await sb
    .from('traficos')
    .select('trafico', { count: 'exact', head: true })
    .gte('updated_at', thirtyDaysAgo)
  const avg30 = active30 ? Math.round(active30 / 30) : 0

  // 3. Pedimentos filed yesterday
  const { count: pedYesterday } = await sb
    .from('traficos')
    .select('trafico', { count: 'exact', head: true })
    .not('pedimento', 'is', null)
    .gte('updated_at', yesterdayStart)
    .lt('updated_at', todayStart)

  // 4. 7-day avg pedimentos
  const { count: ped7 } = await sb
    .from('traficos')
    .select('trafico', { count: 'exact', head: true })
    .not('pedimento', 'is', null)
    .gte('updated_at', sevenDaysAgo)
  const avgPed7 = ped7 ? Math.round(ped7 / 7) : 0

  // 5. EVCO on-time % this month
  //    on-time = Cruzado AND fecha_cruce <= fecha_cruce_planeada
  //    if planeada missing, row excluded from denominator.
  const { data: evcoCrossings } = await sb
    .from('traficos')
    .select('estatus, fecha_cruce, fecha_cruce_planeada')
    .eq('company_id', 'evco')
    .gte('updated_at', monthStart)
    .limit(2000)

  let evcoOnTime = 0
  let evcoDenom = 0
  for (const t of (evcoCrossings || [])) {
    if (t.estatus !== 'Cruzado') continue
    if (!t.fecha_cruce_planeada || !t.fecha_cruce) continue
    evcoDenom++
    if (new Date(t.fecha_cruce) <= new Date(t.fecha_cruce_planeada)) evcoOnTime++
  }
  const evcoOnTimePct = evcoDenom > 0 ? Math.round((evcoOnTime / evcoDenom) * 100) : null

  // 6. Top 3 clients by YTD value from aduanet_facturas.valor_usd
  let topClients = []
  {
    const { data } = await sb
      .from('aduanet_facturas')
      .select('clave_cliente, valor_usd')
      .gte('created_at', yearStart)
      .limit(10000)
    if (data) {
      const map = new Map()
      for (const r of data) {
        if (!r.clave_cliente || r.valor_usd == null) continue
        map.set(r.clave_cliente, (map.get(r.clave_cliente) || 0) + Number(r.valor_usd))
      }
      topClients = [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c, v]) => ({ cliente: c, valor_usd: v }))
    }
  }

  // 7. Overdue receivables — probe column existence; skip cleanly if missing.
  let overdue = null
  {
    const probe = await sb
      .from('aduanet_facturas')
      .select('saldo_vencido')
      .limit(1)
    if (!probe.error) {
      const { data: overdueRows } = await sb
        .from('aduanet_facturas')
        .select('saldo_vencido')
        .gt('saldo_vencido', 0)
        .limit(5000)
      if (overdueRows) {
        overdue = overdueRows.reduce((s, r) => s + Number(r.saldo_vencido || 0), 0)
      }
    }
  }

  // 8. Yesterday's AI cost from llm_calls.cost
  let aiCostYesterday = null
  {
    const probe = await sb.from('llm_calls').select('cost').limit(1)
    if (!probe.error) {
      const { data: costs } = await sb
        .from('llm_calls')
        .select('cost')
        .gte('created_at', yesterdayStart)
        .lt('created_at', todayStart)
      if (costs) {
        aiCostYesterday = costs.reduce((s, r) => s + Number(r.cost || 0), 0)
      }
    }
  }

  // 9. Top 5 escalations pending Tito attention
  const { data: escalations } = await sb
    .from('operational_decisions')
    .select('id, trafico, decision, reasoning, created_at')
    .eq('decision_type', 'escalation')
    .is('outcome', null)
    .order('created_at', { ascending: false })
    .limit(5)

  // 10. Shadow agreement yesterday
  const shadow = await computeYesterdayShadowAgreement()

  return {
    activeToday: activeToday || 0,
    avg30,
    pedYesterday: pedYesterday || 0,
    avgPed7,
    evcoOnTimePct,
    evcoDenom,
    topClients,
    overdue,
    aiCostYesterday,
    escalations: escalations || [],
    shadow,
  }
}

// ── HTML render ──

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtUSD(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function renderHTML(metrics, subjectDate, pixelToken) {
  const pixelSrc = `${BASE_URL}/api/telemetry?event=briefing_email_opened&token=${encodeURIComponent(pixelToken)}`
  const rowStyle = 'padding: 10px 16px; border-bottom: 1px solid #1a1a2e;'
  const labelStyle = 'font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;'
  const bigNumStyle = "font-family: 'JetBrains Mono', 'SF Mono', monospace; font-size: 28px; font-weight: 800; color: #E6EDF3; line-height: 1;"
  const deltaStyle = 'font-family: JetBrains Mono, monospace; font-size: 11px; color: #64748b;'

  const sections = []

  // Section 1 — Pipeline
  sections.push(`
    <tr><td style="${rowStyle}">
      <div style="${labelStyle}">Tráficos activos</div>
      <div style="${bigNumStyle}">${metrics.activeToday}</div>
      <div style="${deltaStyle}">Promedio 30d: ${metrics.avg30}</div>
    </td></tr>
    <tr><td style="${rowStyle}">
      <div style="${labelStyle}">Pedimentos ayer</div>
      <div style="${bigNumStyle}">${metrics.pedYesterday}</div>
      <div style="${deltaStyle}">Promedio 7d: ${metrics.avgPed7}</div>
    </td></tr>`)

  // Section 2 — EVCO on-time
  if (metrics.evcoOnTimePct !== null) {
    sections.push(`
      <tr><td style="${rowStyle}">
        <div style="${labelStyle}">EVCO a tiempo · este mes</div>
        <div style="${bigNumStyle}">${metrics.evcoOnTimePct}%</div>
        <div style="${deltaStyle}">${metrics.evcoDenom} cruces evaluados</div>
      </td></tr>`)
  }

  // Section 3 — Top clients YTD
  if (metrics.topClients.length > 0) {
    const rows = metrics.topClients
      .map(c => `<tr>
        <td style="padding: 6px 0; font-size: 13px; color: #E6EDF3;">${escapeHtml(c.cliente)}</td>
        <td style="padding: 6px 0; font-family: JetBrains Mono, monospace; font-size: 13px; color: #00E5FF; text-align: right;">${fmtUSD(c.valor_usd)} USD</td>
      </tr>`).join('')
    sections.push(`
      <tr><td style="${rowStyle}">
        <div style="${labelStyle}">Top 3 clientes YTD</div>
        <table style="width: 100%; margin-top: 8px;">${rows}</table>
      </td></tr>`)
  }

  // Section 4 — Finanzas (overdue + AI cost)
  const finParts = []
  if (metrics.overdue !== null) {
    finParts.push(`<div style="${labelStyle}">Saldo vencido</div>
      <div style="${bigNumStyle}">${fmtUSD(metrics.overdue)} USD</div>`)
  }
  if (metrics.aiCostYesterday !== null) {
    finParts.push(`<div style="${labelStyle}; margin-top: 12px;">Costo IA ayer</div>
      <div style="font-family: JetBrains Mono, monospace; font-size: 18px; font-weight: 700; color: #eab308;">$${metrics.aiCostYesterday.toFixed(2)} USD</div>`)
  }
  if (finParts.length > 0) {
    sections.push(`<tr><td style="${rowStyle}">${finParts.join('')}</td></tr>`)
  }

  // Section 5 — Escalations + shadow
  const escRows = metrics.escalations.length === 0
    ? '<div style="font-size: 12px; color: #64748b;">Ninguna pendiente.</div>'
    : metrics.escalations.map(e => `
        <div style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <div style="font-family: JetBrains Mono, monospace; font-size: 12px; color: #00E5FF;">${escapeHtml(e.trafico || '—')}</div>
          <div style="font-size: 12px; color: #E6EDF3; margin-top: 2px;">${escapeHtml((e.reasoning || e.decision || '').slice(0, 140))}</div>
        </div>`).join('')

  sections.push(`
    <tr><td style="${rowStyle}">
      <div style="${labelStyle}">Requieren su atención</div>
      <div style="margin-top: 8px;">${escRows}</div>
    </td></tr>
    <tr><td style="${rowStyle}">
      <div style="${labelStyle}">Acuerdo IA vs operador · ayer</div>
      <div style="${bigNumStyle}">${metrics.shadow.compared === 0 ? '—' : `${metrics.shadow.agreed}/${metrics.shadow.compared}`}</div>
    </td></tr>`)

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="dark">
<title>Resumen diario — Patente 3596 · ${escapeHtml(subjectDate)}</title></head>
<body style="margin: 0; padding: 0; background-color: #05070B; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #05070B;">
    <tr><td align="center" style="padding: 40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px;">
        <tr><td align="center" style="padding-bottom: 8px;">
          <span style="font-size: 24px; font-weight: 900; letter-spacing: 0.15em; color: #eab308;">Portal</span>
        </td></tr>
        <tr><td align="center" style="padding-bottom: 24px;">
          <span style="font-size: 11px; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase;">
            Patente 3596 · Resumen diario · ${escapeHtml(subjectDate)}
          </span>
        </td></tr>
        <tr><td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                 style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; overflow: hidden;">
            ${sections.join('')}
            <tr><td style="padding: 20px; text-align: center;">
              <a href="${escapeHtml(DASHBOARD_URL)}" target="_blank"
                 style="display: inline-block; padding: 14px 28px; background: #eab308; color: #05070B; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 10px;">
                Ver dashboard completo →
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding: 24px 16px 0;">
          <span style="font-size: 11px; color: #475569;">
            Renato Zapata &amp; Company · Est. 1941 · Laredo, TX · Aduana 240
          </span>
        </td></tr>
      </table>
      <img src="${escapeHtml(pixelSrc)}" width="1" height="1" alt="" style="display: block; border: 0;" />
    </td></tr>
  </table>
</body>
</html>`
}

// ── Resend ──

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set')

  for (const from of [FROM_EMAIL, FROM_FALLBACK]) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    })
    if (res.ok) return res.json()
    const body = await res.text()
    if (res.status === 403 && from === FROM_EMAIL) {
      console.log('[WARN] sistema@renatozapata.com not verified — falling back to onboarding@resend.dev')
      continue
    }
    throw new Error(`Resend API ${res.status}: ${body}`)
  }
  throw new Error('Resend: all sender addresses failed')
}

// ── Main ──

async function main() {
  console.log(`[${SCRIPT_NAME}] Starting...`)

  const titoEmail = process.env.TITO_EMAIL
  if (!titoEmail) {
    console.error(`[${SCRIPT_NAME}] TITO_EMAIL environment variable is required but missing.`)
    await sendTelegram(`🔴 ${SCRIPT_NAME}: TITO_EMAIL not configured`)
    process.exit(1)
  }

  const subjectDate = new Date().toLocaleDateString('es-MX', {
    timeZone: 'America/Chicago', day: '2-digit', month: 'long', year: 'numeric',
  })
  const subject = `Resumen diario — Patente 3596 · ${subjectDate}`

  let metrics
  try {
    metrics = await gatherMetrics()
  } catch (err) {
    console.error(`[${SCRIPT_NAME}] Aggregation failed:`, err.message)
    await sendTelegram(`🔴 ${SCRIPT_NAME} failed aggregating: ${err.message}`)
    process.exit(2)
  }

  let html
  let pixelToken
  try {
    pixelToken = signPixelToken(subjectDate)
    html = renderHTML(metrics, subjectDate, pixelToken)
  } catch (err) {
    console.error(`[${SCRIPT_NAME}] Render failed:`, err.message)
    await sendTelegram(`🔴 ${SCRIPT_NAME} render failed: ${err.message}`)
    process.exit(2)
  }

  let resendId = null
  try {
    const result = await sendEmail(titoEmail, subject, html)
    resendId = result.id || null
    console.log(`[${SCRIPT_NAME}] Sent (${resendId}) to ${titoEmail}`)
  } catch (err) {
    console.error(`[${SCRIPT_NAME}] Resend failed:`, err.message)
    await sendTelegram(`🔴 ${SCRIPT_NAME} Resend failed: ${err.message}`)
    process.exit(2)
  }

  // Log decision row
  try {
    await sb.from('operational_decisions').insert({
      decision_type: 'daily_briefing_sent',
      decision: 'sent',
      reasoning: `Briefing sent to ${titoEmail} for ${subjectDate}`,
      metadata: {
        recipient: titoEmail,
        subject_date: subjectDate,
        resend_id: resendId,
        sections_rendered: [
          'pipeline',
          'evco_on_time',
          'top_clients_ytd',
          metrics.overdue !== null ? 'overdue_receivables' : null,
          metrics.aiCostYesterday !== null ? 'ai_cost' : null,
          'escalations',
          'shadow_agreement',
        ].filter(Boolean),
      },
    })
  } catch (err) {
    // Non-fatal: email went out. Log only.
    console.error(`[${SCRIPT_NAME}] Decision log insert failed (non-fatal):`, err.message)
  }

  console.log(`[${SCRIPT_NAME}] Done.`)
  process.exit(0)
}

main().catch(async (err) => {
  console.error(`[${SCRIPT_NAME}] Fatal:`, err.message)
  await sendTelegram(`🔴 ${SCRIPT_NAME} fatal: ${err.message}`)
  process.exit(2)
})
