// scripts/lib/tenant-tags.js — defensive tenant identifier normalizer.
//
// Twin of src/lib/tenant/resolve-slug.ts for Node/cron use. Same contract,
// same behavior. Born from the 2026-04-29 audit that found 187 distinct
// claves stamped as `company_id` across the notifications table (60K rows)
// and similar contamination on expediente_documentos + operational_decisions.
//
// Usage:
//   const { buildClaveMap, resolveCompanyIdSlug } = require('./lib/tenant-tags')
//   const claveMap = await buildClaveMap(supabase)
//   const r = resolveCompanyIdSlug(input, claveMap)
//   if (r.kind === 'unresolved') { skip + log; continue }
//   await supabase.from('notifications').insert({ ..., company_id: r.slug })
//
// Behavior:
//   - Already-active slug → resolved (slug-passthrough)
//   - 1–4 digit clave present in claveMap → resolved (clave-mapped)
//   - null/undefined/empty/whitespace → unresolved (reason: 'null')
//   - Unknown clave → unresolved (reason: 'unknown-clave')
//   - Internal sentinels (system/internal/admin/broker) → resolved
//   - NEVER falls back silently — the old `claveMap[input] || input`
//     pattern is the bug this helper exists to prevent.

const INTERNAL_SLUGS = new Set(['system', 'internal', 'admin', 'broker'])

async function buildClaveMap(supabase) {
  const { data, error } = await supabase
    .from('companies')
    .select('clave_cliente, globalpc_clave, company_id, active')
  if (error) throw new Error(`buildClaveMap: ${error.message}`)
  const map = new Map()
  // Pass 1: stamp ACTIVE first so the active company wins on conflict
  for (const row of data || []) {
    if (!row.company_id || !row.active) continue
    if (row.clave_cliente) map.set(String(row.clave_cliente), row.company_id)
    if (row.globalpc_clave) map.set(String(row.globalpc_clave), row.company_id)
  }
  // Pass 2: fill in inactive only where active didn't claim the clave
  for (const row of data || []) {
    if (!row.company_id || row.active) continue
    if (row.clave_cliente && !map.has(String(row.clave_cliente))) map.set(String(row.clave_cliente), row.company_id)
    if (row.globalpc_clave && !map.has(String(row.globalpc_clave))) map.set(String(row.globalpc_clave), row.company_id)
  }
  return map
}

async function buildSlugAllowlist(supabase) {
  const { data, error } = await supabase
    .from('companies')
    .select('company_id, active')
  if (error) throw new Error(`buildSlugAllowlist: ${error.message}`)
  const set = new Set()
  for (const row of data || []) {
    if (row.company_id && row.active) set.add(row.company_id)
  }
  return set
}

function resolveCompanyIdSlug(input, claveMap, slugAllowlist) {
  if (input === null || input === undefined || input === '') {
    return { kind: 'unresolved', input, reason: 'null' }
  }
  const str = String(input).trim()
  if (str === '') return { kind: 'unresolved', input, reason: 'null' }

  if (INTERNAL_SLUGS.has(str)) {
    return { kind: 'resolved', slug: str, via: 'slug-passthrough' }
  }

  if (/^[0-9]{1,4}$/.test(str)) {
    const slug = claveMap.get(str)
    if (slug) return { kind: 'resolved', slug, via: 'clave-mapped' }
    return { kind: 'unresolved', input, reason: 'unknown-clave' }
  }

  if (slugAllowlist && !slugAllowlist.has(str)) {
    return { kind: 'unresolved', input, reason: 'unknown-slug' }
  }
  return { kind: 'resolved', slug: str, via: 'slug-passthrough' }
}

module.exports = {
  INTERNAL_SLUGS,
  buildClaveMap,
  buildSlugAllowlist,
  resolveCompanyIdSlug,
}
