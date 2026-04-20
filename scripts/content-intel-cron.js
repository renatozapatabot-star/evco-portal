#!/usr/bin/env node
/**
 * content-intel-cron.js — daily content intelligence for LinkedIn B2B
 * Mexican-customs audience.
 *
 * Flow: pull last-24h stories from Google News RSS (5 queries) + DOF RSS
 * (authoritative) + CBP bridge-wait anomaly → dedupe against past 7
 * days → pre-score + Haiku rank → Haiku draft the top 3 (Spanish
 * peer-to-peer register, 150 words, hook, sources, suggested Tue 10 AM
 * CT post time) → write markdown log + Supabase row + Telegram.
 *
 * Scheduled via PM2 `cron_restart: '15 11 * * *'` (6:15 AM CDT).
 * Zero paid dependencies: Google News + DOF RSS + CBP are free.
 * Cost: ~$0.014/day in Haiku calls (1 ranking + 3 drafts).
 *
 *   node scripts/content-intel-cron.js --dry-run              # no telegram, no db write
 *   node scripts/content-intel-cron.js --date=2026-04-19      # backfill
 *
 * Respects TELEGRAM_SILENT=true via lib/telegram.js. Logs to sync_log
 * via lib/sync-log.js + api_cost_log for every Anthropic call (per
 * .claude/rules/operational-resilience.md rules 1 + 4).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const Anthropic = require('@anthropic-ai/sdk')
const { sendTelegram } = require('./lib/telegram')
const { withSyncLog } = require('./lib/sync-log')

const SCRIPT_NAME = 'content-intel-cron'
const HAIKU = 'claude-haiku-4-5-20251001'
const SONNET = 'claude-sonnet-4-6'
const DEDUP_DAYS = parseInt(process.env.DEDUP_DAYS || '7', 10)
const LOG_DIR = path.join(__dirname, 'logs', 'content-intel')
const SCORE_THRESHOLD = 6

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Config: RSS sources ─────────────────────────────────────────────

// Google News `when:2d` operator keeps the source-side filter to ~48h
// (client-side within24h further narrows). 48h is intentional — Google's
// `when:1d` routinely drops below 5 results, killing days with calm news.
const GOOGLE_QUERIES = [
  'SAT OR ANAM OR VUCEM aduana México circular when:2d',
  'USTR CBP T-MEC USMCA México when:2d',
  'nearshoring inversión Nuevo León OR Coahuila OR Chihuahua when:2d',
  'IMMEX maquila regla comercio exterior México when:2d',
  'tiempos espera puente fronterizo Laredo OR Juárez OR Tijuana when:2d',
]

// DOF's own RSS (www.dof.gob.mx/rss/rss.php) is unreachable from most
// networks — DNS + GovCloud ACLs reject plain fetch. Proxy via Google
// News `site:dof.gob.mx` instead: authoritative content, broadly
// reachable transport. Rated as DOF source downstream for pre-score.
const DOF_PROXY_URL = 'https://news.google.com/rss/search?q=' +
  encodeURIComponent('site:dof.gob.mx (aduana OR comercio OR arancel OR immex OR fracción) when:2d') +
  '&hl=es-MX&gl=MX&ceid=MX:es'

const DOF_HIGH_PRIORITY = /\b(comercio\s+exterior|aduana|arancel|immex|t-mec|vucem|anam)\b/i

const POLICY_KW = /\b(regla|dof|circular|acuerdo|decreto|ustr|cbp|sat|anam|vucem|usmca|t-mec)\b/i
const OPS_KW = /\b(immex|pedimento|padrón|anexo|arancel|aduana|despacho|maquila|fracción|fraccion)\b/i

const STOPWORDS = new Set([
  'para','sobre','entre','desde','hasta','este','esta','estos','estas','como','pero','porque',
  'cuando','donde','mientras','según','segun','también','tambien','más','mas','menos','muy',
  'mucho','todo','todos','todas','sólo','solo','cada','ese','esos','esa','esas','del','con',
  'por','las','los','una','unos','unas','the','and','for','with','from','that','this',
])

// ─── args + helpers ─────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run')
const dateArg = process.argv.find((a) => a.startsWith('--date='))?.split('=')[1]
const RUN_DATE = dateArg || new Date().toISOString().slice(0, 10)

function log(level, ...args) {
  console.log(`[${new Date().toISOString()}] ${level}:`, ...args)
}

function topicHash(title) {
  const normalized = String(title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .sort()
    .join(' ')
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 12)
}

function within24h(pubDate, runDate) {
  if (!pubDate) return true // trust the source if no timestamp
  const t = new Date(pubDate).getTime()
  if (Number.isNaN(t)) return true
  const runT = new Date(`${runDate}T23:59:59Z`).getTime()
  return runT - t <= 48 * 3600 * 1000 // 48h window · matches when:2d source-side filter
}

async function fetchWithTimeout(url, ms = 15000) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), ms)
  try {
    const r = await fetch(url, {
      signal: ctl.signal,
      headers: { 'User-Agent': 'CRUZ content-intel-cron/1 (Renato Zapata & Company)' },
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.text()
  } finally {
    clearTimeout(timer)
  }
}

// Minimal RSS parser — extracts <item> blocks. No DOM lib dep.
function parseRss(xml, source) {
  const items = []
  const rx = /<item[^>]*>([\s\S]*?)<\/item>/g
  let m
  while ((m = rx.exec(xml))) {
    const block = m[1]
    const get = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block)
      if (!r) return ''
      return r[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim()
    }
    const title = get('title')
    const link = get('link')
    const description = get('description')
    const pubDate = get('pubDate')
    if (!title || !link) continue
    items.push({ title, url: link, snippet: description.slice(0, 500), publishedAt: pubDate, source })
  }
  return items
}

// ─── gather ─────────────────────────────────────────────────────────

async function gatherGoogleNews() {
  const results = []
  await Promise.all(
    GOOGLE_QUERIES.map(async (q) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-MX&gl=MX&ceid=MX:es`
      try {
        const xml = await fetchWithTimeout(url, 15000)
        const items = parseRss(xml, 'GoogleNews')
        results.push(...items.filter((i) => within24h(i.publishedAt, RUN_DATE)))
      } catch (e) {
        log('WARN', `google-news query failed (${q.slice(0, 30)}…):`, e.message)
      }
    }),
  )
  return results
}

async function gatherDof() {
  try {
    const xml = await fetchWithTimeout(DOF_PROXY_URL, 15000)
    const items = parseRss(xml, 'DOF')
    return items.filter((i) => within24h(i.publishedAt, RUN_DATE))
  } catch (e) {
    log('WARN', 'DOF proxy RSS failed:', e.message)
    return []
  }
}

async function gatherBridgeAnomaly() {
  try {
    const { data } = await supabase
      .from('bridge_intelligence')
      .select('bridge, avg_wait_minutes, recorded_at, baseline_avg, stddev')
      .gte('recorded_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order('recorded_at', { ascending: false })
      .limit(50)
    if (!data || data.length === 0) return []
    const anomalies = data.filter((r) => {
      if (!r.baseline_avg || !r.stddev) return false
      return Math.abs(r.avg_wait_minutes - r.baseline_avg) > 2 * r.stddev
    })
    return anomalies.slice(0, 2).map((r) => ({
      title: `${r.bridge}: tiempos de espera ${Math.round(((r.avg_wait_minutes - r.baseline_avg) / r.baseline_avg) * 100)}% fuera de baseline`,
      url: 'https://bwt.cbp.gov/',
      snippet: `Promedio actual: ${r.avg_wait_minutes} min · baseline: ${Math.round(r.baseline_avg)} min · σ: ${Math.round(r.stddev)} min`,
      publishedAt: r.recorded_at,
      source: 'CBP-anomaly',
    }))
  } catch (e) {
    log('WARN', 'bridge anomaly check failed:', e.message)
    return []
  }
}

// ─── dedup + normalize ──────────────────────────────────────────────

async function loadDedupSet() {
  const since = new Date(Date.now() - DEDUP_DAYS * 86400 * 1000).toISOString().slice(0, 10)
  try {
    const { data } = await supabase
      .from('content_intel_runs')
      .select('topic_hashes')
      .gte('run_date', since)
    const set = new Set()
    for (const row of data || []) {
      for (const h of row.topic_hashes || []) set.add(h)
    }
    return set
  } catch (e) {
    log('WARN', 'dedup from Supabase failed; falling back to filesystem scan:', e.message)
    return loadDedupSetFromFs(since)
  }
}

function loadDedupSetFromFs(sinceIso) {
  const set = new Set()
  if (!fs.existsSync(LOG_DIR)) return set
  for (const f of fs.readdirSync(LOG_DIR)) {
    if (!/^\d{4}-\d{2}-\d{2}\.md$/.test(f)) continue
    if (f.slice(0, 10) < sinceIso) continue
    const body = fs.readFileSync(path.join(LOG_DIR, f), 'utf8')
    const m = /topic_hashes:\s*\[(.+?)\]/.exec(body)
    if (m) {
      for (const h of m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''))) {
        if (h) set.add(h)
      }
    }
  }
  return set
}

function normalize(items) {
  const seen = new Set()
  const out = []
  for (const it of items) {
    const hash = topicHash(it.title)
    if (seen.has(hash)) continue
    seen.add(hash)
    out.push({ ...it, hash })
  }
  return out
}

// ─── pre-score ──────────────────────────────────────────────────────

function preScore(item, dedupSet) {
  let score = 5
  const text = `${item.title} ${item.snippet}`.toLowerCase()
  if (POLICY_KW.test(text)) score += 2
  if (OPS_KW.test(text)) score += 2
  if (item.source === 'DOF' && DOF_HIGH_PRIORITY.test(text)) score += 4
  else if (item.source === 'DOF') score += 2
  if (item.source === 'CBP-anomaly') score += 3
  if (dedupSet.has(item.hash)) score -= 2
  return { ...item, preScore: Math.max(1, Math.min(10, score)) }
}

// ─── Anthropic helpers + cost tracking ──────────────────────────────

const PRICES = {
  [HAIKU]: { in: 1 / 1_000_000, out: 5 / 1_000_000 },
  [SONNET]: { in: 3 / 1_000_000, out: 15 / 1_000_000 },
}

function costFor(model, usage) {
  const p = PRICES[model] || { in: 0, out: 0 }
  return (usage?.input_tokens ?? 0) * p.in + (usage?.output_tokens ?? 0) * p.out
}

async function callModel({ model, messages, maxTokens, action }) {
  const start = Date.now()
  const res = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    messages,
  })
  const usage = res.usage || { input_tokens: 0, output_tokens: 0 }
  const cost = costFor(model, usage)
  // Fire-and-forget cost log (never block on audit writes).
  supabase
    .from('api_cost_log')
    .insert({
      model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd: Number(cost.toFixed(6)),
      action,
      client_code: null,
      latency_ms: Date.now() - start,
    })
    .then(() => {}, () => {})
  const text = res.content?.[0]?.type === 'text' ? res.content[0].text.trim() : ''
  return { text, cost, usage }
}

function stripFence(s) {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
}

// ─── Haiku ranker (single batched call) ─────────────────────────────

async function rankWithHaiku(items) {
  if (items.length === 0) return []
  const top = items.sort((a, b) => b.preScore - a.preScore).slice(0, 15)
  const payload = top.map((it, i) => ({
    id: i,
    title: it.title,
    source: it.source,
    preScore: it.preScore,
  }))

  const prompt = `Eres analista de comercio exterior México-US para una audiencia B2B de agentes aduanales, directores de logística e importadores mid-market en LinkedIn.

Aquí ${payload.length} noticias de hoy con pre-scores heurísticos. Para cada una devuelve JSON:
[{"id": 0, "final_score": 1-10, "underreported": true|false, "reasoning": "1 oración breve"}, ...]

Criterios:
- +3 si underreported (pocos medios mainstream lo cubren, subestimado)
- -2 si saturado (todos ya lo publicaron)
- Considera relevancia operativa para brokers e importadores mid-market
- final_score clampado 1-10

Noticias:
${JSON.stringify(payload, null, 2)}

Devuelve SOLO el JSON array, sin texto antes o después.`

  try {
    const { text, cost } = await callModel({
      model: HAIKU,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1500,
      action: 'content_intel_rank',
    })
    const cleaned = stripFence(text)
    const parsed = JSON.parse(cleaned)
    return { ranked: top.map((it, i) => {
      const r = parsed.find((x) => x.id === i) || {}
      const bonus = r.underreported ? 3 : 0
      return {
        ...it,
        finalScore: Math.max(1, Math.min(10, (it.preScore || 5) + bonus)),
        underreported: !!r.underreported,
        reasoning: r.reasoning || '',
      }
    }).sort((a, b) => b.finalScore - a.finalScore), cost }
  } catch (e) {
    log('WARN', 'Haiku ranker failed, falling back to pre-score only:', e.message)
    return {
      ranked: top.map((it) => ({ ...it, finalScore: it.preScore, underreported: false, reasoning: 'pre-score fallback' })),
      cost: 0,
    }
  }
}

// ─── Haiku drafter (3 parallel calls) ───────────────────────────────

function draftingPrompt(item) {
  return `Eres analista senior de comercio exterior México-US. Escribes en LinkedIn para agentes aduanales, directores de logística e importadores mid-market.
Registro: peer-to-peer, directo, sin corporativismos, sin emojis excesivos, sin frases huecas ("en un mundo cada vez más...").

Tema: ${item.title}
Contexto: ${item.snippet}
Fuente: ${item.url}

Devuelve SOLO JSON válido:
{
  "hook": "primera línea ≤12 palabras que detenga el scroll. NO pregunta retórica. NO 'sabías que'.",
  "body": "texto LinkedIn 150 palabras ±20, párrafos cortos, dato concreto en línea 2, implicación operativa, cierre con pregunta al gremio",
  "sources": ["${item.url}"],
  "suggested_time": "Martes 10:00 AM CT",
  "hashtags": ["3-5 hashtags minúscula sin #"]
}

Restricciones:
- Español mexicano. NO vosotros.
- Cifras citadas → fuente explícita en el cuerpo.
- NO inventes números ni fechas no presentes en el contexto.
- NO llamadas a la acción de venta ("contáctanos", "nuestra firma").
- El cuerpo entre 130 y 170 palabras.`
}

function validateDraft(d) {
  if (!d || typeof d !== 'object') return false
  if (typeof d.hook !== 'string' || d.hook.length === 0) return false
  if (typeof d.body !== 'string') return false
  const w = d.body.split(/\s+/).filter(Boolean).length
  if (w < 110 || w > 190) return false
  return true
}

async function draftOne(item) {
  const prompt = draftingPrompt(item)
  let lastErr
  // try Haiku, then Haiku with stricter nudge, then Sonnet
  const attempts = [
    { model: HAIKU, action: 'content_intel_draft' },
    { model: HAIKU, action: 'content_intel_draft_retry' },
    { model: SONNET, action: 'content_intel_draft_sonnet' },
  ]
  let totalCost = 0
  for (const a of attempts) {
    try {
      const { text, cost } = await callModel({
        model: a.model,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 800,
        action: a.action,
      })
      totalCost += cost
      const parsed = JSON.parse(stripFence(text))
      if (validateDraft(parsed)) return { draft: parsed, cost: totalCost }
      lastErr = new Error('draft failed validation (word count or shape)')
    } catch (e) {
      lastErr = e
    }
  }
  log('WARN', `draft fallback for "${item.title.slice(0, 40)}…":`, lastErr?.message)
  return {
    draft: {
      hook: item.title.slice(0, 80),
      body: `⚠️ borrador sin refinar — contexto: ${item.snippet.slice(0, 280)}`,
      sources: [item.url],
      suggested_time: 'Martes 10:00 AM CT',
      hashtags: ['comercioexterior', 'aduana'],
    },
    cost: totalCost,
    degraded: true,
  }
}

// ─── output ─────────────────────────────────────────────────────────

function renderMarkdown({ runDate, topRanked, drafts, allItems, dryRun, totalCost }) {
  const hashes = topRanked.map((it) => it.hash)
  const fm = [
    '---',
    `run_date: ${runDate}`,
    `total_items_considered: ${allItems.length}`,
    `cost_usd: ${totalCost.toFixed(4)}`,
    `topic_hashes: [${hashes.map((h) => `"${h}"`).join(', ')}]`,
    `dry_run: ${dryRun}`,
    '---',
    '',
    `# Content Intel · ${runDate}`,
    '',
    '## Top 3 drafts',
    '',
  ]
  drafts.forEach((d, i) => {
    const item = topRanked[i]
    fm.push(
      `### ${i + 1}. ${d.draft.hook}`,
      '',
      `_Score: ${item.finalScore}/10 · Sugerido: ${d.draft.suggested_time}_${d.degraded ? ' · ⚠️ degraded' : ''}`,
      '',
      d.draft.body,
      '',
      `**Fuentes:** ${(d.draft.sources || []).map((u) => `<${u}>`).join(' · ')}`,
      `**Hashtags:** ${(d.draft.hashtags || []).join(', ')}`,
      '',
      '---',
      '',
    )
  })
  fm.push('## All ranked items', '')
  for (const it of allItems) {
    fm.push(`- [${it.finalScore ?? it.preScore}] (${it.source}) ${it.title} — <${it.url}>`)
  }
  return fm.join('\n')
}

function renderTelegramMessage({ runDate, topRanked, drafts, logPath, note }) {
  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  const lines = [
    `🧠 <b>Content Intel — ${runDate}</b>`,
    note || 'Top 3 temas para LinkedIn',
    '',
  ]
  drafts.forEach((d, i) => {
    const item = topRanked[i]
    lines.push('━━━━━━━━')
    lines.push(`<b>${i + 1}. ${esc(d.draft.hook)}</b>`)
    lines.push(`<i>Score: ${item.finalScore}/10 · Sugerido: ${esc(d.draft.suggested_time)}</i>`)
    lines.push('')
    lines.push(esc(d.draft.body))
    lines.push('')
    const src = (d.draft.sources || []).slice(0, 3)
    if (src.length) {
      lines.push(`Fuentes: ${src.map((u, j) => `<a href="${esc(u)}">[${j + 1}]</a>`).join(' ')}`)
    }
    if (d.draft.hashtags?.length) {
      lines.push(`Hashtags: ${d.draft.hashtags.map((h) => `#${h}`).join(' ')}`)
    }
  })
  lines.push('━━━━━━━━')
  lines.push(`📝 Log: ${logPath.replace(process.env.HOME || '', '~')}`)
  return lines.join('\n')
}

function splitForTelegram(msg, limit = 4000) {
  if (msg.length <= limit) return [msg]
  const parts = []
  const blocks = msg.split('━━━━━━━━')
  let buf = ''
  for (const b of blocks) {
    const candidate = buf ? `${buf}━━━━━━━━${b}` : b
    if (candidate.length > limit && buf) {
      parts.push(buf)
      buf = `━━━━━━━━${b}`
    } else {
      buf = candidate
    }
  }
  if (buf) parts.push(buf)
  return parts
}

// ─── main ───────────────────────────────────────────────────────────

async function run() {
  log('INFO', `starting · run_date=${RUN_DATE} · dryRun=${DRY_RUN}`)
  const dedupSet = await loadDedupSet()
  log('INFO', `dedup set: ${dedupSet.size} hashes from last ${DEDUP_DAYS} days`)

  const [google, dof, bridge] = await Promise.all([gatherGoogleNews(), gatherDof(), gatherBridgeAnomaly()])
  log('INFO', `sources: google=${google.length} dof=${dof.length} bridge=${bridge.length}`)

  const items = normalize([...google, ...dof, ...bridge])
  if (items.length === 0) throw new Error('no items gathered from any source')

  const scored = items.map((it) => preScore(it, dedupSet))
  const { ranked, cost: rankCost } = await rankWithHaiku(scored)

  const eligible = ranked.filter((it) => it.finalScore >= SCORE_THRESHOLD)
  const top = eligible.slice(0, 3)
  let note = 'Top 3 temas para LinkedIn'
  if (top.length === 0) {
    throw new Error('no items crossed the score threshold — suspicious, investigate sources')
  }
  if (top.length < 3) {
    note = `Solo ${top.length} tema${top.length === 1 ? '' : 's'} superó el umbral hoy`
  }

  const drafted = await Promise.all(top.map(draftOne))
  const draftCost = drafted.reduce((s, d) => s + (d.cost || 0), 0)
  const totalCost = rankCost + draftCost

  fs.mkdirSync(LOG_DIR, { recursive: true })
  const logFile = path.join(LOG_DIR, DRY_RUN ? `DRYRUN-${RUN_DATE}.md` : `${RUN_DATE}.md`)
  const md = renderMarkdown({ runDate: RUN_DATE, topRanked: top, drafts: drafted, allItems: ranked, dryRun: DRY_RUN, totalCost })
  fs.writeFileSync(logFile, md, 'utf8')
  log('INFO', `wrote ${logFile} (${md.length} bytes)`)

  const tgMsg = renderTelegramMessage({ runDate: RUN_DATE, topRanked: top, drafts: drafted, logPath: logFile, note })
  const parts = splitForTelegram(tgMsg)

  if (DRY_RUN) {
    log('INFO', `[dry-run] would send ${parts.length} Telegram part(s):\n${parts[0].slice(0, 400)}…`)
  } else {
    for (const p of parts) await sendTelegram(p)
    log('INFO', `sent ${parts.length} Telegram part(s)`)
  }

  if (!DRY_RUN) {
    const { error } = await supabase.from('content_intel_runs').upsert(
      {
        run_date: RUN_DATE,
        topic_hashes: top.map((it) => it.hash),
        top_3: drafted.map((d, i) => ({
          title: top[i].title,
          url: top[i].url,
          source: top[i].source,
          finalScore: top[i].finalScore,
          draft: d.draft,
          degraded: !!d.degraded,
        })),
        total_items_considered: items.length,
        cost_usd: Number(totalCost.toFixed(4)),
        log_path: path.relative(path.join(__dirname, '..'), logFile),
      },
      { onConflict: 'run_date' },
    )
    if (error) log('WARN', 'supabase upsert failed:', error.message)
  }

  return { rows_synced: top.length, cost_usd: totalCost, items_considered: items.length }
}

async function main() {
  try {
    const result = await withSyncLog(
      supabase,
      { sync_type: 'content_intel', company_id: null },
      run,
    )
    log('INFO', `done · top=${result.rows_synced} items=${result.items_considered} cost=$${result.cost_usd.toFixed(4)}`)
    process.exit(0)
  } catch (e) {
    log('ERROR', e.message)
    try {
      await sendTelegram(`🔴 <b>${SCRIPT_NAME}</b>: ${e.message}`)
    } catch {}
    process.exit(1)
  }
}

main()
