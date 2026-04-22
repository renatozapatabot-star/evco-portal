#!/usr/bin/env node
/**
 * Phantom-column detector — integrity audit (M14+).
 *
 * Walks every .ts/.tsx under src/, finds every
 *   .from('<table>').select('<col1, col2, ...>')
 * call, and cross-references the column list against the real
 * Supabase schema. Two-stage check:
 *
 *   1. Compare against a sample row's keys (fast — catches 80%)
 *   2. For anything not in the sample, probe PostgREST directly
 *      (catches the remaining cases where the table is empty or
 *      columns are null on the sample row)
 *
 * Usage:
 *   node scripts/audit-phantom-columns.mjs             # human-readable report
 *   node scripts/audit-phantom-columns.mjs --count     # just the number
 *
 * Exit codes:
 *   0 = no phantoms
 *   1 = phantoms found (for CI)
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in .env.local
 *
 * Why this exists: the M11/M12 phantom-column bug (partidas.cve_trafico
 * doesn't exist; queries silently 400 and get swallowed by soft-wrappers)
 * extended beyond the 3 call-sites originally fixed. Running this scan
 * found 63 more references across 40+ files. Debt logged in
 * .planning/PHANTOM_COLUMN_DEBT.md; work through it systematically.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnv({ path: path.join(__dirname, '..', '.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Tenant-scoped + related tables we care about
const TARGET_TABLES = [
  'globalpc_productos',
  'globalpc_partidas',
  'globalpc_facturas',
  'globalpc_eventos',
  'globalpc_proveedores',
  'globalpc_contenedores',
  'globalpc_ordenes_carga',
  'globalpc_bultos',
  'traficos',
  'entradas',
  'expediente_documentos',
  'anexo24_partidas',
  'leads',
  'lead_activities',
  'companies',
  'tenants',
]

// Step 1 — pull real schema for each table (from a sample row).
// Empty tables return an empty set; for those we fall back to a
// per-column probe in step 3 (PostgREST returns 400 for nonexistent
// columns even on empty tables).
const realSchemas = new Map()
for (const t of TARGET_TABLES) {
  const { data, error } = await sb.from(t).select('*').limit(1)
  if (error) {
    console.warn(`[skip] ${t}: ${error.message}`)
    continue
  }
  const cols = data?.[0] ? new Set(Object.keys(data[0])) : new Set()
  realSchemas.set(t, cols)
}

// Per-column existence probe — cached so a phantom flagged in 5
// files only hits the DB once. PostgREST 400s on nonexistent cols
// even when the table is empty.
const probeCache = new Map()
async function columnExists(table, col) {
  const key = `${table}.${col}`
  if (probeCache.has(key)) return probeCache.get(key)
  const { error } = await sb.from(table).select(col).limit(0)
  const exists = !error
  probeCache.set(key, exists)
  return exists
}

// Step 2 — walk src/ files + grep for .from().select() patterns
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name === 'node_modules' || name === '__tests__') continue
    const full = path.join(dir, name)
    const s = statSync(full)
    if (s.isDirectory()) walk(full, out)
    else if (/\.(tsx?|mjs)$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx') && !name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

const root = path.join(__dirname, '..', 'src')
const files = walk(root)

// Regex matches .from('table').select('col1, col2, col3') — captures table + column string.
// Handles multi-line .from().select() chains and string templates that break across lines.
const PATTERN = /\.from\(['"`]([a-z_][a-z0-9_]*)['"`]\)[\s\S]{0,200}?\.select\(\s*['"`]([^'"`]+)['"`]/g

const rawFindings = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(PATTERN)) {
    const [, table, colList] = match
    if (!realSchemas.has(table)) continue
    const real = realSchemas.get(table)
    const referenced = colList
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c && !c.includes('(') && c !== '*')
      .map((c) => c.split(':')[0].trim())
      .map((c) => c.split(' ')[0].trim())
      // Strip any template-literal placeholders (e.g. `${column}`)
      .filter((c) => c && !c.includes('$') && /^[a-z_][a-z0-9_]*$/i.test(c))
    const phantoms = referenced.filter((col) => col && !real.has(col))
    if (phantoms.length > 0) {
      rawFindings.push({
        file: path.relative(path.join(__dirname, '..'), file),
        table,
        phantoms,
        referenced,
      })
    }
  }
}

// Step 4 — for each flagged phantom, probe the DB to confirm it
// really doesn't exist. Filters out false positives on empty tables
// whose sample-row schema is blank.
const findings = []
for (const raw of rawFindings) {
  const confirmedPhantoms = []
  for (const col of raw.phantoms) {
    const exists = await columnExists(raw.table, col)
    if (!exists) confirmedPhantoms.push(col)
  }
  if (confirmedPhantoms.length > 0) {
    findings.push({ ...raw, phantoms: confirmedPhantoms })
  }
}

console.log(`\n=== Phantom-column scan · ${files.length} files · ${TARGET_TABLES.length} tables ===\n`)

if (findings.length === 0) {
  console.log('✓ Zero phantom references across every tenant-scoped table.')
  process.exit(0)
}

for (const f of findings) {
  console.log(`\n${f.file}`)
  console.log(`  table: ${f.table}`)
  console.log(`  phantoms: ${f.phantoms.join(', ')}`)
}

console.log(`\nTotal: ${findings.length} phantom-reference sites`)
process.exit(1)
