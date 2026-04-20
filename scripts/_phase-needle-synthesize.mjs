// NEEDLE prospect synthesizer
// Reads /tmp/prospect-engine/needle/*.json
// Dedupes against:
//   1. Existing 293 clients (phase1-existing-clients.json)
//   2. The 305 external prospects from the prior pass (/tmp/prospect-engine/external/*.json)
// Sorts: ascending obviousness, then descending volume
// Emits ~/Desktop/prospects-NEEDLE-YYYY-MM-DD.md + prints top 30 inline

import fs from 'fs/promises'
import path from 'path'

const TODAY = '2026-04-19'
const NEEDLE_DIR = '/tmp/prospect-engine/needle'
const EXTERNAL_DIR = '/tmp/prospect-engine/external'
const EXISTING = '/tmp/prospect-engine/phase1-existing-clients.json'
const OUT = path.join(process.env.HOME, 'Desktop', `prospects-NEEDLE-${TODAY}.md`)

// ─── Normalize a name (Mexican + US legal-suffix-aware) ────────────
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
    .replace(/\bL\.?L\.?C\.?\b/g, '')
    .replace(/\bINC\.?\b/g, '')
    .replace(/\bCORP\.?\b/g, '')
    .replace(/\bLTD\.?\b/g, '')
    .replace(/\bL\.?P\.?\b/g, '')
    .replace(/[.,/\\&'"-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenOverlap(a, b) {
  const ta = new Set(normalize(a).split(' ').filter(t => t.length > 2))
  const tb = new Set(normalize(b).split(' ').filter(t => t.length > 2))
  if (!ta.size || !tb.size) return 0
  let common = 0
  for (const t of ta) if (tb.has(t)) common++
  return common / Math.min(ta.size, tb.size)
}

// ─── Load dedupe basis: internal clients + prior external prospects ──
const existing = JSON.parse(await fs.readFile(EXISTING, 'utf8'))
const internalNorm = existing.clients.map(c => ({
  name: c.name, source: 'INTERNAL', norm: normalize(c.name),
}))

let externalNorm = []
try {
  const extFiles = (await fs.readdir(EXTERNAL_DIR)).filter(f => f.endsWith('.json') && f.startsWith('ext-'))
  for (const f of extFiles) {
    try {
      const arr = JSON.parse(await fs.readFile(path.join(EXTERNAL_DIR, f), 'utf8'))
      if (!Array.isArray(arr)) continue
      for (const p of arr) {
        if (!p?.razon_social || p.razon_social.startsWith('__')) continue
        externalNorm.push({ name: p.razon_social, source: `EXTERNAL:${f}`, norm: normalize(p.razon_social) })
      }
    } catch {}
  }
} catch {}

const dedupeBasis = [...internalNorm, ...externalNorm]
console.log(`Dedupe basis: ${internalNorm.length} internal + ${externalNorm.length} external = ${dedupeBasis.length} total names.`)

function isDuplicate(name) {
  const n = normalize(name)
  if (!n) return null
  for (const e of dedupeBasis) {
    if (e.norm === n) return { match: e.name, source: e.source, score: 1.0 }
  }
  for (const e of dedupeBasis) {
    if (Math.abs(e.norm.length - n.length) > 30) continue
    const ovl = tokenOverlap(name, e.name)
    if (ovl >= 0.75) return { match: e.name, source: e.source, score: ovl }
  }
  return null
}

// ─── Load needle agent outputs ─────────────────────────────────────
let needleFiles = []
try { needleFiles = (await fs.readdir(NEEDLE_DIR)).filter(f => f.endsWith('.json')) } catch {}

const allNeedles = []
const blockedNotes = []
const bucketCounts = {}

for (const f of needleFiles) {
  try {
    const arr = JSON.parse(await fs.readFile(path.join(NEEDLE_DIR, f), 'utf8'))
    if (!Array.isArray(arr)) continue
    for (const p of arr) {
      if (!p?.razon_social) continue
      if (p.razon_social.startsWith('__')) {
        blockedNotes.push({ file: f, ...p })
        continue
      }
      const bucket = f.replace('ext-needle-', '').replace('.json', '')
      bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1
      allNeedles.push({ ...p, _agent_file: f, _bucket: bucket })
    }
  } catch (e) { console.warn(`Skipped ${f}: ${e.message}`) }
}

console.log(`Loaded ${allNeedles.length} raw needles from ${needleFiles.length} files.`)

// ─── Dedupe ─────────────────────────────────────────────────────────
const seen = new Map()
const droppedAsDup = []
const droppedAsExisting = []
const droppedAsExternal = []
const channelPartners = []  // freight forwarders kept separately
const kept = []

for (const p of allNeedles) {
  if (p.is_freight_forwarder === true || p.is_freight_forwarder === 'true') {
    channelPartners.push(p)
    continue
  }
  const dup = isDuplicate(p.razon_social)
  if (dup) {
    if (dup.source === 'INTERNAL') droppedAsExisting.push({ ...p, _matched: dup.match, _score: dup.score })
    else droppedAsExternal.push({ ...p, _matched: dup.match, _source_match: dup.source, _score: dup.score })
    continue
  }
  const n = normalize(p.razon_social)
  if (!n) continue
  if (seen.has(n)) {
    const orig = seen.get(n)
    if (!orig._merged) orig._merged = []
    orig._merged.push({ source: p.source, source_category: p.source_category, bucket: p._bucket })
    droppedAsDup.push(p)
    continue
  }
  seen.set(n, p)
  kept.push(p)
}

console.log(`After dedupe: kept=${kept.length}, channel_partners=${channelPartners.length}, dropped_existing=${droppedAsExisting.length}, dropped_external=${droppedAsExternal.length}, dropped_dup=${droppedAsDup.length}`)

// ─── Sort: ascending obviousness (1 first), then descending volume ──
const VOLUME_RANK = { high: 3, medium: 2, low: 1, unknown: 0 }
function sortKey(a, b) {
  const oa = Number(a.obviousness) || 5
  const ob = Number(b.obviousness) || 5
  if (oa !== ob) return oa - ob  // 1 (invisible) first
  const va = VOLUME_RANK[String(a.estimated_volume).toLowerCase()] ?? 0
  const vb = VOLUME_RANK[String(b.estimated_volume).toLowerCase()] ?? 0
  if (va !== vb) return vb - va  // high first
  // tie-break: niche moat
  return (Number(b.niche_moat) || 0) - (Number(a.niche_moat) || 0)
}
kept.sort(sortKey)

// ─── Markdown row + table builders ─────────────────────────────────
const cell = v => (v === undefined || v === null || v === '' ? '—' : String(v).replace(/\|/g, '\\|').replace(/\n/g, ' '))
function pedRange(p) {
  if (p.estimated_monthly_pedimentos) return String(p.estimated_monthly_pedimentos)
  if (p.estimated_volume === 'high') return '8-30/mo'
  if (p.estimated_volume === 'medium') return '3-8/mo'
  if (p.estimated_volume === 'low') return '1-3/mo'
  return '?'
}
function contactString(p) {
  const c = p.contact || {}
  return [c.phone, c.email, c.website].filter(Boolean).join(' · ') || (p.contact_path || '—')
}

function row(p, i) {
  const merged = p._merged ? `\n- **También visto en:** ${p._merged.map(m => m.source_category || m.bucket).join(', ')}` : ''
  return `### ${i + 1}. ${p.razon_social}  \`obviousness ${p.obviousness ?? '?'}/5 · vol ${p.estimated_volume ?? '?'}\`
- **Niche:** ${cell(p.niche)}
- **Address:** ${cell(p.address)}, ${cell(p.city)}${p.state ? ', ' + p.state : ''}${p.zone ? ` (${p.zone})` : ''}${p.colonia ? ` · ${p.colonia}` : ''}
- **Source:** ${cell(p.source_category)} · ${cell(p.source)}
- **Estimated pedimentos:** ${pedRange(p)} · vol ${cell(p.estimated_volume)} · niche moat ${p.niche_moat ?? '?'}/5
- **Contact:** ${contactString(p)}
- **Contactability:** ${cell(p.contactability)}
- **Why this is a needle:** ${cell(p.why_needle)}
${p.landlord ? `- **Landlord (warm-intro):** ${cell(p.landlord)}` : ''}
${p.notes ? `- **Notes:** ${cell(p.notes)}` : ''}${merged}
`
}

function inlineTableRow(p, i) {
  return `| ${i+1} | ${cell(p.razon_social).slice(0, 38)} | ${cell(p.niche).slice(0, 28)} | ${cell(p.city)} | ${p.obviousness ?? '?'} | ${cell(p.estimated_volume)} | ${pedRange(p)} | ${cell(p.contactability)} | ${cell(p._bucket)} |`
}

const inlineTable = kept.slice(0, 30).map(inlineTableRow).join('\n')
const fullDetail = kept.slice(0, 100).map(row).join('\n')
const remaining = kept.slice(100).map((p, i) =>
  `- **${i+101}.** ${p.razon_social} · obv ${p.obviousness ?? '?'} · vol ${p.estimated_volume ?? '?'} · ${cell(p.niche)} · ${cell(p.city)} · ${cell(p._bucket)}`
).join('\n')

const channelMD = channelPartners.length === 0 ? '_None flagged this run._' :
  channelPartners.map((p, i) =>
    `### ${i+1}. ${p.razon_social}  \`CHANNEL PARTNER · freight forwarder\`
- **Niche:** ${cell(p.niche)}
- **City:** ${cell(p.city)}, ${cell(p.state)}
- **Why partner:** ${cell(p.why_needle)}
- **Contact:** ${contactString(p)}
- **Notes:** ${cell(p.notes)}
`).join('\n')

const obvDist = kept.reduce((acc, p) => {
  const o = String(p.obviousness ?? '?')
  acc[o] = (acc[o] || 0) + 1
  return acc
}, {})
const obvDistStr = Object.entries(obvDist).sort().map(([k, v]) => `${k}: ${v}`).join(' · ')

const blockedMD = blockedNotes.length === 0 ? '_None — all attempted sources returned data._' :
  blockedNotes.map(b => `- \`${b.file}\` · ${b.source} — ${b.notes}`).join('\n')

const md = `# PROSPECTS · NEEDLES · ${TODAY}

**Mission:** find INVISIBLE small-to-mid Laredo / Nuevo Laredo importers. The shape: $5M-$50M revenue, 15-80 pedimentos/year, 1-2 owners, no marketing, no headlines. The kind of operator who rents a warehouse, makes good money, and never hits a press release.

**Sort order:** ascending obviousness (most invisible first — 1s before 2s before 3s), then descending estimated volume within each tier.

**Source filter:** EXTERNAL only. No internal Supabase / GlobalPC queries.

**Dedupe basis:** ${internalNorm.length} internal clients + ${externalNorm.length} prior external prospects = ${dedupeBasis.length} known names. Token-overlap threshold ≥ 0.75.

## Tally

- Raw needles collected: **${allNeedles.length}** across ${needleFiles.length} agent files
- Dropped as existing internal client: **${droppedAsExisting.length}**
- Dropped as already-known external prospect: **${droppedAsExternal.length}**
- Dropped as cross-agent duplicate: **${droppedAsDup.length}**
- Channel partners (freight forwarders) flagged separately: **${channelPartners.length}**
- **Kept (truly NEW + UNIQUE needles): ${kept.length}**
- Blocked source notes: ${blockedNotes.length}

**Obviousness distribution:** ${obvDistStr}

**By source bucket:**
${Object.entries(bucketCounts).map(([k, v]) => `- **${k}:** ${v} raw`).join('\n')}

---

## TOP 30 NEEDLES — quick table (sorted: invisible-first, then by volume)

| # | Razón social | Niche | City | Obv | Vol | Est ped/mo | Contactability | Bucket |
|---|---|---|---|---|---|---|---|---|
${inlineTable}

---

## TOP 100 NEEDLES — full detail

${fullDetail}

${kept.length > 100 ? `---\n\n## Remaining (101-${kept.length})\n\n${remaining}\n` : ''}

---

## Channel partners — small freight forwarders (NOT direct prospects)

These are freight forwarders / small operators whose existing client Rolodex contains likely needle importers. Treat as referral/partnership opportunities, not as direct sales targets.

${channelMD}

---

## Dropped as existing internal client

${droppedAsExisting.length === 0 ? '_None._' : droppedAsExisting.map(p => `- **${p.razon_social}** matched _"${p._matched}"_ (score ${p._score.toFixed(2)}) · from ${p._bucket}`).join('\n')}

---

## Dropped as already-known external prospect

${droppedAsExternal.length === 0 ? '_None._' : droppedAsExternal.map(p => `- **${p.razon_social}** matched _"${p._matched}"_ (score ${p._score.toFixed(2)}) · from ${p._bucket} · prior source: ${p._source_match}`).join('\n')}

---

## Blocked / unavailable sources

${blockedMD}

---

## Methodology

For every prospect:
- **OBVIOUSNESS (1-5):** 1 = invisible (only in public registry, no website, no social); 5 = press releases & headline coverage. We chose 1s and 2s; skipped 4s and 5s.
- **ESTIMATED VOLUME:** low = 1-3 pedimentos/mo · medium = 3-8 · high = 8-30+
- **CONTACTABILITY:** high = public phone in registry · medium = drive-by or general number · low = no findable contact
- **NICHE MOAT (1-5):** 5 = once landed, the relationship is sticky (specialty knowledge required, regulatory complexity, language match, family-business loyalty)

**Sort:** ascending obviousness (most invisible first), then descending volume within each obviousness tier, then descending niche moat as tie-breaker.

---

*NEEDLE-only pipeline · 2026-04-19 · prospect-engine v1.2*
*Patente 3596 · Aduana 240 · Laredo TX · Est. 1941*
`

await fs.writeFile(OUT, md, 'utf8')
console.log(`\n✓ ${OUT}`)
console.log(`  Kept: ${kept.length} truly-new needle prospects`)

// Print top 30 inline
console.log(`\n=== TOP 30 NEEDLES (invisible-first) ===\n`)
kept.slice(0, 30).forEach((p, i) => {
  console.log(`${i+1}. [obv ${p.obviousness ?? '?'}/5 · vol ${p.estimated_volume ?? '?'}] ${p.razon_social}`)
  console.log(`   ${p.niche || '?'} · ${p.address || '?'}, ${p.city || '?'} · est ${pedRange(p)} · contact ${p.contactability || '?'}`)
  console.log(`   why: ${p.why_needle || '—'}`)
  if (p.landlord) console.log(`   landlord (warm intro): ${p.landlord}`)
  if (p.notes) console.log(`   notes: ${String(p.notes).slice(0, 140)}`)
  console.log()
})
