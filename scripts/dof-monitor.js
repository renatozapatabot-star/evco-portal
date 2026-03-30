#!/usr/bin/env node
// scripts/dof-monitor.js — BUILD 3 PHASE 7
// DOF Regulatory Monitor — enhanced version
// Monitors DOF + SAT for customs-relevant changes
// Matches affected HTS codes against active client portfolios
// Cron: 0 9 * * 1-5 (weekdays 9 AM)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

let extractWithQwen, isOllamaRunning
try {
  const qwen = require('./qwen-extract')
  extractWithQwen = qwen.extractWithQwen
  isOllamaRunning = qwen.isOllamaRunning
} catch {
  extractWithQwen = null
  isOllamaRunning = async () => false
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function sendTG(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

// ── RSS Sources ──────────────────────────────────────
const DOF_RSS = 'https://www.dof.gob.mx/rss.php'
const SOURCES = [
  { name: 'DOF', url: DOF_RSS, type: 'rss' },
  { name: 'SAT Comercio Exterior', url: 'https://www.sat.gob.mx/cs/Satellite?pagename=sat/Page/SAT_RSSChannel&channel=comercioexterior', type: 'rss' },
]

// ── Customs keywords ───��─────────────────────────────
const CUSTOMS_KEYWORDS = [
  'arancel', 'fracción arancelaria', 'TIGIE',
  'NOM', 'RGCE', 'comercio exterior', 'aduana',
  'cuota compensatoria', 'T-MEC', 'USMCA',
  'IMMEX', 'pedimento', 'SAT', 'importación',
  'exportación', 'Ley Aduanera', 'impuesto general',
  'regla general', 'certificado de origen',
  'manifestación de valor', 'MVE', 'VUCEM'
]

// ── Qwen analysis prompt ─────────────────────────────
const ANALYSIS_PROMPT = `You are a Mexican customs compliance expert analyzing a regulatory publication.
Return ONLY valid JSON with these fields:
{
  "affects_customs": true/false,
  "severity": "critical" | "moderate" | "informational",
  "what_changed": "1-2 sentence summary of the change",
  "affected_hts_codes": ["8471.30", "3901.10"] or [] if none specific,
  "effective_date": "YYYY-MM-DD" or null,
  "required_actions": "What importers/brokers must do" or null,
  "keywords": ["relevant", "terms"]
}
Return JSON only.`

// ── RSS Parser ──────────��────────────────────────────
async function fetchRSS(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'CRUZ-DOFMonitor/2.0' }
    })
    const text = await res.text()
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
      if (title) items.push({ title: title.trim(), link: link.trim(), pubDate, description: description.trim() })
    }
    return items.slice(0, 30)
  } catch (e) {
    console.error(`RSS fetch error for ${url}:`, e.message)
    return []
  }
}

// ── Ensure regulatory_alerts table ───────────────────
async function ensureTable() {
  await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS regulatory_alerts (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        dof_date DATE,
        title TEXT,
        summary TEXT,
        affected_hts_codes JSONB,
        effective_date DATE,
        severity TEXT,
        affected_clients JSONB,
        action_required TEXT,
        source_url TEXT,
        source TEXT,
        raw_content TEXT,
        affects_customs BOOLEAN DEFAULT true,
        impact_summary TEXT,
        published_date DATE,
        url TEXT,
        processed_by TEXT DEFAULT 'qwen3:8b',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  }).catch(() => {})
}

