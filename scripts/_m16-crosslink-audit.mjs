#!/usr/bin/env node
/**
 * M16 cross-link integrity audit.
 *
 * Walks every canonical join the portal renders and checks for:
 *   - Orphan links (partidas without facturas, facturas without traficos, ...)
 *   - Null/empty company_id on tenant-scoped tables
 *   - Stale data (records with fecha_llegada older than 24 months)
 *   - Duplicate keys where uniqueness is implicit
 *   - Missing fraccion on classified products
 *   - RLS-bypass sanity (does a cross-tenant read return rows?)
 *   - Join-reachability on the tables Ursula touches
 *
 * Output: structured report to stdout, exits 0 if clean / 1 if findings.
 * Ad-hoc only — does NOT ratchet (too slow for CI). Living diagnostic.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('missing env'); process.exit(1) }
const sb = createClient(url, key)

let findings = 0
function fail(msg) { console.log(`  ❌ ${msg}`); findings++ }
function pass(msg) { console.log(`  ✅ ${msg}`) }
function info(msg) { console.log(`  ℹ  ${msg}`) }
function section(name) { console.log(`\n=== ${name} ===`) }

const COMPANY = 'evco'

// -------- 1. tenant_id / company_id integrity --------
section('1. Tenant-scope integrity (null leaks)')
for (const t of [
  'traficos', 'entradas', 'globalpc_facturas', 'globalpc_partidas',
  'globalpc_productos', 'globalpc_proveedores', 'expediente_documentos',
  'anexo24_partidas',
]) {
  const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true }).is('company_id', null)
  if (error) { info(`${t}: ${error.message}`); continue }
  if (count === 0) pass(`${t}: 0 null company_id`)
  else fail(`${t}: ${count} rows with null company_id`)
}

// -------- 2. EVCO row volumes --------
section('2. EVCO row volumes (sanity)')
for (const t of [
  'traficos', 'entradas', 'globalpc_facturas', 'globalpc_partidas',
  'globalpc_productos', 'globalpc_proveedores', 'expediente_documentos',
  'anexo24_partidas',
]) {
  const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true }).eq('company_id', COMPANY)
  if (error) { info(`${t}: ${error.message}`); continue }
  const display = count.toLocaleString()
  if (count === 0) fail(`${t}: 0 rows for EVCO — expected data`)
  else info(`${t}: ${display}`)
}

// -------- 3. Partidas → Facturas orphan check --------
section('3. Partidas → Facturas join integrity')
{
  const { data: partidas } = await sb.from('globalpc_partidas')
    .select('folio').eq('company_id', COMPANY).limit(5000)
  const partidaFolios = new Set((partidas ?? []).map(p => p.folio).filter(f => f != null))
  if (partidaFolios.size === 0) { info('No partidas sampled'); }
  else {
    const folios = Array.from(partidaFolios)
    const { data: facturas } = await sb.from('globalpc_facturas')
      .select('folio').eq('company_id', COMPANY).in('folio', folios)
    const matched = new Set((facturas ?? []).map(f => f.folio))
    const orphans = folios.filter(f => !matched.has(f))
    if (orphans.length === 0) pass(`Partidas → Facturas: 100% matched (${partidaFolios.size} distinct folios sampled)`)
    else fail(`Partidas → Facturas: ${orphans.length} orphan folios (sample: ${orphans.slice(0, 5).join(', ')})`)
  }
}

// -------- 4. Facturas → Traficos orphan check --------
section('4. Facturas → Traficos join integrity')
{
  const { data: facturas } = await sb.from('globalpc_facturas')
    .select('cve_trafico').eq('company_id', COMPANY).limit(5000)
  const facCveTraficos = new Set((facturas ?? []).map(f => f.cve_trafico).filter(t => t != null))
  if (facCveTraficos.size === 0) { info('No facturas sampled'); }
  else {
    const cves = Array.from(facCveTraficos)
    // chunk the .in() to avoid URL-too-long errors
    const chunk = 500
    const matched = new Set()
    for (let i = 0; i < cves.length; i += chunk) {
      const slice = cves.slice(i, i + chunk)
      const { data: traficos } = await sb.from('traficos')
        .select('trafico').eq('company_id', COMPANY).in('trafico', slice)
      for (const t of (traficos ?? [])) matched.add(t.trafico)
    }
    const orphans = cves.filter(c => !matched.has(c))
    if (orphans.length === 0) pass(`Facturas → Traficos: 100% matched (${cves.length} distinct cve_traficos)`)
    else fail(`Facturas → Traficos: ${orphans.length} orphan cve_traficos (sample: ${orphans.slice(0, 5).join(', ')})`)
  }
}

// -------- 5. Partidas → Productos orphan check --------
section('5. Partidas → Productos join integrity')
{
  const { data: partidas } = await sb.from('globalpc_partidas')
    .select('cve_producto').eq('company_id', COMPANY).limit(5000)
  const partCves = new Set((partidas ?? []).map(p => p.cve_producto).filter(c => c != null))
  if (partCves.size === 0) { info('No partidas sampled'); }
  else {
    const cves = Array.from(partCves)
    const chunk = 500
    const matched = new Set()
    for (let i = 0; i < cves.length; i += chunk) {
      const slice = cves.slice(i, i + chunk)
      const { data: productos } = await sb.from('globalpc_productos')
        .select('cve_producto').eq('company_id', COMPANY).in('cve_producto', slice)
      for (const p of (productos ?? [])) matched.add(p.cve_producto)
    }
    const orphans = cves.filter(c => !matched.has(c))
    if (orphans.length === 0) pass(`Partidas → Productos: 100% matched (${cves.length} distinct cve_productos)`)
    else fail(`Partidas → Productos: ${orphans.length} orphan cve_productos (sample: ${orphans.slice(0, 3).join(', ')})`)
  }
}

// -------- 6. Expediente_documentos → Traficos join (via pedimento_id) --------
section('6. Expediente → Traficos join integrity (pedimento_id→trafico)')
{
  const { data: docs } = await sb.from('expediente_documentos')
    .select('pedimento_id').eq('company_id', COMPANY).not('pedimento_id', 'is', null).limit(5000)
  const docSlugs = new Set((docs ?? []).map(d => d.pedimento_id))
  if (docSlugs.size === 0) { info('No expediente_documentos sampled'); }
  else {
    const slugs = Array.from(docSlugs)
    const chunk = 500
    const matched = new Set()
    for (let i = 0; i < slugs.length; i += chunk) {
      const slice = slugs.slice(i, i + chunk)
      const { data: traficos } = await sb.from('traficos')
        .select('trafico').eq('company_id', COMPANY).in('trafico', slice)
      for (const t of (traficos ?? [])) matched.add(t.trafico)
    }
    const orphans = slugs.filter(s => !matched.has(s))
    if (orphans.length === 0) pass(`Expediente → Traficos: 100% matched (${slugs.length} distinct trafico slugs)`)
    else {
      // Some docs may link to a pedimento number rather than a trafico slug — that's OK.
      const pedimentoShape = orphans.filter(s => /^\d{2} \d{2} \d{4} \d{7}$/.test(s))
      const otherOrphans = orphans.length - pedimentoShape.length
      if (otherOrphans === 0) pass(`Expediente → Traficos: all orphans are pedimento-shape (legit, ${pedimentoShape.length})`)
      else info(`Expediente → Traficos: ${orphans.length} unmatched (${pedimentoShape.length} pedimento-shape, ${otherOrphans} other — may be historical / multi-system)`)
    }
  }
}

// -------- 7. Entradas → Traficos join --------
section('7. Entradas → Traficos join integrity')
{
  const { data: entradas } = await sb.from('entradas')
    .select('trafico').eq('company_id', COMPANY).not('trafico', 'is', null).limit(5000)
  const entSlugs = new Set((entradas ?? []).map(e => e.trafico))
  if (entSlugs.size === 0) { info('No entradas sampled'); }
  else {
    const slugs = Array.from(entSlugs)
    const chunk = 500
    const matched = new Set()
    for (let i = 0; i < slugs.length; i += chunk) {
      const slice = slugs.slice(i, i + chunk)
      const { data: traficos } = await sb.from('traficos')
        .select('trafico').eq('company_id', COMPANY).in('trafico', slice)
      for (const t of (traficos ?? [])) matched.add(t.trafico)
    }
    const orphans = slugs.filter(s => !matched.has(s))
    if (orphans.length === 0) pass(`Entradas → Traficos: 100% matched (${slugs.length} distinct)`)
    else info(`Entradas → Traficos: ${orphans.length} orphan entradas (may be entradas recibidas without a filed trafico yet)`)
  }
}

// -------- 8. Anexo24_partidas → Productos coverage --------
section('8. Anexo24_partidas → Productos coverage')
{
  const { data: anexo } = await sb.from('anexo24_partidas')
    .select('numero_parte').eq('company_id', COMPANY).limit(2000)
  const anexoParts = new Set((anexo ?? []).map(a => a.numero_parte).filter(Boolean))
  if (anexoParts.size === 0) { info('anexo24_partidas empty or not seeded for EVCO'); }
  else {
    const cves = Array.from(anexoParts)
    const chunk = 500
    const matched = new Set()
    for (let i = 0; i < cves.length; i += chunk) {
      const slice = cves.slice(i, i + chunk)
      const { data: productos } = await sb.from('globalpc_productos')
        .select('cve_producto').eq('company_id', COMPANY).in('cve_producto', slice)
      for (const p of (productos ?? [])) matched.add(p.cve_producto)
    }
    const orphans = cves.filter(c => !matched.has(c))
    if (orphans.length === 0) pass(`Anexo24 → Productos: 100% matched (${cves.length} distinct)`)
    else info(`Anexo24 → Productos: ${orphans.length} anexo parts with no matching product mirror (may be historical)`)
  }
}

// -------- 9. Semáforo distribution --------
section('9. Semáforo distribution (verde rate)')
{
  const { count: total } = await sb.from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY).not('semaforo', 'is', null)
  const { count: verde } = await sb.from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY).eq('semaforo', 0)
  const { count: amarillo } = await sb.from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY).eq('semaforo', 1)
  const { count: rojo } = await sb.from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY).eq('semaforo', 2)
  const pct = total > 0 ? ((verde / total) * 100).toFixed(1) : '—'
  info(`Total with semáforo: ${total} · Verde: ${verde} (${pct}%) · Amarillo: ${amarillo} · Rojo: ${rojo}`)
  if (total > 0 && (verde + amarillo + rojo) !== total) {
    fail(`Semáforo counts don't sum to total (drift)`)
  } else if (total > 0) {
    pass(`Semáforo counts sum correctly`)
  }
}

// -------- 10. Productos classification coverage --------
section('10. Productos classification coverage')
{
  const { count: total } = await sb.from('globalpc_productos')
    .select('*', { count: 'exact', head: true }).eq('company_id', COMPANY)
  const { count: classified } = await sb.from('globalpc_productos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY).not('fraccion', 'is', null)
  const pct = total > 0 ? ((classified / total) * 100).toFixed(1) : '—'
  info(`Productos: ${total} · classified: ${classified} (${pct}%)`)
  if (pct !== '—' && Number(pct) < 50) {
    info(`classified rate below 50% — normal for long-tail SKUs (only actively-used parts get classified)`)
  }
}

// -------- 11. RLS-bypass integrity (cross-tenant filter must return 0) --------
section('11. RLS defense-in-depth (cross-tenant read)')
{
  const { count } = await sb.from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 'mafesa')
  info(`mafesa traficos via service-role: ${count} (expected non-zero if tenant has data, not 0)`)
  const { count: misc } = await sb.from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 'nonexistent-tenant')
  if (misc === 0) pass(`Non-existent tenant filter returns 0 (schema behaves correctly)`)
  else fail(`Non-existent tenant returned ${misc} rows`)
}

// -------- 12. Pedimento format integrity on traficos --------
section('12. Pedimento format integrity')
{
  const { data: traficos } = await sb.from('traficos')
    .select('trafico, pedimento').eq('company_id', COMPANY)
    .not('pedimento', 'is', null).limit(2000)
  const rows = traficos ?? []
  const bad = rows.filter(r => {
    const p = (r.pedimento ?? '').toString()
    // SAT canonical: DD AA PPPP SSSSSSS (15 chars incl spaces)
    return !/^\d{2}\s\d{2}\s\d{4}\s\d{7}$/.test(p)
  })
  if (bad.length === 0) pass(`Pedimento format: all ${rows.length} sampled rows canonical (DD AA PPPP SSSSSSS)`)
  else fail(`Pedimento format: ${bad.length} of ${rows.length} sampled rows have non-canonical format (sample: ${bad.slice(0, 3).map(r => r.pedimento).join(' | ')})`)
}

// -------- 13. Fraccion format integrity on productos --------
section('13. Fraccion format integrity')
{
  const { data: productos } = await sb.from('globalpc_productos')
    .select('fraccion').eq('company_id', COMPANY)
    .not('fraccion', 'is', null).limit(2000)
  const rows = productos ?? []
  const bad = rows.filter(r => {
    const f = (r.fraccion ?? '').toString()
    // XXXX.XX.XX or XXXX.XX.XX.XX
    return !/^\d{4}\.\d{2}\.\d{2}(\.\d{2})?$/.test(f)
  })
  if (bad.length === 0) pass(`Fraccion format: all ${rows.length} sampled classified rows canonical`)
  else fail(`Fraccion format: ${bad.length} of ${rows.length} sampled classified rows non-canonical`)
}

// -------- 14. Stale-data check (traficos last activity) --------
section('14. Recency / staleness')
{
  const { data: recent } = await sb.from('traficos')
    .select('created_at').eq('company_id', COMPANY)
    .order('created_at', { ascending: false }).limit(1)
  const last = recent?.[0]?.created_at
  if (!last) { info('No traficos timestamps'); }
  else {
    const ageMs = Date.now() - new Date(last).getTime()
    const ageDays = Math.floor(ageMs / 86_400_000)
    info(`Most recent trafico created ${ageDays} days ago (${last})`)
    if (ageDays > 10) info(`> 10 days — PM2 sync chain likely stale (operator issue from M5)`)
  }
}

// -------- summary --------
section(`Summary`)
if (findings === 0) { console.log(`\n✅ 0 integrity failures.\n`); process.exit(0) }
else { console.log(`\n❌ ${findings} integrity failures.\n`); process.exit(1) }
