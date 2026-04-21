#!/usr/bin/env node

// ============================================================
// CRUZ Regulatory Feed — monitors DOF, SAT, CBP for changes
// Classifies relevance to customs brokerage operations.
// Cron: 0 6 * * 1-5 (weekdays 6 AM)
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TELEGRAM_CHAT = '-5085543275'

// RSS/API sources for regulatory news
const SOURCES = [
  { name: 'DOF', url: 'https://www.dof.gob.mx/rss/juridicas.xml', type: 'rss' },
  { name: 'SAT', url: 'https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461172982000&ssbinary=true', type: 'api' },
]

// Keywords that indicate customs relevance
const CUSTOMS_KEYWORDS = [
  'aduana', 'aduaner', 'importaci', 'exportaci', 'arancelari', 'fracción',
  'pedimento', 'despacho', 'comercio exterior', 'TIGIE', 'T-MEC', 'USMCA',
  'regla de origen', 'certificado de origen', 'DTA', 'IGI', 'IVA',
  'IMMEX', 'maquilador', 'zona libre', 'VUCEM', 'ventanilla única',
  'MVE', 'manifestación de valor', 'COVE', 'NOM', 'regulaciones',
  'padrón de importador', 'agente aduanal', 'patente',
]

function classifyRelevance(title, content) {
  const text = `${title} ${content}`.toLowerCase()
  const matches = CUSTOMS_KEYWORDS.filter(k => text.includes(k))
  if (matches.length >= 3) return { level: 'high', matches }
  if (matches.length >= 1) return { level: 'medium', matches }
  return { level: 'low', matches }
}

async function sendTelegram(msg) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (DRY_RUN || !token || process.env.TELEGRAM_SILENT === 'true') {
    console.log('[TG]', msg.replace(/<[^>]+>/g, ''))
    return
  }
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

async function fetchFeed(source) {
  try {
    const res = await fetch(source.url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'CRUZ/1.0 (customs-intelligence)' },
    })
    if (!res.ok) return []

    const text = await res.text()

    // Simple XML RSS parsing (no external dependency)
    const items = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match
    while ((match = itemRegex.exec(text)) !== null) {
      const itemXml = match[1]
      const title = (itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim()
      const link = (itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] || '').trim()
      const desc = (itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/)?.[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim()
      const pubDate = (itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/)?.[1] || '').trim()

      if (title) {
        items.push({ title, link, description: desc.substring(0, 500), pubDate, source: source.name })
      }
    }
    return items.slice(0, 10) // Max 10 per source
  } catch (err) {
    console.log(`  ⚠️ ${source.name}: ${err.message}`)
    return []
  }
}

async function main() {
  console.log(`📰 CRUZ Regulatory Feed — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)

  let allItems = []
  for (const source of SOURCES) {
    console.log(`  Fetching ${source.name}...`)
    const items = await fetchFeed(source)
    console.log(`    ${items.length} items`)
    allItems.push(...items)
  }

  if (allItems.length === 0) {
    console.log('  No items found — sources may be unreachable')
    process.exit(0)
  }

  // Classify relevance
  const relevant = []
  for (const item of allItems) {
    const { level, matches } = classifyRelevance(item.title, item.description)
    if (level === 'low') continue

    // Dedup: check if already in DB
    const { data: existing } = await supabase
      .from('regulatory_alerts')
      .select('id')
      .eq('title', item.title.substring(0, 200))
      .limit(1)

    if (existing && existing.length > 0) continue

    const entry = {
      title: item.title.substring(0, 200),
      description: item.description.substring(0, 500),
      source: item.source,
      url: item.link,
      relevance: level,
      keywords: matches,
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    }

    if (!DRY_RUN) {
      await supabase.from('regulatory_alerts').insert(entry).then(() => {}, () => {})
    }

    relevant.push(entry)
    console.log(`  ${level === 'high' ? '🔴' : '🟡'} ${item.title.substring(0, 60)}`)
  }

  // Telegram for high-relevance items
  const highItems = relevant.filter(r => r.relevance === 'high')
  if (highItems.length > 0) {
    const lines = [
      `📰 <b>Alerta Regulatoria</b>`,
      ``,
      ...highItems.slice(0, 3).map(r => `🔴 <b>${r.title.substring(0, 60)}</b>\n   ${r.description.substring(0, 80)}...`),
      ``,
      `${relevant.length} actualizaciones relevantes hoy`,
      `— CRUZ 🦀`,
    ]
    await sendTelegram(lines.join('\n'))
  }

  console.log(`\n✅ ${relevant.length} relevant items (${highItems.length} high)`)
  process.exit(0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