// ── Main ──────────��──────────────────────────────────
async function main() {
  console.log('🏛️  DOF REGULATORY MONITOR — CRUZ Build 3')
  console.log('═'.repeat(55))
  const start = Date.now()

  await ensureTable()

  const ollamaUp = isOllamaRunning ? await isOllamaRunning() : false
  console.log(`Ollama: ${ollamaUp ? '✅ Online' : '��️  Offline — keyword filter only'}`)

  // Load active client portfolios (HTS codes in use)
  console.log('\n📦 Loading client portfolios...')
  const { data: productos } = await supabase.from('globalpc_productos')
    .select('fraccion, company_id')
    .not('fraccion', 'is', null)
    .limit(10000)

  const clientHTS = {} // company_id -> Set of chapter codes
  for (const p of (productos || [])) {
    if (!p.fraccion || !p.company_id) continue
    if (!clientHTS[p.company_id]) clientHTS[p.company_id] = new Set()
    clientHTS[p.company_id].add(p.fraccion.substring(0, 2)) // Chapter level
    clientHTS[p.company_id].add(p.fraccion.substring(0, 4)) // Heading level
    clientHTS[p.company_id].add(p.fraccion) // Full fraccion
  }
  console.log(`  ${Object.keys(clientHTS).length} client portfolios loaded`)

  const alerts = []
  let processedCount = 0

  for (const source of SOURCES) {
    console.log(`\n�� Fetching ${source.name}...`)
    const items = await fetchRSS(source.url)
    console.log(`  ${items.length} items found`)

    for (const item of items) {
      const text = (item.title + ' ' + item.description).toLowerCase()
      const hasKeyword = CUSTOMS_KEYWORDS.some(k => text.includes(k.toLowerCase()))
      if (!hasKeyword) continue

      // Check if already processed
      const { data: existing } = await supabase
        .from('regulatory_alerts')
        .select('id')
        .eq('title', item.title.substring(0, 200))
        .limit(1)

      if (existing?.length > 0) {
        processedCount++
        continue
      }

      // Analyze with Qwen if available
      let analysis = null
      if (ollamaUp && extractWithQwen) {
        try {
          analysis = await extractWithQwen(
            item.title + '\n\n' + item.description,
            ANALYSIS_PROMPT
          )
        } catch (e) {
          console.log(`  ��️  Qwen analysis failed: ${e.message}`)
        }
      }

      const severity = analysis?.severity || 'informational'
      const whatChanged = analysis?.what_changed || item.title
      const affectedHTS = analysis?.affected_hts_codes || []
      const effectiveDate = analysis?.effective_date || null
      const actionRequired = analysis?.required_actions || null

      // Match affected HTS codes against client portfolios
      const affectedClients = []
      for (const [companyId, htsSet] of Object.entries(clientHTS)) {
        for (const code of affectedHTS) {
          if (htsSet.has(code) || htsSet.has(code.substring(0, 2)) || htsSet.has(code.substring(0, 4))) {
            affectedClients.push(companyId)
            break
          }
        }
      }

      // Save to database
      const pubDate = item.pubDate ? new Date(item.pubDate) : new Date()
      const { error } = await supabase.from('regulatory_alerts').insert({
        dof_date: pubDate.toISOString().split('T')[0],
        title: item.title.substring(0, 500),
        summary: whatChanged,
        affected_hts_codes: affectedHTS,
        effective_date: effectiveDate,
        severity,
        affected_clients: affectedClients.length > 0 ? affectedClients : null,
        action_required: actionRequired,
        source_url: item.link,
        source: source.name,
        raw_content: item.description?.substring(0, 2000),
        affects_customs: true,
        impact_summary: whatChanged,
        published_date: pubDate.toISOString().split('T')[0],
        url: item.link,
        processed_by: ollamaUp ? 'qwen3:8b' : 'keyword_filter',
      })

      if (error) {
        console.log(`  ⚠️  Save error: ${error.message}`)
      }

      const icon = severity === 'critical' ? '����' : severity === 'moderate' ? '🟡' : '🔵'
      console.log(`  ${icon} ${item.title.substring(0, 80)}`)
      if (affectedClients.length > 0) console.log(`    → Affects: ${affectedClients.join(', ')}`)

      if (severity === 'critical' || severity === 'moderate') {
        alerts.push({
          severity,
          title: item.title,
          summary: whatChanged,
          affected_hts_codes: affectedHTS,
          effective_date: effectiveDate,
          action_required: actionRequired,
          affected_clients: affectedClients,
          source: source.name,
        })
      }
    }
  }

  // ── Summary ────────────────────────────────────────
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log('\n' + '═'.repeat(55))
  console.log('DOF MONITOR COMPLETE')
  console.log('═'.repeat(55))
  console.log(`New alerts: ${alerts.length}`)
  console.log(`Already processed: ${processedCount}`)
  console.log(`Time: ${elapsed}s`)

  // ── Telegram (critical/moderate alerts) ────────────
  if (alerts.length > 0) {
    for (const alert of alerts.slice(0, 3)) {
      const msg = `🏛️ <b>DOF ALERT — ${alert.severity.toUpperCase()}</b>
━━━━━━━━━━━━━━━━━━━━━
<b>${alert.title.substring(0, 120)}</b>

${alert.summary || ''}
${alert.affected_hts_codes?.length > 0 ? `\nFracciones: ${alert.affected_hts_codes.join(', ')}` : ''}
${alert.effective_date ? `Vigencia: ${alert.effective_date}` : ''}
${alert.affected_clients?.length > 0 ? `Clientes: ${alert.affected_clients.join(', ')}` : ''}
${alert.action_required ? `\nAcción: ${alert.action_required}` : ''}
━━━━━━━━━━━━━━━━━━━━━
— CRUZ 🦀`

      await sendTG(msg)
    }
  }
}

main().catch(err => {
  console.error('❌ Fatal:', err.message)
  process.exit(1)
})
