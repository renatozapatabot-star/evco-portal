// EXTERNAL-only prospect synthesizer
// Reads agent outputs from /tmp/prospect-engine/external/*.json
// Dedupes against /tmp/prospect-engine/phase1-existing-clients.json (existing clients)
// Emits ~/Desktop/prospects-EXTERNAL-only-YYYY-MM-DD.md
import fs from 'fs/promises'
import path from 'path'

const TODAY = '2026-04-19'
const SRC_DIR = '/tmp/prospect-engine/external'
const EXISTING = '/tmp/prospect-engine/phase1-existing-clients.json'
const OUT = path.join(process.env.HOME, 'Desktop', `prospects-EXTERNAL-only-${TODAY}.md`)

// ─── Normalize a Mexican company name for fuzzy dedupe ─────────────
function normalize(name = '') {
  return String(name)
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\bS\.?\s*A\.?\s*DE\s*C\.?\s*V\.?/g, '')
    .replace(/\bS\.?\s*DE\s*R\.?\s*L\.?\s*DE\s*C\.?\s*V\.?/g, '')
    .replace(/\bS\.?\s*DE\s*R\.?\s*L\.?/g, '')
    .replace(/\bS\.?\s*A\.?/g, '')
    .replace(/\bS\.?\s*C\.?/g, '')
    .replace(/\bDE\s*C\.?\s*V\.?/g, '')
    .replace(/[.,/\\&'"-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Token-based overlap for partial matches (e.g. "EVCO PLASTICS DE MEXICO" vs "EVCO Plastics")
function nameOverlap(a, b) {
  const ta = new Set(normalize(a).split(' ').filter(t => t.length > 2))
  const tb = new Set(normalize(b).split(' ').filter(t => t.length > 2))
  if (!ta.size || !tb.size) return 0
  let common = 0
  for (const t of ta) if (tb.has(t)) common++
  return common / Math.min(ta.size, tb.size)
}

// ─── Load existing clients (dedupe basis) ──────────────────────────
const existingRaw = JSON.parse(await fs.readFile(EXISTING, 'utf8'))
const existingNorm = existingRaw.clients.map(c => ({
  name: c.name, norm: normalize(c.name), tokens: normalize(c.name).split(' '),
}))
console.log(`Dedupe basis: ${existingNorm.length} existing clients loaded.`)

function isExistingClient(name) {
  const n = normalize(name)
  if (!n) return false
  // exact normalized match
  for (const e of existingNorm) {
    if (e.norm === n) return { match: e.name, score: 1.0 }
  }
  // strong token overlap (≥0.7) AND first significant token match
  for (const e of existingNorm) {
    const ovl = nameOverlap(name, e.name)
    if (ovl >= 0.7) return { match: e.name, score: ovl }
  }
  return false
}

// ─── Load + merge agent outputs ────────────────────────────────────
let agentFiles = []
try {
  agentFiles = (await fs.readdir(SRC_DIR)).filter(f => f.endsWith('.json'))
} catch { agentFiles = [] }

const allProspects = []
const blockedSources = []
const sourceCounts = {}

for (const f of agentFiles) {
  try {
    const raw = await fs.readFile(path.join(SRC_DIR, f), 'utf8')
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) continue
    for (const p of arr) {
      if (p.razon_social === '__SOURCE_BLOCKED__' || p.razon_social === '__NO_PUBLIC_CLIENT_LIST__') {
        blockedSources.push({ file: f, ...p })
        continue
      }
      if (!p.razon_social) continue
      // Agent file → source bucket
      const bucket = f.replace('ext-', '').replace('.json', '')
      sourceCounts[bucket] = (sourceCounts[bucket] || 0) + 1
      allProspects.push({ ...p, _agent_file: f, _bucket: bucket })
    }
  } catch (e) { console.warn(`Skipped ${f}: ${e.message}`) }
}
console.log(`Loaded ${allProspects.length} raw prospects from ${agentFiles.length} agent files.`)
console.log(`Blocked source notes: ${blockedSources.length}`)

// ─── Dedupe: against existing clients + within external set ────────
const seenNorm = new Map()  // normName → first prospect
const droppedAsExisting = []
const droppedAsDuplicate = []
const kept = []

for (const p of allProspects) {
  const exist = isExistingClient(p.razon_social)
  if (exist) {
    droppedAsExisting.push({ ...p, _matched: exist.match, _score: exist.score })
    continue
  }
  const n = normalize(p.razon_social)
  if (!n) continue
  if (seenNorm.has(n)) {
    // merge: combine sources
    const orig = seenNorm.get(n)
    if (!orig._merged_from) orig._merged_from = []
    orig._merged_from.push({ source: p.source, source_category: p.source_category })
    if (!orig.contact?.website && p.contact?.website) orig.contact = { ...orig.contact, ...p.contact }
    droppedAsDuplicate.push(p)
    continue
  }
  seenNorm.set(n, p)
  kept.push(p)
}

console.log(`After dedupe: kept=${kept.length}, dropped_existing=${droppedAsExisting.length}, dropped_dup=${droppedAsDuplicate.length}`)

// ─── Rank: warmth × volume hint ────────────────────────────────────
const VOLUME_WEIGHT = { high: 3, medium: 2, low: 1, unknown: 1.2 }
function rankScore(p) {
  const w = Number(p.warmth_score) || 5
  const v = VOLUME_WEIGHT[String(p.estimated_volume).toLowerCase()] || 1
  // bonus for Tamps (Aduana 240 catchment)
  const stateBonus = String(p.state).toLowerCase().includes('tamaulipas') ? 1.4
                   : String(p.state).toLowerCase().includes('nuevo le') ? 1.2
                   : String(p.state).toLowerCase().includes('coahuila') ? 1.1
                   : 1.0
  // bonus for named decision maker
  const dmBonus = p.decision_maker ? 1.15 : 1.0
  return w * v * stateBonus * dmBonus
}
kept.forEach(p => { p._rank_score = rankScore(p) })
kept.sort((a, b) => b._rank_score - a._rank_score)

// ─── Markdown output ───────────────────────────────────────────────
const fmt = n => (n ? Number(n).toLocaleString('en-US') : '—')
const cell = v => (v === undefined || v === null || v === '' ? '—' : String(v).replace(/\|/g, '\\|'))

function row(p, i) {
  const c = p.contact || {}
  const contact = [c.website, c.phone, c.linkedin, c.email].filter(Boolean).join(' · ') || '—'
  const inv = p.investment_usd ? `$${fmt(p.investment_usd)}` : ''
  return `### ${i + 1}. ${p.razon_social}  \`EXTERNAL · ${p.source_category || p._bucket}\`
- **source_type:** EXTERNAL
- **Industria:** ${cell(p.industry)} ${p.parent_country ? `· parent ${p.parent_country}` : ''}
- **Ubicación:** ${cell(p.city)}, ${cell(p.state)} ${p.park ? `· ${p.park}` : ''}
- **Volumen estimado:** ${cell(p.estimated_volume)} · **warmth ${p.warmth_score ?? '?'}/10** · rank ${p._rank_score.toFixed(2)}
- **Decision maker:** ${cell(p.decision_maker)}
- **Contacto:** ${contact}
- **Por qué encaja:** ${cell(p.why_fit)}
- **Fuente:** ${cell(p.source)}
${p.current_broker ? `- **Broker actual:** ${cell(p.current_broker)} _(winnable account)_` : ''}
${p.investment_usd ? `- **Inversión:** ${inv} USD${p.announcement_date ? ` · anunciado ${p.announcement_date}` : ''}${p.operational_date ? ` · operativo ${p.operational_date}` : ''}` : ''}
${p.language_preference ? `- **Idioma de venta:** ${p.language_preference}` : ''}
${p.notes ? `- **Notas:** ${p.notes}` : ''}
${p._merged_from ? `- **También en:** ${p._merged_from.map(m => m.source_category || m.source).join(', ')}` : ''}
`
}

function table(arr, n = 20) {
  const rows = arr.slice(0, n).map((p, i) => `| ${i+1} | ${cell(p.razon_social).slice(0, 40)} | ${cell(p.industry).slice(0, 22)} | ${cell(p.state).slice(0, 13)} | ${cell(p.estimated_volume)} | ${p.warmth_score ?? '?'} | ${p._rank_score.toFixed(1)} | ${cell(p._bucket)} |`).join('\n')
  return `| # | Empresa | Industria | Estado | Vol | Warm | Rank | Bucket |
|---|---|---|---|---|---|---|---|
${rows}`
}

const summaryByBucket = Object.entries(sourceCounts).map(([k,v]) => `- **${k}**: ${v} raw`).join('\n')
const blockedMD = blockedSources.length
  ? blockedSources.map(b => `- \`${b.file}\` · ${b.source} — ${b.notes}`).join('\n')
  : '_None — all attempted sources returned data._'

const md = `# PROSPECTS · EXTERNAL ONLY · ${TODAY}

**Source filter:** EXTERNAL only. Internal data (Supabase, GlobalPC, traficos, entradas, facturas, companies) was NOT queried in this pass. Phase 1 explicitly skipped per instruction.

**Dedupe basis:** ${existingNorm.length} existing clients loaded from prior internal pass; any external prospect whose normalized name matches an existing client (token overlap ≥ 0.7) was dropped.

**Tally:**
- Raw prospects collected: **${allProspects.length}** across ${agentFiles.length} agent files
- Dropped as existing client (dedupe): **${droppedAsExisting.length}**
- Dropped as duplicate within external set: **${droppedAsDuplicate.length}**
- **Kept (truly external + unique): ${kept.length}**
- Blocked sources noted: ${blockedSources.length}

**By source bucket:**
${summaryByBucket}

---

## TOP 20 EXTERNAL PROSPECTS — quick table

${table(kept, 20)}

---

## TOP 50 EXTERNAL PROSPECTS — full detail

${kept.slice(0, 50).map(row).join('\n')}

---

## Remaining (51-${kept.length})

${kept.slice(50).map((p, i) => `- **${i+51}.** ${p.razon_social} — ${cell(p.industry)} · ${cell(p.state)} · warmth ${p.warmth_score ?? '?'} · ${cell(p._bucket)} · ${cell(p.source)}`).join('\n')}

---

## Dropped as existing client (verify dedupe is right)

${droppedAsExisting.length === 0 ? '_None._' : droppedAsExisting.map(p => `- **${p.razon_social}** matched existing client _"${p._matched}"_ (score ${p._score.toFixed(2)}) · from ${p._bucket}`).join('\n')}

---

## Blocked / unavailable sources

${blockedMD}

---

## Ranking methodology

\`rank_score = warmth_score × volume_weight × state_bonus × decision_maker_bonus\`

- volume_weight: high=3, medium=2, low=1, unknown=1.2
- state_bonus: Tamaulipas=1.4 (Aduana 240 catchment), Nuevo León=1.2, Coahuila=1.1, other=1.0
- decision_maker_bonus: 1.15 if a named contact exists, else 1.0

---

*EXTERNAL-only pipeline · 2026-04-19 · prospect-engine v1.1*
*Patente 3596 · Aduana 240 · Laredo TX · Est. 1941*
`

await fs.writeFile(OUT, md, 'utf8')
console.log(`\n✓ ${OUT}`)
console.log(`  Kept: ${kept.length} truly-external prospects`)

// Print top 20 inline for the operator
console.log(`\n=== TOP 20 EXTERNAL PROSPECTS ===\n`)
kept.slice(0, 20).forEach((p, i) => {
  console.log(`${i+1}. ${p.razon_social} [${p._bucket}]`)
  console.log(`   ${p.industry || '?'} · ${p.city || '?'}, ${p.state || '?'} · vol ${p.estimated_volume || '?'} · warmth ${p.warmth_score ?? '?'}/10 · rank ${p._rank_score.toFixed(2)}`)
  console.log(`   why: ${p.why_fit || '—'}`)
  if (p.decision_maker) console.log(`   dm: ${p.decision_maker}`)
  if (p.current_broker) console.log(`   currently with: ${p.current_broker}`)
  console.log()
})
