#!/usr/bin/env npx tsx
/**
 * Normalize an Apollo CSV export into the cold-outreach send CSV.
 *
 * Apollo columns (2026 export schema, common ones):
 *   First Name, Last Name, Title, Email, Corporate Phone, Mobile Phone,
 *   Company, Industry, City, State, Country, Website
 *
 * Output: data/cold-batch-2026-04-21.csv with columns:
 *   email, company, first_name, industry, state, city, rfc, unsub_token, campaign_id
 *
 * Usage:
 *   npx tsx scripts/cold-outreach/build-batch.ts \
 *     --in ~/Downloads/apollo-export.csv \
 *     --out data/cold-batch-2026-04-21.csv \
 *     --campaign cold-2026-04-21 \
 *     --max 150
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// ── CLI parsing ─────────────────────────────────────────────────────
function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  return process.argv[i + 1]
}

const inPath = arg('in')
const outPath = arg('out', 'data/cold-batch-2026-04-21.csv')!
const campaignId = arg('campaign', 'cold-2026-04-21')!
const maxRows = parseInt(arg('max', '150') || '150', 10)

if (!inPath) {
  console.error('Usage: npx tsx build-batch.ts --in <apollo.csv> --out <out.csv> [--campaign <id>] [--max N]')
  process.exit(2)
}

// ── Minimal CSV parser (handles quoted fields + commas in quotes) ───
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { field += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else { field += ch }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

function csvEscape(s: string): string {
  if (s == null) return ''
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// ── Laredo / Nuevo Laredo gate ──────────────────────────────────────
// We want shippers from Mexico's interior. Any Laredo (US) or Nuevo Laredo (MX)
// city signals a company already in the border zone — excluded per constraint.
function isLaredoCity(city?: string): boolean {
  if (!city) return false
  const c = city.toLowerCase().trim()
  return c === 'laredo' || c === 'nuevo laredo' || c === 'nvo laredo' || c === 'n. laredo' || c === 'nld'
}

// ── Main ────────────────────────────────────────────────────────────
const absIn = path.isAbsolute(inPath) ? inPath : path.resolve(process.cwd(), inPath)
const absOut = path.isAbsolute(outPath) ? outPath : path.resolve(process.cwd(), outPath)

if (!fs.existsSync(absIn)) {
  console.error(`Input file not found: ${absIn}`)
  process.exit(2)
}

const raw = fs.readFileSync(absIn, 'utf8')
const rows = parseCsv(raw).filter(r => r.length > 1 && r.some(c => c.trim()))
if (rows.length < 2) {
  console.error('Empty CSV or no data rows.')
  process.exit(2)
}

const header = rows[0].map(h => h.trim().toLowerCase())
function col(...names: string[]): number {
  for (const n of names) {
    const i = header.indexOf(n.toLowerCase())
    if (i >= 0) return i
  }
  return -1
}

const iEmail = col('email', 'email address', 'work email')
const iFirst = col('first name', 'firstname', 'first_name')
const iLast = col('last name', 'lastname', 'last_name')
const iCompany = col('company', 'company name', 'account', 'organization')
const iIndustry = col('industry', 'industries', 'sector')
const iCity = col('city')
const iState = col('state', 'state_province', 'region')
const iCountry = col('country')
const iPhone = col('corporate phone', 'phone', 'work phone', 'direct phone', 'mobile phone')

if (iEmail < 0 || iCompany < 0) {
  console.error(`Missing required columns. Need at minimum "Email" and "Company". Got header: ${header.join(', ')}`)
  process.exit(2)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const seenEmail = new Set<string>()
const seenCompany = new Set<string>()

interface OutRow {
  email: string
  company: string
  first_name: string
  industry: string
  state: string
  city: string
  rfc: string
  unsub_token: string
  campaign_id: string
}

const kept: OutRow[] = []
const dropped: { row: string[]; reason: string }[] = []

for (let i = 1; i < rows.length; i++) {
  if (kept.length >= maxRows) break
  const r = rows[i]
  const email = (r[iEmail] || '').trim().toLowerCase()
  const company = (r[iCompany] || '').trim()
  const firstName = iFirst >= 0 ? (r[iFirst] || '').trim() : ''
  const industry = iIndustry >= 0 ? (r[iIndustry] || '').trim() : ''
  const city = iCity >= 0 ? (r[iCity] || '').trim() : ''
  const state = iState >= 0 ? (r[iState] || '').trim() : ''
  const country = iCountry >= 0 ? (r[iCountry] || '').trim() : ''

  if (!email) { dropped.push({ row: r, reason: 'no-email' }); continue }
  if (!EMAIL_RE.test(email)) { dropped.push({ row: r, reason: 'invalid-email' }); continue }
  if (!company) { dropped.push({ row: r, reason: 'no-company' }); continue }
  if (isLaredoCity(city)) { dropped.push({ row: r, reason: 'laredo-city' }); continue }
  if (country && !/mex|méxic/i.test(country) && !/united states/i.test(country)) {
    // Accept MX or US-headquartered (US HQ with MX ops is valid); drop other countries.
    dropped.push({ row: r, reason: `country-${country}` }); continue
  }
  if (seenEmail.has(email)) { dropped.push({ row: r, reason: 'dup-email' }); continue }
  // Dedupe by normalized company too (Apollo sometimes returns multiple contacts per co)
  const companyKey = company.toLowerCase().replace(/\s+s\.?a\.?\s*de\s*c\.?v\.?/i, '').trim()
  if (seenCompany.has(companyKey)) { dropped.push({ row: r, reason: 'dup-company' }); continue }
  seenEmail.add(email)
  seenCompany.add(companyKey)

  // unsub token = HMAC-like short hex from (email + campaign) — no secret needed,
  // since it only scopes the unsub request to this campaign + recipient.
  const unsubToken = crypto
    .createHash('sha256')
    .update(`${email}|${campaignId}`)
    .digest('hex')
    .slice(0, 16)

  kept.push({
    email, company, first_name: firstName, industry, state, city,
    rfc: '', unsub_token: unsubToken, campaign_id: campaignId,
  })
}

const outDir = path.dirname(absOut)
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

const outHeader = ['email', 'company', 'first_name', 'industry', 'state', 'city', 'rfc', 'unsub_token', 'campaign_id']
const outLines = [outHeader.join(',')]
for (const k of kept) {
  outLines.push(outHeader.map(h => csvEscape(String((k as unknown as Record<string, string>)[h]))).join(','))
}
fs.writeFileSync(absOut, outLines.join('\n') + '\n')

// ── Summary ─────────────────────────────────────────────────────────
const dropReasons = new Map<string, number>()
for (const d of dropped) dropReasons.set(d.reason, (dropReasons.get(d.reason) || 0) + 1)

console.log('')
console.log(`✓ Wrote ${kept.length} recipients → ${absOut}`)
console.log(`  Source rows: ${rows.length - 1}  ·  kept: ${kept.length}  ·  dropped: ${dropped.length}`)
for (const [reason, n] of dropReasons) console.log(`    - ${reason}: ${n}`)
console.log('')
if (kept.length > 0) {
  console.log('Sample (first 3):')
  for (const k of kept.slice(0, 3)) {
    console.log(`  ${k.email.padEnd(40)}  ${k.company.slice(0, 30).padEnd(30)}  ${k.state.padEnd(12)}  ${k.industry.slice(0, 20)}`)
  }
}
