#!/usr/bin/env node
/**
 * generate-client-briefing.js — writes a 3-sentence Spanish morning
 * briefing for each active client, stores it in `client_briefings`.
 *
 * Scheduled via PM2 cron_restart at 7 AM Mon-Fri (ecosystem.config.js
 * entry `client-briefing-generator`). Can also be invoked manually for
 * a single company:
 *
 *   node scripts/generate-client-briefing.js --company-id evco
 *   node scripts/generate-client-briefing.js --company-id evco --date 2026-04-20
 *
 * Idempotency: one briefing per company per date (period_start). If a
 * briefing already exists for today, the script logs and skips unless
 * --force is passed.
 *
 * Exits 0 on success or skipped; 1 on fatal error for any single
 * company — subsequent companies still run in the PM2 cron invocation.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')
const Anthropic = require('@anthropic-ai/sdk')
const { safeInsert } = require('./lib/safe-write')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : null
}
const filterCompanyId = flag('company-id')
const dateOverride = flag('date')
const force = args.includes('--force')

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

async function gatherContext(companyId, targetDate) {
  const end = new Date(`${targetDate}T00:00:00.000Z`)
  const start = new Date(end)
  start.setDate(start.getDate() - 7)
  const yearStart = new Date(end.getFullYear(), 0, 1)

  // `portal_company_name` is referenced in the CRUZ AI client-context
  // code but not in any applied migration — selecting it causes the
  // whole row to come back null. Select the safe columns first, then
  // optionally enrich with portal_company_name inside a guarded
  // follow-up query so a missing column never zeros out `ctx.company`.
  const [company, active, weekCruces, recentPedimentos, savings] = await Promise.all([
    supabase.from('companies').select('company_id, name').eq('company_id', companyId).maybeSingle(),
    supabase.from('traficos').select('trafico, estatus, fecha_llegada').eq('company_id', companyId).is('fecha_cruce', null).gte('fecha_llegada', start.toISOString()).order('fecha_llegada', { ascending: true }).limit(10),
    supabase.from('traficos').select('trafico, fecha_cruce').eq('company_id', companyId).gte('fecha_cruce', start.toISOString()).lte('fecha_cruce', end.toISOString()),
    supabase.from('traficos').select('trafico, pedimento, fecha_pago').eq('company_id', companyId).not('pedimento', 'is', null).order('fecha_pago', { ascending: false }).limit(3),
    supabase.from('operations_savings').select('month, realized_savings_usd').eq('company_id', companyId).gte('month', yearStart.toISOString().slice(0, 10)).order('month', { ascending: false }).limit(24),
  ])

  const tmecYtd = (savings.data ?? []).reduce((acc, r) => acc + (r.realized_savings_usd ?? 0), 0)
  return {
    company: company.data,
    active_count: active.data?.length ?? 0,
    next_arrival: active.data?.[0]?.fecha_llegada ?? null,
    week_cruces: weekCruces.data?.length ?? 0,
    recent_pedimentos: (recentPedimentos.data ?? []).map((r) => ({ ref: r.trafico, pedimento: r.pedimento, fecha: r.fecha_pago })),
    tmec_ytd_usd: Math.round(tmecYtd),
    period_start: isoDate(start),
    period_end: isoDate(end),
  }
}

async function askSonnet(ctx) {
  const companyName = ctx.company?.portal_company_name || ctx.company?.name || 'el cliente'

  const prompt = `
Eres CRUZ, el sistema de inteligencia aduanal de Renato Zapata & Company.

Genera un briefing matutino de EXACTAMENTE 3 oraciones en español para ${companyName}, basado en los datos abajo.

Reglas estrictas:
- Exactamente 3 oraciones. No más, no menos.
- Español neutro de México. Sin jerga aduanera.
- Hablar del cliente en tercera persona ("${companyName} tiene…"), no en "tú".
- Oración 1: estado operativo (si hay actividad, qué; si está calmado, decirlo con confianza).
- Oración 2: un dato específico interesante (mejor desempeño, tendencia, ahorro).
- Oración 3: si hay una acción necesaria, decirla con claridad; si no, reafirmar que todo marcha.
- Sin signos de exclamación. Sin lenguaje de marketing.
- No saludar ("Buenos días" lo renderiza la UI).

Devuelve ÚNICAMENTE un objeto JSON con este formato exacto:
{
  "briefing": "<las tres oraciones concatenadas>",
  "action_item": "<texto del CTA o null>",
  "action_url": "<ruta relativa comenzando con / o null>"
}

Datos para hoy (${ctx.period_end}):
${JSON.stringify({
  embarques_activos: ctx.active_count,
  proximo_cruce_fecha: ctx.next_arrival,
  cruces_ultima_semana: ctx.week_cruces,
  pedimentos_recientes: ctx.recent_pedimentos.slice(0, 3),
  ahorro_tmec_ytd_usd: ctx.tmec_ytd_usd,
}, null, 2)}
`.trim()

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = res.content?.[0]?.type === 'text' ? res.content[0].text.trim() : ''
  // Strip any fence if the model wrapped the JSON.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed.briefing !== 'string' || parsed.briefing.length === 0) {
      throw new Error('missing or empty briefing field')
    }
    return parsed
  } catch (e) {
    throw new Error(`Sonnet response wasn't parseable JSON: ${e.message}\nRaw: ${cleaned.slice(0, 200)}`)
  }
}

async function runForCompany(companyId, targetDate) {
  console.log(`\n▶ ${companyId}  (period=${targetDate})`)
  const ctx = await gatherContext(companyId, targetDate)
  if (!ctx.company) {
    console.log(`  ⚠ company not found, skipping`)
    return
  }

  if (!force) {
    const { data: existing } = await supabase
      .from('client_briefings')
      .select('id')
      .eq('company_id', companyId)
      .eq('period_start', ctx.period_start)
      .eq('period_end', ctx.period_end)
      .limit(1)
      .maybeSingle()
    if (existing) {
      console.log(`  ↷ briefing already exists for this period, skipping (use --force to regenerate)`)
      return
    }
  }

  const result = await askSonnet(ctx)
  console.log(`  ✎ ${result.briefing.slice(0, 80)}${result.briefing.length > 80 ? '…' : ''}`)

  const row = {
    company_id: companyId,
    period_start: ctx.period_start,
    period_end: ctx.period_end,
    briefing_text: result.briefing,
    data_points: {
      active_count: ctx.active_count,
      week_cruces: ctx.week_cruces,
      tmec_ytd_usd: ctx.tmec_ytd_usd,
      next_arrival: ctx.next_arrival,
    },
    action_item: result.action_item || null,
    action_url: result.action_url || null,
  }
  await safeInsert(supabase, 'client_briefings', row, { scriptName: 'client-briefing-generator' })
  console.log(`  ✓ stored`)
}

;(async () => {
  const today = dateOverride || new Date().toISOString().slice(0, 10)
  let companyIds
  if (filterCompanyId) {
    companyIds = [filterCompanyId]
  } else {
    const { data } = await supabase.from('companies').select('company_id').eq('active', true)
    companyIds = (data ?? []).map((c) => c.company_id).filter(Boolean)
  }
  console.log(`\n🌅 Morning briefing generator — ${companyIds.length} companies · date ${today}`)

  let ok = 0, skipped = 0, failed = 0
  for (const cid of companyIds) {
    try {
      await runForCompany(cid, today)
      ok++
    } catch (e) {
      console.error(`  ✗ ${cid}: ${e.message}`)
      failed++
    }
  }
  console.log(`\nDone. ${ok} ok · ${skipped} skipped · ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
})().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
