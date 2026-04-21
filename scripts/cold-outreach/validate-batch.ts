#!/usr/bin/env npx tsx
/**
 * Validate a cold-outreach send CSV. Read-only — never modifies anything.
 * Run before send-campaign.ts to catch CSV issues while you still have time.
 *
 * Exits 0 on clean, 1 on any violation. Use in gsd-verify.sh or manually.
 *
 * Usage:
 *   npx tsx scripts/cold-outreach/validate-batch.ts --in data/cold-batch-2026-04-21.csv
 */

import * as fs from 'fs'
import * as path from 'path'

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  return process.argv[i + 1]
}

const inPath = arg('in', 'data/cold-batch-2026-04-21.csv')!
const maxRows = parseInt(arg('max', '200') || '200', 10)

const absIn = path.isAbsolute(inPath) ? inPath : path.resolve(process.cwd(), inPath)
if (!fs.existsSync(absIn)) {
  console.error(`✗ File not found: ${absIn}`)
  process.exit(1)
}

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

const rows = parseCsv(fs.readFileSync(absIn, 'utf8')).filter(r => r.length > 1 && r.some(c => c.trim()))
const failures: string[] = []
const warnings: string[] = []

if (rows.length < 2) {
  console.error('✗ No data rows.')
  process.exit(1)
}

const header = rows[0].map(h => h.trim().toLowerCase())
const REQUIRED = ['email', 'company', 'unsub_token', 'campaign_id']
for (const r of REQUIRED) {
  if (!header.includes(r)) failures.push(`missing required column: ${r}`)
}

const iEmail = header.indexOf('email')
const iCompany = header.indexOf('company')
const iFirst = header.indexOf('first_name')
const iCity = header.indexOf('city')
const iCampaign = header.indexOf('campaign_id')
const iToken = header.indexOf('unsub_token')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const seenEmail = new Set<string>()
const seenToken = new Set<string>()

const campaignIds = new Set<string>()
const data = rows.slice(1)

data.forEach((r, idx) => {
  const rn = idx + 2  // row number in CSV (1-indexed header + 1)
  const email = (r[iEmail] || '').trim().toLowerCase()
  const company = (r[iCompany] || '').trim()
  const city = iCity >= 0 ? (r[iCity] || '').trim().toLowerCase() : ''
  const token = iToken >= 0 ? (r[iToken] || '').trim() : ''
  const cid = iCampaign >= 0 ? (r[iCampaign] || '').trim() : ''

  if (!EMAIL_RE.test(email)) failures.push(`row ${rn}: invalid email "${email}"`)
  if (!company) failures.push(`row ${rn}: empty company`)
  if (!token || token.length < 8) failures.push(`row ${rn}: bad unsub_token`)
  if (!cid) failures.push(`row ${rn}: missing campaign_id`)
  if (city === 'laredo' || city === 'nuevo laredo' || city === 'nvo laredo' || city === 'n. laredo' || city === 'nld')
    failures.push(`row ${rn}: Laredo/N. Laredo recipient "${company}" (${city})`)
  if (seenEmail.has(email)) failures.push(`row ${rn}: duplicate email "${email}"`)
  if (seenToken.has(token)) failures.push(`row ${rn}: duplicate unsub_token "${token}"`)
  seenEmail.add(email)
  seenToken.add(token)
  if (cid) campaignIds.add(cid)

  if (iFirst < 0) warnings.push(`row ${rn}: no first_name column (will greet as "Equipo de compras")`)
})

if (data.length > maxRows)
  failures.push(`${data.length} rows exceeds --max ${maxRows}. Domain-warming risk: send in batches of ≤150/day.`)
if (data.length === 0) failures.push('0 data rows')
if (campaignIds.size > 1) failures.push(`multiple campaign_ids in one file: ${[...campaignIds].join(', ')}`)

console.log('')
console.log(`Cold outreach batch — validation report`)
console.log(`File:     ${absIn}`)
console.log(`Rows:     ${data.length}`)
console.log(`Campaign: ${[...campaignIds][0] || '(none)'}`)
console.log('')

if (failures.length > 0) {
  console.log(`✗ ${failures.length} blocking issue${failures.length === 1 ? '' : 's'}:`)
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`)
  if (failures.length > 40) console.log(`  … and ${failures.length - 40} more`)
  process.exit(1)
}

console.log(`✓ Clean. Ready to send.`)
if (warnings.length > 0 && warnings.length <= 5) {
  console.log('')
  for (const w of warnings) console.log(`  (warn) ${w}`)
}
process.exit(0)
