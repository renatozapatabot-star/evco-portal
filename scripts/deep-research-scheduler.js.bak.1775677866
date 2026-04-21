const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const CLAVE = '9254'

async function sendTelegram(message) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(message); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: message, parse_mode: 'HTML' })
  })
}

async function getEVCOFracciones() {
  const { data } = await supabase
    .from('aduanet_facturas')
    .select('pedimento')
    .eq('clave_cliente', CLAVE)
    .not('pedimento', 'is', null)
  const unique = [...new Set((data || []).map(f => f.pedimento).filter(Boolean))]
  return unique
}

async function runDeepResearch(topic, fracciones) {
  if (!ANTHROPIC_KEY) {
    console.log('⚠️  No ANTHROPIC_API_KEY — skipping Claude research')
    return null
  }

  const prompt = `You are a Mexico customs compliance researcher for Renato Zapata & Company,
a customs brokerage in Laredo Texas (Patente 3596, Aduana 240 Nuevo Laredo).

EVCO Plastics de México (RFC EPM001109I74) imports plastic products primarily using these
fracción arancelaria codes: ${fracciones.slice(0, 10).join(', ')}

Research the following topic and provide a concise compliance brief:
${topic}

Focus on:
1. Any recent changes to tariff rates for Chapter 39 (plastics) products
2. New SAT/VUCEM requirements affecting imports
3. USMCA/T-MEC updates relevant to US-origin plastics
4. NOM changes affecting plastic product imports

Format your response as:
- FINDINGS: [key findings, max 5 bullet points]
- ACTION REQUIRED: [specific actions Ursula or Tito should take, if any]
- PRIORITY: [Alta/Media/Baja]

Be specific and actionable. If no significant changes found, say so clearly.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    })
    const data = await res.json()
    // Cost tracking
    supabase.from('api_cost_log').insert({
      model: 'claude-sonnet-4-20250514',
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
      cost_usd: ((data.usage?.input_tokens || 0) * 0.003 + (data.usage?.output_tokens || 0) * 0.015) / 1000,
      action: 'deep_research',
      client_code: 'system',
      latency_ms: 0,
    }).then(() => {}, () => {})
    return data.content?.[0]?.text || null
  } catch (e) {
    console.error('Claude API error:', e.message)
    return null
  }
}

async function runDeepResearchScheduler() {
  console.log('🔬 Running Deep Research Scheduler...')

  const fracciones = await getEVCOFracciones()
  console.log(`📋 EVCO uses ${fracciones.length} unique fracciones`)

  const topics = [
    'Recent DOF publications affecting Chapter 39 (plastics) tariff rates and any TIGIE amendments in the last 30 days',
    'New SAT or VUCEM requirements for MVE, COVE, or pedimento transmission in 2026',
    'USMCA/T-MEC rule of origin updates for plastics and polymer products from USA to Mexico',
  ]

  const findings = []

  for (const topic of topics) {
    console.log(`\n🔍 Researching: ${topic.substring(0, 60)}...`)
    const result = await runDeepResearch(topic, fracciones)
    if (result) {
      findings.push({ topic: topic.substring(0, 80), result })
      console.log(`✅ Finding received`)
    }
    await new Promise(r => setTimeout(r, 2000))
  }

  const outputPath = path.join(process.env.HOME || '', 'Desktop',
    `CRUZ-Research-${new Date().toISOString().split('T')[0]}.txt`)

  const fileContent = [
    `CRUZ REGULATORY INTELLIGENCE BRIEF`,
    `Renato Zapata & Company · ${new Date().toLocaleDateString('es-MX')}`,
    `EVCO Plastics · Fracciones analizadas: ${fracciones.length}`,
    `${'═'.repeat(60)}`,
    '',
    ...findings.map((f, i) => [
      `${i + 1}. ${f.topic}`,
      '─'.repeat(40),
      f.result,
      ''
    ].join('\n'))
  ].join('\n')

  fs.writeFileSync(outputPath, fileContent)
  console.log(`\n✅ Research saved: ${outputPath}`)

  if (findings.length > 0) {
    const hasAction = findings.some(f => f.result?.includes('ACTION REQUIRED') &&
      !f.result?.includes('No action required') && !f.result?.includes('Baja'))
    await sendTelegram([
      `🔬 <b>REGULATORY INTELLIGENCE — CRUZ</b>`,
      `${new Date().toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long' })}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Fracciones EVCO analizadas: ${fracciones.length}`,
      `Temas investigados: ${findings.length}`,
      ``,
      hasAction ? `⚠️ <b>ACCIÓN REQUERIDA</b> — Ver reporte completo` : `✅ Sin cambios regulatorios urgentes`,
      ``,
      `Reporte: ~/Desktop/CRUZ-Research-${new Date().toISOString().split('T')[0]}.txt`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `— CRUZ 🦀`
    ].join('\n'))
  } else {
    console.log('ℹ️  No API key — research skipped. Add ANTHROPIC_API_KEY to .env.local to enable.')
    await sendTelegram([
      `🔬 <b>DEEP RESEARCH — MODO DEMO</b>`,
      `ANTHROPIC_API_KEY no configurado`,
      `Agrega la clave al .env.local para activar investigación regulatoria automática`,
      `— CRUZ 🦀`
    ].join('\n'))
  }
}

runDeepResearchScheduler().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
