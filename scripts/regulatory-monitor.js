const { createClient } = require('@supabase/supabase-js')
const { extractWithQwen, isOllamaRunning } = require('./qwen-extract')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

const SOURCES = [
  {
    name: 'DOF',
    url: 'https://www.dof.gob.mx/rss.php',
    type: 'rss'
  },
  {
    name: 'SAT Comercio Exterior',
    url: 'https://www.sat.gob.mx/cs/Satellite?pagename=sat/Page/SAT_RSSChannel&channel=comercioexterior',
    type: 'rss'
  }
]

const ANALYSIS_PROMPT = `You are a Mexican customs compliance expert.
Analyze this regulatory notice and return JSON:
{
  "affects_customs": true or false,
  "impact_level": "critical" or "high" or "medium" or "low" or "none",
  "impact_summary": "2 sentence summary of impact on customs operations or null",
  "keywords": ["list", "of", "relevant", "terms"]
}
Return JSON only. No explanation.`

async function fetchRSS(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'CRUZ-RegMonitor/1.0' }
    })
    const text = await res.text()

    // Simple RSS parser
    const items = []
    const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g)

    for (const match of itemMatches) {
      const item = match[1]
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
                    item.match(/<title>(.*?)<\/title>/)?.[1] || ''
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
      const description = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1] ||
                          item.match(/<description>(.*?)<\/description>/)?.[1] || ''

      if (title) items.push({ title, link, pubDate, description })
    }

    return items.slice(0, 20) // Last 20 items
  } catch (e) {
    console.error(`RSS fetch error for ${url}:`, e.message)
    return []
  }
}

async function run() {
  console.log('📰 Regulatory Monitor — checking DOF and SAT')

  const ollamaUp = await isOllamaRunning()
  if (!ollamaUp) {
    console.log('⚠️ Ollama not running — using keyword filter only')
  }

  const CUSTOMS_KEYWORDS = [
    'arancel', 'importación', 'exportación', 'aduana', 'pedimento',
    'fracción', 'TIGIE', 'IMMEX', 'maquila', 'comercio exterior',
    'NOM', 'cupo', 'permiso', 'SAT', 'VUCEM', 'regla'
  ]

  const alerts = []

  for (const source of SOURCES) {
    console.log(`\nFetching ${source.name}...`)
    const items = await fetchRSS(source.url)
    console.log(`  ${items.length} items found`)

    for (const item of items) {
      // Quick keyword filter first
      const text = (item.title + ' ' + item.description).toLowerCase()
      const hasKeyword = CUSTOMS_KEYWORDS.some(k => text.includes(k.toLowerCase()))

      if (!hasKeyword) continue

      // Check if already processed
      const { data: existing } = await supabase
        .from('regulatory_alerts')
        .select('id')
        .eq('title', item.title.substring(0, 200))
        .limit(1)

      if (existing?.length > 0) continue

      let analysis = null
      if (ollamaUp) {
        analysis = await extractWithQwen(
          item.title + '\n\n' + item.description,
          ANALYSIS_PROMPT
        )
      }

      const affects = analysis?.affects_customs ?? true
      const level = analysis?.impact_level ?? 'medium'
      const summary = analysis?.impact_summary ?? item.title

      // Save to DB
      await supabase.from('regulatory_alerts').insert({
        source: source.name,
        title: item.title.substring(0, 500),
        url: item.link,
        published_date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : null,
        affects_customs: affects,
        impact_summary: summary,
        raw_content: item.description?.substring(0, 2000),
      }).catch(() => {})

      if (affects && (level === 'critical' || level === 'high')) {
        alerts.push({ source: source.name, title: item.title, level, summary })
      }
    }
  }

  console.log(`\n✅ Regulatory monitor complete. ${alerts.length} high-priority alerts`)

  if (alerts.length > 0) {
    const lines = [
      `📰 <b>ALERTAS REGULATORIAS — CRUZ</b>`,
      `${new Date().toLocaleDateString('es-MX')}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      ...alerts.slice(0, 5).map(a =>
        `🔴 <b>${a.source}</b>\n${a.title.substring(0, 100)}\n${a.summary || ''}`
      ),
      `━━━━━━━━━━━━━━━━━━━━`,
      `— CRUZ 🦀`
    ]
    await tg(lines.join('\n'))
  } else {
    console.log('No high-priority regulatory alerts this week')
  }
}

module.exports = { run }
run().catch(console.error)
