// SCORE-ALL · would-they-take-the-call ranking across all 721 prospects
// Loads: existing clients + external prospects + needles
// Global dedupe → score 1-10 → recommended_action → MD output + top-40 inline

import fs from 'fs/promises'
import path from 'path'

const TODAY = '2026-04-19'
const EXISTING = '/tmp/prospect-engine/phase1-existing-clients.json'
const EXTERNAL_DIR = '/tmp/prospect-engine/external'
const NEEDLE_DIR = '/tmp/prospect-engine/needle'
const OUT = path.join(process.env.HOME, 'Desktop', `prospects-SCORED-${TODAY}.md`)

// ─── Normalization (same as prior synthesizers) ────────────────────
function normalize(name = '') {
  return String(name).toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\bS\.?\s*A\.?\s*DE\s*C\.?\s*V\.?/g, '')
    .replace(/\bS\.?\s*DE\s*R\.?\s*L\.?\s*DE\s*C\.?\s*V\.?/g, '')
    .replace(/\bS\.?\s*DE\s*R\.?\s*L\.?/g, '')
    .replace(/\bS\.?\s*A\.?/g, '').replace(/\bS\.?\s*C\.?/g, '')
    .replace(/\bDE\s*C\.?\s*V\.?/g, '')
    .replace(/\bL\.?L\.?C\.?\b/g, '').replace(/\bINC\.?\b/g, '').replace(/\bCORP\.?\b/g, '')
    .replace(/\bLTD\.?\b/g, '').replace(/\bL\.?P\.?\b/g, '')
    .replace(/[.,/\\&'"-]/g, ' ').replace(/\s+/g, ' ').trim()
}
function tokenOverlap(a, b) {
  const ta = new Set(normalize(a).split(' ').filter(t => t.length > 2))
  const tb = new Set(normalize(b).split(' ').filter(t => t.length > 2))
  if (!ta.size || !tb.size) return 0
  let common = 0
  for (const t of ta) if (tb.has(t)) common++
  return common / Math.min(ta.size, tb.size)
}

// ─── Load all sources, normalize into common shape ─────────────────
const allRaw = []

// 1) Existing clients (reactivation candidates — top 100 only by priority)
const existing = JSON.parse(await fs.readFile(EXISTING, 'utf8'))
for (const c of existing.clients.slice(0, 100)) {
  allRaw.push({
    razon_social: c.name,
    rfc: c.rfc, clave: c.clave,
    industry: '?', city: '?', state: '?',
    contact: { phone: c.contact_phone || '', email: c.contact_email || '', website: '' },
    decision_maker: c.contact_name || null,
    estimated_volume: c.annual_pace > 60 ? 'high' : c.annual_pace > 15 ? 'medium' : 'low',
    estimated_monthly_pedimentos: c.annual_pace ? Math.round(c.annual_pace / 12 * 10) / 10 : null,
    source: 'internal: prior client relationship',
    source_category: 'EXISTING_CLIENT',
    source_type: 'INTERNAL',
    _origin: 'existing',
    _existing: {
      days_silent: c.days_silent,
      total_traficos: c.total_traficos,
      annual_pace: c.annual_pace,
      trajectory: c.trajectory,
      last_cruce: c.last_cruce,
      revenue_at_risk_usd: c.revenue_at_risk_usd,
      historical_annual_revenue_usd: c.historical_annual_revenue_usd,
      reactivation_probability: c.reactivation_probability,
      active: c.active,
    },
  })
}
console.log(`Loaded ${allRaw.length} existing-client reactivation candidates.`)

// 2) External prospects
let extCount = 0
for (const f of (await fs.readdir(EXTERNAL_DIR)).filter(f => f.endsWith('.json') && f.startsWith('ext-'))) {
  try {
    const arr = JSON.parse(await fs.readFile(path.join(EXTERNAL_DIR, f), 'utf8'))
    if (!Array.isArray(arr)) continue
    for (const p of arr) {
      if (!p?.razon_social || p.razon_social.startsWith('__')) continue
      allRaw.push({ ...p, _origin: 'external', _bucket: f.replace('ext-', '').replace('.json', '') })
      extCount++
    }
  } catch {}
}
console.log(`Loaded ${extCount} external prospects.`)

// 3) Needles + channel partners
let needleCount = 0, partnerCount = 0
for (const f of (await fs.readdir(NEEDLE_DIR)).filter(f => f.endsWith('.json'))) {
  try {
    const arr = JSON.parse(await fs.readFile(path.join(NEEDLE_DIR, f), 'utf8'))
    if (!Array.isArray(arr)) continue
    for (const p of arr) {
      if (!p?.razon_social || p.razon_social.startsWith('__')) continue
      const isPartner = p.is_freight_forwarder === true || p.is_freight_forwarder === 'true'
      allRaw.push({
        ...p,
        _origin: isPartner ? 'channel_partner' : 'needle',
        _bucket: f.replace('ext-needle-', '').replace('.json', '')
      })
      if (isPartner) partnerCount++; else needleCount++;
    }
  } catch {}
}
console.log(`Loaded ${needleCount} needles + ${partnerCount} channel partners.`)
console.log(`Total raw: ${allRaw.length}`)

// ─── Global dedupe (keep highest-data-quality version when names collide) ──
const seen = new Map()
const dropped = []
for (const p of allRaw) {
  const n = normalize(p.razon_social)
  if (!n) continue
  if (seen.has(n)) {
    // Prefer richer record (more contact fields)
    const existing = seen.get(n)
    const existingScore = (existing.contact?.phone ? 1 : 0) + (existing.contact?.email ? 1 : 0) + (existing.decision_maker ? 1 : 0)
    const newScore = (p.contact?.phone ? 1 : 0) + (p.contact?.email ? 1 : 0) + (p.decision_maker ? 1 : 0)
    if (newScore > existingScore) {
      if (!p._merged_from) p._merged_from = []
      p._merged_from.push({ origin: existing._origin, bucket: existing._bucket })
      seen.set(n, p)
      dropped.push(existing)
    } else {
      if (!existing._merged_from) existing._merged_from = []
      existing._merged_from.push({ origin: p._origin, bucket: p._bucket })
      dropped.push(p)
    }
    continue
  }
  // Soft-match against existing keys (token overlap ≥ 0.85 — stricter than prior runs)
  let softMatched = false
  for (const [k, v] of seen) {
    if (Math.abs(k.length - n.length) > 25) continue
    if (tokenOverlap(p.razon_social, v.razon_social) >= 0.85) {
      if (!v._merged_from) v._merged_from = []
      v._merged_from.push({ origin: p._origin, bucket: p._bucket, name: p.razon_social })
      dropped.push(p)
      softMatched = true
      break
    }
  }
  if (softMatched) continue
  seen.set(n, p)
}
const unique = [...seen.values()]
console.log(`After global dedupe: ${unique.length} unique prospects (dropped ${dropped.length})`)

// ─── SCORING — 1 to 10, would-they-take-the-call ───────────────────
const FORTUNE500_PATTERN = /\b(BYD|TESLA|FOXCONN|GM|GENERAL MOTORS|FORD|STELLANTIS|KIA|HYUNDAI|TOYOTA|HONDA|NISSAN|VOLKSWAGEN|VW|MAGNA|BOMBARDIER|LG|SAMSUNG|HISENSE|LEGO|CATERPILLAR|HONEYWELL|WHIRLPOOL|3M|JOHN DEERE|EATON|EMERSON|ABB|SIEMENS|BOSCH|DENSO|YAZAKI|SUMITOMO|FAURECIA|APTIV|DELPHI|VALEO|JCB|LENOVO|FOXCONN|QUANTA|PEGATRON|WIWYNN|CHERY|GEELY|GWM|TRINA|LGMG|MEDLINE|KONGSBERG|MODINE|INTRETECH|XUSHENG|MAN WAH|SUPRAJIT|VELVAC|BIMBO|PEPSICO|COPPEL|CINEPOLIS|CINÉPOLIS|FEMSA|NESTLE|UNILEVER|PROCTER|DUPONT|3M|EXXON|CHEVRON)\b/i
const MULTINATIONAL_BROKER = /\b(DSV|SCHENKER|UPS|FEDEX|KUEHNE|MAERSK|DHL|EXPEDITORS|CH ROBINSON|XPO|RYDER)\b/i
const NICHE_FIT = /\b(IMMEX|MAQUILA|MAQUILADORA|AUTOMOTIVE|AUTOPARTES|STEEL|ACERO|FOOD|PRODUCE|ALIMENTOS|ELECTRONIC|ELECTRÓNICA|TEXTILE|TEXTIL|PLASTIC|PLÁSTICOS|CHEMICAL|QUÍMICA|FERRETERÍA|REFACCIONES|EQUIPMENT|EQUIPO|HVAC|REFRIGERATION|CHARCOAL|TILE|FURNITURE)\b/i

function scoreProspect(p) {
  let s = 5
  const reasons = []

  const c = p.contact || {}
  const state = String(p.state || '').toLowerCase()
  const city = String(p.city || '').toLowerCase()
  const niche = String(p.niche || p.industry || '').toLowerCase()
  const notes = (String(p.notes || '') + ' ' + String(p.why_fit || '') + ' ' + String(p.why_needle || '')).toLowerCase()
  const isExisting = p._origin === 'existing'
  const isNeedle = p._origin === 'needle'
  const isPartner = p._origin === 'channel_partner'

  // ─── EXISTING CLIENT path ────────────────────────────────────────
  if (isExisting) {
    s = 6.5  // baseline higher — they know us
    const e = p._existing || {}
    const ds = e.days_silent
    if (ds === null || ds === undefined) { /* unknown */ }
    else if (ds < 30) { s += 1.5; reasons.push(`active <30d`) }
    else if (ds < 90) { s += 1.2; reasons.push(`recent ${ds}d silent`) }
    else if (ds < 180) { s += 0.8; reasons.push(`hot iron ${ds}d`) }
    else if (ds < 365) { s += 0.0; reasons.push(`${Math.round(ds/30)}mo silent`) }
    else if (ds < 730) { s -= 1.0; reasons.push(`>1y dormant`) }
    else { s -= 2.0; reasons.push(`>2y gone`) }
    if (e.revenue_at_risk_usd > 5000) { s += 1.0; reasons.push(`RAR $${e.revenue_at_risk_usd.toLocaleString()}`) }
    else if (e.revenue_at_risk_usd > 2000) { s += 0.5 }
    if (e.trajectory === 'GROWING' || e.trajectory === 'STARTED') { s += 0.5; reasons.push(e.trajectory.toLowerCase()) }
    if (e.trajectory === 'DECLINING' || e.trajectory === 'STOPPED') { s -= 0.3 }
    if (p.decision_maker) { s += 0.5; reasons.push('named contact') }
    else { s -= 0.5; reasons.push('no named contact') }
    if (c.phone || c.email) { s += 0.3 }
  }

  // ─── EXTERNAL prospect path ──────────────────────────────────────
  else if (!isPartner) {
    // FIT — geographic
    if (city.includes('laredo') || city.includes('nuevo laredo')) { s += 1.5; reasons.push('Laredo metro') }
    else if (state.includes('tamaulipas')) { s += 1.0; reasons.push('Tamps') }
    else if (state.includes('nuevo le')) { s += 0.5; reasons.push('NL') }
    else if (state.includes('coahuila')) { s += 0.3; reasons.push('Coah') }
    else if (state) { s -= 0.5; reasons.push(`outside corridor`) }

    // FIT — size (Fortune 500 penalty)
    if (FORTUNE500_PATTERN.test(p.razon_social)) {
      s -= 2.0; reasons.push('mega-corp lock-in')
    }
    if (p.investment_usd) {
      const inv = Number(p.investment_usd)
      if (inv > 500_000_000) { s -= 1.5; reasons.push('$500M+ project=enterprise broker') }
      else if (inv > 100_000_000) { s -= 0.7; reasons.push('$100M+ project') }
      else if (inv > 30_000_000 && inv < 100_000_000) { s += 0.3; reasons.push('$30-100M sweet spot') }
    }

    // NEEDLE bonus
    if (isNeedle) {
      s += 1.5; reasons.push('needle (small-op fit)')
      if (Number(p.obviousness) <= 2) { s += 0.7; reasons.push(`obv ${p.obviousness}`) }
      if (Number(p.niche_moat) >= 4) { s += 0.4; reasons.push(`moat ${p.niche_moat}`) }
    }

    // FIT — niche
    if (NICHE_FIT.test(niche) || NICHE_FIT.test(notes)) { s += 0.4; reasons.push('niche match') }

    // LOCK-IN — current broker
    if (p.current_broker) {
      if (MULTINATIONAL_BROKER.test(p.current_broker)) { s -= 1.2; reasons.push(`MNC broker ${p.current_broker}`) }
      else { s -= 0.4; reasons.push(`local broker ${p.current_broker}`) }
    }

    // CONTACTABILITY
    if (c.phone) { s += 0.5; reasons.push('phone') }
    if (c.email) { s += 0.4; reasons.push('email') }
    if (p.decision_maker) { s += 0.7; reasons.push('DM named') }
    if (!c.phone && !c.email && !p.decision_maker) { s -= 0.7; reasons.push('no contact') }

    // SWITCH SIGNALS
    if (/successor|aging.broker|retiring|solo broker/i.test(notes)) { s += 1.2; reasons.push('aging-broker window') }
    if (/eelco|redwood|just acquired|recently acquired|m.?a window|displacement/i.test(notes)) { s += 1.0; reasons.push('M&A churn signal') }
    if (/broker selection|no broker.*announced|broker shopping|broker.*wide open|broker.*not.*locked|broker.*not.*announced|broker.*window.*now/i.test(notes)) { s += 0.8; reasons.push('broker window open') }
    if (/family.business|family.owned|surname/i.test(notes) || /hermanos|& sons|y cía/i.test(p.razon_social)) { s += 0.3; reasons.push('family-business fit') }
    if (/fortune.500|tier.1.*lock|enterprise.*broker|sap|oracle/i.test(notes)) { s -= 0.8; reasons.push('enterprise lock-in') }

    // VOLUME
    const v = String(p.estimated_volume).toLowerCase()
    if (v === 'high') s += 0.4
    else if (v === 'low') s -= 0.2

    // CONTACTABILITY field (needle-specific)
    if (p.contactability === 'high') s += 0.3
    else if (p.contactability === 'low') s -= 0.5

    // Warmth signals (external)
    if (Number(p.warmth_score) >= 9) { s += 0.4; reasons.push(`warmth ${p.warmth_score}`) }
    else if (Number(p.warmth_score) <= 4) { s -= 0.3 }
  }

  // ─── CHANNEL PARTNER path ────────────────────────────────────────
  else if (isPartner) {
    s = 6.5  // partners are valuable but a different motion
    reasons.push('channel partner — referral play, not sales call')
    if (/eelco|redwood|just acquired|displacement/i.test(notes)) { s += 1.2; reasons.push('M&A displacement opportunity') }
    if (/aaanl|sister|tito.*relationship|natural relationship/i.test(notes)) { s += 1.0; reasons.push('warm relationship') }
    if (c.phone || c.email) s += 0.5
  }

  // Final clamp
  s = Math.max(1, Math.min(10, Math.round(s * 10) / 10))

  // Recommended action
  let action = 'SKIP'
  if (s >= 9) action = 'CALL THIS WEEK'
  else if (s >= 7) action = 'RESEARCH AND CALL'
  else if (s >= 5) action = 'QUEUE FOR MONTH 2'
  else if (s >= 3) action = 'LOW PRIORITY'

  // Low-confidence flag: high score but ACTUAL data quality concern
  // For needles: no DM is normal — you ask on the call. Only flag if no contact channel at all.
  let lowConfidence = false
  const lowConfReasons = []
  if (s >= 7) {
    if (!c.phone && !c.email) { lowConfidence = true; lowConfReasons.push('no phone/email') }
    if (!isNeedle && !isExisting && !p.decision_maker) { lowConfidence = true; lowConfReasons.push('no DM (external — needs research)') }
    if (isNeedle && p.contactability === 'low' && !c.phone) {
      lowConfidence = true; lowConfReasons.push('invisible + no phone — drive-by recon first')
    }
    // Address looks like a generic-directory placeholder
    if (/TBD|tbd|specific # TBD|address needs.*recon/i.test(p.address || '')) {
      lowConfidence = true; lowConfReasons.push('address marked TBD')
    }
    // Same-address duplicate signal (could be the same op behind multiple names)
    if (/possibly same operator|likely same entity|verify/i.test(String(p.notes || ''))) {
      lowConfidence = true; lowConfReasons.push('possible alias of another listed op')
    }
  }

  return { score: s, reasoning: reasons.slice(0, 4).join(' · '), action, lowConfidence, lowConfReasons }
}

// Apply scoring
for (const p of unique) {
  const r = scoreProspect(p)
  Object.assign(p, r)
}

// Tie-break inside score band: named DM first, then phone/email, then high volume, then niche moat
function tieBreak(a, b) {
  const ad = (a.decision_maker ? 2 : 0) + ((a.contact?.phone || a.contact?.email) ? 1 : 0)
  const bd = (b.decision_maker ? 2 : 0) + ((b.contact?.phone || b.contact?.email) ? 1 : 0)
  if (ad !== bd) return bd - ad
  const av = { high: 3, medium: 2, low: 1 }[String(a.estimated_volume).toLowerCase()] || 0
  const bv = { high: 3, medium: 2, low: 1 }[String(b.estimated_volume).toLowerCase()] || 0
  if (av !== bv) return bv - av
  const am = Number(a.niche_moat) || 0, bm = Number(b.niche_moat) || 0
  if (am !== bm) return bm - am
  return (a.razon_social || '').localeCompare(b.razon_social || '')
}
unique.sort((a, b) => b.score - a.score || tieBreak(a, b))

// ─── Score distribution ────────────────────────────────────────────
const bands = { '9-10': 0, '7-8': 0, '5-6': 0, '3-4': 0, '1-2': 0 }
const bandsByOrigin = {}
for (const p of unique) {
  const b = p.score >= 9 ? '9-10' : p.score >= 7 ? '7-8' : p.score >= 5 ? '5-6' : p.score >= 3 ? '3-4' : '1-2'
  bands[b]++
  bandsByOrigin[p._origin] = bandsByOrigin[p._origin] || {}
  bandsByOrigin[p._origin][b] = (bandsByOrigin[p._origin][b] || 0) + 1
}

// ─── Sniff test: top 40 origin mix ─────────────────────────────────
const top40 = unique.slice(0, 40)
const top40Origin = top40.reduce((acc, p) => { acc[p._origin] = (acc[p._origin] || 0) + 1; return acc }, {})
const top40Fortune = top40.filter(p => FORTUNE500_PATTERN.test(p.razon_social))
console.log(`\nSniff test — top 40 origin mix:`, top40Origin)
console.log(`Top 40 Fortune-500 names: ${top40Fortune.length}`)
if (top40Fortune.length > 5) {
  console.warn(`⚠ SNIFF FAIL: ${top40Fortune.length} Fortune-500 names in top 40 — recheck scoring.`)
} else {
  console.log(`✓ Sniff pass: top 40 leans small/local.`)
}

// ─── Markdown output ───────────────────────────────────────────────
const cell = v => (v === undefined || v === null || v === '' ? '—' : String(v).replace(/\|/g, '\\|').replace(/\n/g, ' '))
function contactStr(p) {
  const c = p.contact || {}
  return [c.phone, c.email, c.website].filter(Boolean).join(' · ') || '—'
}
function compactRow(p, idx) {
  return `| ${idx+1} | ${p.score.toFixed(1)} | ${cell(p.razon_social).slice(0,42)} | ${cell(p._origin)} | ${cell(p.city || p.state).slice(0,18)} | ${cell(p.estimated_volume || '?').slice(0,6)} | ${cell(p.action)} | ${cell(p.reasoning).slice(0,55)} |`
}
function topCard(p, idx) {
  const merged = p._merged_from ? `\n- **También en:** ${p._merged_from.map(m => `${m.origin}/${m.bucket}`).join(', ')}` : ''
  const dm = p.decision_maker ? `**${p.decision_maker}**` : '_(no DM yet)_'
  const flag = p.lowConfidence ? `\n- ⚠ **LOW-CONFIDENCE FLAG:** ${p.lowConfReasons.join(', ')}` : ''
  const e = p._existing || {}
  const existingLine = p._origin === 'existing' ? `\n- **Historia:** ${e.total_traficos} tráficos · pace ${e.annual_pace}/y · silent ${e.days_silent}d · RAR $${e.revenue_at_risk_usd?.toLocaleString() || '—'}` : ''
  return `### ${idx+1}. ${p.razon_social}  \`${p.score.toFixed(1)}/10 · ${p.action}\`
- **Origin:** ${cell(p._origin)} · ${cell(p._bucket)}
- **Niche/industry:** ${cell(p.niche || p.industry)}
- **Location:** ${cell(p.city)}, ${cell(p.state)}${p.zone ? ` (${p.zone})` : ''}
- **Estimated volume:** ${cell(p.estimated_volume)}${p.estimated_monthly_pedimentos ? ` · ~${p.estimated_monthly_pedimentos}/mo` : ''}
- **Decision-maker:** ${dm}
- **Contact:** ${contactStr(p)}${existingLine}
- **Why this score:** ${p.reasoning || '—'}${flag}${merged}
`
}

const md = `# PROSPECTS · SCORED · ${TODAY}

**Mission:** rank all 721 prospects by "would they take the call?" likelihood.
Combined: ${unique.length} unique entries after global dedupe across existing-client reactivation list, headline-tier external prospects, and needle prospects.

**Scoring axes:**
- **FIT** — Laredo/NLD geographic flow, size match (small > Fortune 500), niche match, broker lock-in penalty
- **CONTACTABILITY** — phone, email, named DM, contactability tag
- **SWITCH LIKELIHOOD** — aging-broker windows, M&A churn signals, "broker not yet announced" cues, family-business signals

**Action mapping:**
- 9.0–10 → **CALL THIS WEEK**
- 7.0–8.9 → **RESEARCH AND CALL** (4 weeks)
- 5.0–6.9 → **QUEUE FOR MONTH 2**
- 3.0–4.9 → **LOW PRIORITY**
- 1.0–2.9 → **SKIP**

## Score distribution

| Band | Count | % |
|------|------:|--:|
| 9.0–10 (CALL THIS WEEK) | ${bands['9-10']} | ${(bands['9-10']/unique.length*100).toFixed(1)}% |
| 7.0–8.9 (RESEARCH+CALL) | ${bands['7-8']} | ${(bands['7-8']/unique.length*100).toFixed(1)}% |
| 5.0–6.9 (MONTH 2)       | ${bands['5-6']} | ${(bands['5-6']/unique.length*100).toFixed(1)}% |
| 3.0–4.9 (LOW)           | ${bands['3-4']} | ${(bands['3-4']/unique.length*100).toFixed(1)}% |
| 1.0–2.9 (SKIP)          | ${bands['1-2']} | ${(bands['1-2']/unique.length*100).toFixed(1)}% |
| **Total**               | **${unique.length}** | 100% |

## Distribution by origin

| Origin | 9-10 | 7-8 | 5-6 | 3-4 | 1-2 | Total |
|--------|-----:|----:|----:|----:|----:|------:|
${Object.entries(bandsByOrigin).map(([o, b]) => `| ${o} | ${b['9-10']||0} | ${b['7-8']||0} | ${b['5-6']||0} | ${b['3-4']||0} | ${b['1-2']||0} | ${Object.values(b).reduce((a,c)=>a+c,0)} |`).join('\n')}

## Sniff test

Top 40 origin mix: ${JSON.stringify(top40Origin)}
Top 40 Fortune-500 names: **${top40Fortune.length}** ${top40Fortune.length > 5 ? '⚠ FAIL — re-score' : '✓ pass — leans small/local'}

---

## TOP 40 — CALL THIS WEEK (cards)

${top40.map(topCard).join('\n')}

---

## SCORE 9.0–10 (entire band)

| # | Score | Razón social | Origin | Location | Vol | Action | Why |
|---|------:|---|---|---|---|---|---|
${unique.filter(p => p.score >= 9).map(compactRow).join('\n')}

---

## SCORE 7.0–8.9 — RESEARCH AND CALL

| # | Score | Razón social | Origin | Location | Vol | Action | Why |
|---|------:|---|---|---|---|---|---|
${unique.filter(p => p.score >= 7 && p.score < 9).map(compactRow).join('\n')}

---

## SCORE 5.0–6.9 — QUEUE FOR MONTH 2

| # | Score | Razón social | Origin | Location | Vol | Action | Why |
|---|------:|---|---|---|---|---|---|
${unique.filter(p => p.score >= 5 && p.score < 7).map(compactRow).join('\n')}

---

## SCORE 3.0–4.9 — LOW PRIORITY

| # | Score | Razón social | Origin | Location | Vol | Action | Why |
|---|------:|---|---|---|---|---|---|
${unique.filter(p => p.score >= 3 && p.score < 5).map(compactRow).join('\n')}

---

## SCORE 1.0–2.9 — SKIP

| # | Score | Razón social | Origin | Location | Vol | Action | Why |
|---|------:|---|---|---|---|---|---|
${unique.filter(p => p.score < 3).map(compactRow).join('\n')}

---

## ⚠ LOW-CONFIDENCE FLAGS — high score but weak data

These scored ≥ 7 but have data-quality red flags (no contact, no DM, or invisible-without-contactability). Verify before calling.

${(() => {
  const flagged = unique.filter(p => p.lowConfidence)
  if (!flagged.length) return '_None._'
  return flagged.map((p, i) => `- **${p.razon_social}** (score ${p.score.toFixed(1)}, ${p._origin}/${p._bucket}) — ${p.lowConfReasons.join(', ')} · _why scored high: ${p.reasoning}_`).join('\n')
})()}

---

## Methodology notes

Existing clients start at baseline 6.5 (they know us). Adjusted by silence (recent +, dormant -), RAR bonus, trajectory, named-contact bonus.

External prospects start at baseline 5. Adjusted by:
- Geographic fit (+2 Laredo metro, +1 Tamps, +0.5 NL, +0.3 Coah, -0.5 outside corridor)
- Fortune-500 name penalty (-2 — they have entrenched brokers)
- Investment >$100M penalty (-0.7 — enterprise broker selection)
- Multinational broker incumbent penalty (-1.2 DSV/Schenker/UPS/etc.)
- Aging-broker window (+1.2)
- M&A churn signal like EELCO-Redwood (+1.0)
- "Broker selection open" cue (+0.8)
- Niche match — IMMEX/maquila/automotive/steel/food/electronics (+0.4)
- Family-business signal (+0.3)
- Phone (+0.5), email (+0.4), DM (+0.7)

Needle prospects get +1.5 small-operator bonus +0.7 if obviousness ≤2.

Channel partners scored separately at 6.5 baseline + relationship signals.

---

*SCORED · 2026-04-19 · prospect-engine v1.3*
*${unique.length} unique prospects · top ${bands['9-10']} = this week's working list*
*Patente 3596 · Aduana 240 · Laredo TX · Est. 1941*
`

await fs.writeFile(OUT, md, 'utf8')
console.log(`\n✓ ${OUT}`)
console.log(`\n=== SCORE DISTRIBUTION ===`)
console.log(`9-10 (CALL THIS WEEK): ${bands['9-10']}`)
console.log(`7-8  (RESEARCH+CALL):  ${bands['7-8']}`)
console.log(`5-6  (MONTH 2):        ${bands['5-6']}`)
console.log(`3-4  (LOW):            ${bands['3-4']}`)
console.log(`1-2  (SKIP):           ${bands['1-2']}`)
console.log(`Total unique:          ${unique.length}`)

console.log(`\n=== TOP 40 — THIS WEEK'S WORKING LIST ===\n`)
top40.forEach((p, i) => {
  console.log(`${i+1}. [${p.score.toFixed(1)}] ${p.razon_social}  (${p._origin}/${p._bucket})`)
  console.log(`   ${p.city || '?'}, ${p.state || '?'} · vol ${p.estimated_volume || '?'} · ${p.action}`)
  console.log(`   DM: ${p.decision_maker || '(none)'} · contact: ${contactStr(p).slice(0, 80)}`)
  console.log(`   why: ${p.reasoning}`)
  if (p.lowConfidence) console.log(`   ⚠ LOW-CONF: ${p.lowConfReasons.join(', ')}`)
  console.log()
})

const flagged = unique.filter(p => p.lowConfidence)
console.log(`\n=== ⚠ LOW-CONFIDENCE FLAGS (${flagged.length}) — verify before call ===\n`)
flagged.slice(0, 25).forEach(p => {
  console.log(`- [${p.score.toFixed(1)}] ${p.razon_social} — ${p.lowConfReasons.join(', ')}`)
})
if (flagged.length > 25) console.log(`...+ ${flagged.length - 25} more in the file.`)
