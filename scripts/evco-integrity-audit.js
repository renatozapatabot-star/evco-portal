#!/usr/bin/env node
/**
 * scripts/evco-integrity-audit.js
 *
 * Read-only integrity audit for EVCO (or any tenant — pass --tenant=X).
 * Probes the tables that feed the /inicio cockpit + Phase 3 agent and
 * reports anything that would cause the dashboard to render zeros,
 * blanks, or stale signals.
 *
 * Usage:
 *   node scripts/evco-integrity-audit.js                 # default tenant=evco
 *   node scripts/evco-integrity-audit.js --tenant=mafesa
 *   node scripts/evco-integrity-audit.js --json          # JSON output for piping
 *
 * Output modes:
 *   - Default: human-readable text report (stdout, colored via markers)
 *   - --json : structured JSON for programmatic consumption
 *
 * Safety:
 *   - READ-ONLY. Zero writes. No destructive operations.
 *   - Uses the service role key (server-side); safe because this is a
 *     CLI tool, not a client-facing surface.
 *   - Tenant-scoped: every query filters by company_id (or clave_cliente
 *     for econta tables).
 *   - Non-blocking: individual probe failures degrade to a ⚠ line;
 *     script still exits 0 unless the Supabase client itself can't
 *     be constructed.
 *
 * Probes (15 total):
 *   Core tenant
 *     01. companies row exists + active=true
 *     02. company_id + clave_cliente both set
 *
 *   Live feeds (14-day window)
 *     03. traficos — row count + null semaforo ratio + most-recent fecha_cruce
 *     04. entradas — row count + most-recent fecha_llegada_mercancia
 *     05. pedimentos — row count + most-recent created_at
 *     06. globalpc_partidas — 14d rows (input for predictor/anomaly)
 *     07. globalpc_facturas — 14d rows (join health for predictor)
 *     08. globalpc_productos — total rows + classified ratio
 *     09. expediente_documentos — 14d uploads
 *
 *   Econta (for /mi-cuenta + Contabilidad tile)
 *     10. econta_cartera — open balances
 *     11. econta_facturas — 30d invoice count
 *
 *   Agent infrastructure
 *     12. agent_decisions — 7d row count + tool_name distribution
 *     13. sync_log — last successful run per sync_type
 *     14. heartbeat_log — last heartbeat (if table exists)
 *     15. system_config — rates present + not expired
 *
 * Each probe reports:
 *   ✓ healthy · ⚠ warning · ✗ critical
 *
 * Exit codes:
 *   0 — no critical probes (warnings allowed)
 *   1 — at least one critical probe OR the Supabase client failed
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')

// ── CLI args ─────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { tenant: 'evco', json: false }
  for (const a of argv.slice(2)) {
    if (a === '--json') out.json = true
    else if (a.startsWith('--tenant=')) out.tenant = a.slice('--tenant='.length).trim()
  }
  return out
}

const ARGS = parseArgs(process.argv)
const TENANT = ARGS.tenant

// ── Supabase client ──────────────────────────────────────────────

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('[audit] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key)

// ── Timing helpers ───────────────────────────────────────────────

function isoDaysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}
function isoMinutesAgo(n) {
  return new Date(Date.now() - n * 60_000).toISOString()
}
function fmtRelMinutes(iso) {
  if (!iso) return 'nunca'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 0) return 'futuro'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 48) return `hace ${hrs} h`
  const days = Math.floor(hrs / 24)
  return `hace ${days} días`
}

// ── Probe results accumulator ────────────────────────────────────

/** @type {Array<{id: string, title: string, status: 'ok' | 'warn' | 'crit', detail: string, data: Record<string, unknown>}>} */
const probes = []

function recordProbe(id, title, status, detail, data = {}) {
  probes.push({ id, title, status, detail, data })
}

async function safeProbe(id, title, fn) {
  try {
    await fn()
  } catch (err) {
    recordProbe(id, title, 'crit', `probe_threw: ${err.message || String(err)}`)
  }
}

// ── Probes ────────────────────────────────────────────────────────

async function probeCompaniesRow() {
  await safeProbe('01.companies_row', 'Tenant row exists', async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('company_id, clave_cliente, name, active, onboarded_at')
      .eq('company_id', TENANT)
      .maybeSingle()
    if (error) {
      return recordProbe('01.companies_row', 'Tenant row exists', 'crit', `db_error: ${error.message}`)
    }
    if (!data) {
      return recordProbe('01.companies_row', 'Tenant row exists', 'crit', `No companies row for company_id='${TENANT}'`)
    }
    if (!data.active) {
      return recordProbe('01.companies_row', 'Tenant row exists', 'warn', `Row exists but active=false`, { row: data })
    }
    recordProbe('01.companies_row', 'Tenant row exists', 'ok', `${data.name ?? TENANT} · clave ${data.clave_cliente ?? '—'}`, { row: data })
  })
}

async function probeTenantIdsConsistent() {
  await safeProbe('02.tenant_ids', 'company_id + clave_cliente set', async () => {
    const { data } = await supabase
      .from('companies')
      .select('company_id, clave_cliente')
      .eq('company_id', TENANT)
      .maybeSingle()
    if (!data) {
      return recordProbe('02.tenant_ids', 'company_id + clave_cliente set', 'crit', 'No row to check')
    }
    if (!data.clave_cliente) {
      return recordProbe('02.tenant_ids', 'company_id + clave_cliente set', 'warn',
        'company_id present but clave_cliente is NULL — econta joins (/mi-cuenta, Contabilidad tile) will return empty')
    }
    recordProbe('02.tenant_ids', 'company_id + clave_cliente set', 'ok',
      `company_id='${data.company_id}' · clave='${data.clave_cliente}'`)
  })
}

async function probeTraficos() {
  await safeProbe('03.traficos', 'traficos — 14d window', async () => {
    const since = isoDaysAgo(14)
    const { data, count, error } = await supabase
      .from('traficos')
      .select('trafico, fecha_cruce, semaforo', { count: 'exact' })
      .eq('company_id', TENANT)
      .gte('fecha_llegada', since)
      .order('fecha_llegada', { ascending: false })
      .limit(500)
    if (error) return recordProbe('03.traficos', 'traficos — 14d window', 'crit', `db_error: ${error.message}`)
    const total = count ?? 0
    if (total === 0) {
      return recordProbe('03.traficos', 'traficos — 14d window', 'warn',
        'Zero tráficos in last 14 days — /embarques + homepage will render empty',
        { count: 0, since })
    }
    const rows = data ?? []
    const nullSemaforo = rows.filter((r) => r.semaforo == null).length
    const nullRatio = rows.length > 0 ? nullSemaforo / rows.length : 0
    const lastCruce = rows.find((r) => r.fecha_cruce)?.fecha_cruce
    const detail = `${total} tráficos 14d · último cruce ${fmtRelMinutes(lastCruce)} · ${Math.round(nullRatio * 100)}% sin semáforo`
    const status = nullRatio > 0.5 ? 'warn' : 'ok'
    recordProbe('03.traficos', 'traficos — 14d window', status, detail,
      { count: total, null_semaforo_ratio: nullRatio, last_fecha_cruce: lastCruce })
  })
}

async function probeEntradas() {
  await safeProbe('04.entradas', 'entradas — 14d window', async () => {
    const since = isoDaysAgo(14)
    const { data, count, error } = await supabase
      .from('entradas')
      .select('id, fecha_llegada_mercancia', { count: 'exact' })
      .eq('company_id', TENANT)
      .gte('fecha_llegada_mercancia', since)
      .order('fecha_llegada_mercancia', { ascending: false })
      .limit(100)
    if (error) return recordProbe('04.entradas', 'entradas — 14d window', 'crit', `db_error: ${error.message}`)
    const total = count ?? 0
    const last = data?.[0]?.fecha_llegada_mercancia
    const status = total === 0 ? 'warn' : 'ok'
    recordProbe('04.entradas', 'entradas — 14d window', status,
      `${total} entradas 14d · última ${fmtRelMinutes(last)}`,
      { count: total, last_fecha_llegada: last })
  })
}

async function probePedimentos(tenantRfc) {
  await safeProbe('05.pedimentos', 'pedimentos — 14d window', async () => {
    // pedimentos has NO company_id — tenant scope is via rfc_importador.
    // If we don't have an RFC, we can't scope; surface that as a warning
    // so callers know the pedimentos count on the cockpit will be cross-
    // tenant or empty until the scoping path is confirmed.
    if (!tenantRfc) {
      return recordProbe('05.pedimentos', 'pedimentos — 14d window', 'warn',
        'No RFC del tenant en companies.rfc — no se puede scoped query pedimentos')
    }
    const since = isoDaysAgo(14)
    const { data, count, error } = await supabase
      .from('pedimentos')
      .select('id, numero_pedimento, fecha_entrada', { count: 'exact' })
      .eq('rfc_importador', tenantRfc)
      .gte('fecha_entrada', since)
      .order('fecha_entrada', { ascending: false })
      .limit(50)
    if (error) return recordProbe('05.pedimentos', 'pedimentos — 14d window', 'warn',
      `db_error: ${error.message}`)
    const total = count ?? 0
    const last = data?.[0]?.fecha_entrada
    recordProbe('05.pedimentos', 'pedimentos — 14d window', total === 0 ? 'warn' : 'ok',
      `${total} pedimentos 14d · último ${fmtRelMinutes(last)}`,
      { count: total, last_fecha_entrada: last, rfc: tenantRfc })
  })
}

async function probeGlobalpcPartidas() {
  await safeProbe('06.partidas', 'globalpc_partidas — 14d', async () => {
    const since = isoDaysAgo(14)
    const { count, error } = await supabase
      .from('globalpc_partidas')
      .select('folio', { count: 'exact', head: true })
      .eq('company_id', TENANT)
      .gte('created_at', since)
    if (error) return recordProbe('06.partidas', 'globalpc_partidas — 14d', 'crit', `db_error: ${error.message}`)
    const total = count ?? 0
    // < 5 partidas in 14d means the predictor + anomaly detector produce null/empty.
    const status = total === 0 ? 'warn' : total < 5 ? 'warn' : 'ok'
    recordProbe('06.partidas', 'globalpc_partidas — 14d', status,
      `${total} partidas 14d ${total < 5 ? '(< 5 = predictor degradado)' : ''}`,
      { count: total })
  })
}

async function probeGlobalpcFacturas() {
  await safeProbe('07.facturas_gp', 'globalpc_facturas — 14d', async () => {
    const since = isoDaysAgo(14)
    const { count, error } = await supabase
      .from('globalpc_facturas')
      .select('folio', { count: 'exact', head: true })
      .eq('company_id', TENANT)
      .gte('fecha_facturacion', since)
    if (error) return recordProbe('07.facturas_gp', 'globalpc_facturas — 14d', 'crit', `db_error: ${error.message}`)
    const total = count ?? 0
    recordProbe('07.facturas_gp', 'globalpc_facturas — 14d', total === 0 ? 'warn' : 'ok',
      `${total} facturas 14d`, { count: total })
  })
}

async function probeGlobalpcProductos() {
  await safeProbe('08.productos', 'globalpc_productos — total + classified', async () => {
    const { count: total, error: errT } = await supabase
      .from('globalpc_productos')
      .select('cve_producto', { count: 'exact', head: true })
      .eq('company_id', TENANT)
    if (errT) return recordProbe('08.productos', 'globalpc_productos — total + classified', 'crit', `db_error: ${errT.message}`)
    const { count: classified, error: errC } = await supabase
      .from('globalpc_productos')
      .select('cve_producto', { count: 'exact', head: true })
      .eq('company_id', TENANT)
      .not('fraccion', 'is', null)
    if (errC) return recordProbe('08.productos', 'globalpc_productos — total + classified', 'warn', `db_error: ${errC.message}`)
    const t = total ?? 0
    const c = classified ?? 0
    const pct = t > 0 ? Math.round((c / t) * 100) : 0
    const status = t === 0 ? 'warn' : pct < 80 ? 'warn' : 'ok'
    recordProbe('08.productos', 'globalpc_productos — total + classified', status,
      `${c.toLocaleString()}/${t.toLocaleString()} clasificados (${pct}%)`,
      { total: t, classified: c, pct })
  })
}

async function probeExpedientes() {
  await safeProbe('09.expedientes', 'expediente_documentos — 14d', async () => {
    const since = isoDaysAgo(14)
    const { count, error } = await supabase
      .from('expediente_documentos')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', TENANT)
      .gte('uploaded_at', since)
    if (error) return recordProbe('09.expedientes', 'expediente_documentos — 14d', 'crit', `db_error: ${error.message}`)
    const total = count ?? 0
    recordProbe('09.expedientes', 'expediente_documentos — 14d', total === 0 ? 'warn' : 'ok',
      `${total} documentos subidos 14d`, { count: total })
  })
}

async function probeEcontaCartera(clave) {
  await safeProbe('10.cartera', 'econta_cartera — saldos abiertos', async () => {
    if (!clave) {
      return recordProbe('10.cartera', 'econta_cartera — saldos abiertos', 'warn',
        'Skipped — no clave_cliente available')
    }
    const { count, error } = await supabase
      .from('econta_cartera')
      .select('scvecliente', { count: 'exact', head: true })
      .eq('scvecliente', clave)
    if (error) return recordProbe('10.cartera', 'econta_cartera — saldos abiertos', 'warn',
      `db_error: ${error.message} (econta podría no estar sincronizado)`)
    const total = count ?? 0
    recordProbe('10.cartera', 'econta_cartera — saldos abiertos', 'ok',
      `${total} registros de cartera${total === 0 ? ' (Contabilidad tile mostrará "—")' : ''}`,
      { count: total })
  })
}

async function probeEcontaFacturas(clave) {
  await safeProbe('11.facturas_econta', 'econta_facturas — 30d', async () => {
    if (!clave) {
      return recordProbe('11.facturas_econta', 'econta_facturas — 30d', 'warn',
        'Skipped — no clave_cliente available')
    }
    const since = isoDaysAgo(30)
    const { count, error } = await supabase
      .from('econta_facturas')
      .select('scveclientepropia', { count: 'exact', head: true })
      .eq('scveclientepropia', clave)
      .gte('dfechahora', since)
    if (error) return recordProbe('11.facturas_econta', 'econta_facturas — 30d', 'warn',
      `db_error: ${error.message}`)
    const total = count ?? 0
    recordProbe('11.facturas_econta', 'econta_facturas — 30d', total === 0 ? 'warn' : 'ok',
      `${total} facturas emitidas 30d`, { count: total })
  })
}

async function probeAgentDecisions() {
  await safeProbe('12.agent_decisions', 'agent_decisions — 7d', async () => {
    const since = isoDaysAgo(7)
    const { count, error } = await supabase
      .from('agent_decisions')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', TENANT)
      .gte('created_at', since)
    if (error) return recordProbe('12.agent_decisions', 'agent_decisions — 7d', 'warn',
      `db_error: ${error.message}`)
    const total = count ?? 0
    if (total === 0) {
      return recordProbe('12.agent_decisions', 'agent_decisions — 7d', 'warn',
        'Sin decisiones registradas aún — learning-loop no tendrá datos (normal si Phase 3 no está en uso)',
        { count: 0 })
    }
    // Distribution by tool_name
    const { data: rows } = await supabase
      .from('agent_decisions')
      .select('tool_name')
      .eq('company_id', TENANT)
      .gte('created_at', since)
      .limit(500)
    const dist = {}
    for (const r of rows ?? []) {
      const k = r.tool_name || '(null)'
      dist[k] = (dist[k] ?? 0) + 1
    }
    const top = Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 3)
    const summary = top.map(([k, v]) => `${k}:${v}`).join(' · ')
    recordProbe('12.agent_decisions', 'agent_decisions — 7d', 'ok',
      `${total} decisiones 7d · top: ${summary}`, { count: total, distribution: dist })
  })
}

async function probeSyncLog() {
  await safeProbe('13.sync_log', 'sync_log — última corrida por tipo', async () => {
    const { data, error } = await supabase
      .from('sync_log')
      .select('sync_type, status, completed_at')
      .order('completed_at', { ascending: false })
      .limit(100)
    if (error) return recordProbe('13.sync_log', 'sync_log — última corrida por tipo', 'warn',
      `db_error: ${error.message}`)
    const rows = data ?? []
    if (rows.length === 0) {
      return recordProbe('13.sync_log', 'sync_log — última corrida por tipo', 'warn',
        'Tabla vacía — PM2 no está registrando corridas', { count: 0 })
    }
    const latest = {}
    for (const r of rows) {
      if (!latest[r.sync_type]) latest[r.sync_type] = r
    }
    const names = Object.keys(latest).sort()
    const summary = names.slice(0, 4).map((n) => {
      const r = latest[n]
      return `${n} ${fmtRelMinutes(r.completed_at)}${r.status !== 'success' ? ` (${r.status})` : ''}`
    }).join(' · ')
    // Warn if any critical sync is stale > 90 min.
    const staleMin = 90
    const stale = names.filter((n) => {
      const r = latest[n]
      return r.completed_at && (Date.now() - new Date(r.completed_at).getTime()) / 60_000 > staleMin
    })
    const status = stale.length > 0 ? 'warn' : 'ok'
    recordProbe('13.sync_log', 'sync_log — última corrida por tipo', status,
      `${names.length} tipos rastreados · ${summary}${stale.length > 0 ? ` · ⚠ ${stale.length} sync > ${staleMin}min` : ''}`,
      { types: names.length, stale, summary })
  })
}

async function probeHeartbeat() {
  await safeProbe('14.heartbeat', 'heartbeat_log — última entrada', async () => {
    const { data, error } = await supabase
      .from('heartbeat_log')
      .select('checked_at, all_ok, pm2_ok, supabase_ok, vercel_ok, sync_ok')
      .order('checked_at', { ascending: false })
      .limit(1)
    if (error) {
      return recordProbe('14.heartbeat', 'heartbeat_log — última entrada', 'warn',
        `Tabla heartbeat_log no disponible: ${error.message.slice(0, 80)}`)
    }
    const last = data?.[0]
    if (!last) {
      return recordProbe('14.heartbeat', 'heartbeat_log — última entrada', 'warn',
        'Sin heartbeats registrados')
    }
    const status = last.all_ok ? 'ok' : 'warn'
    const flags = [
      last.pm2_ok ? '' : 'pm2✗',
      last.supabase_ok ? '' : 'supabase✗',
      last.vercel_ok ? '' : 'vercel✗',
      last.sync_ok ? '' : 'sync✗',
    ].filter(Boolean).join(' ')
    recordProbe('14.heartbeat', 'heartbeat_log — última entrada', status,
      `${fmtRelMinutes(last.checked_at)} · ${last.all_ok ? 'all_ok' : `partial: ${flags}`}`,
      { last })
  })
}

async function probeSystemConfig() {
  await safeProbe('15.system_config', 'system_config — rates vigentes', async () => {
    const keys = ['iva_rate', 'dta_rates', 'banxico_exchange_rate']
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('system_config')
      .select('key, valid_from, valid_to')
      .in('key', keys)
    if (error) return recordProbe('15.system_config', 'system_config — rates vigentes', 'warn',
      `db_error: ${error.message}`)
    const byKey = {}
    for (const row of data ?? []) {
      const prev = byKey[row.key]
      if (!prev || (row.valid_from && row.valid_from > prev.valid_from)) byKey[row.key] = row
    }
    const missing = keys.filter((k) => !byKey[k])
    const expired = keys
      .filter((k) => byKey[k] && byKey[k].valid_to && byKey[k].valid_to < today)
    const expiring = keys
      .filter((k) => byKey[k] && byKey[k].valid_to &&
        (new Date(byKey[k].valid_to).getTime() - Date.now()) / 86_400_000 < 7 &&
        byKey[k].valid_to >= today)
    let status = 'ok'
    const parts = []
    if (missing.length > 0) { status = 'crit'; parts.push(`faltan: ${missing.join(', ')}`) }
    if (expired.length > 0) { status = 'crit'; parts.push(`expirados: ${expired.join(', ')}`) }
    if (expiring.length > 0 && status === 'ok') { status = 'warn'; parts.push(`expiran < 7d: ${expiring.join(', ')}`) }
    if (parts.length === 0) parts.push(`${Object.keys(byKey).length}/${keys.length} keys vigentes`)
    recordProbe('15.system_config', 'system_config — rates vigentes', status, parts.join(' · '),
      { keys_present: Object.keys(byKey), missing, expired, expiring })
  })
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  // Resolve clave_cliente + rfc first (needed for econta + pedimentos probes)
  const { data: company } = await supabase
    .from('companies')
    .select('clave_cliente, name, active, rfc')
    .eq('company_id', TENANT)
    .maybeSingle()
  const clave = company?.clave_cliente ?? null
  const tenantRfc = company?.rfc ?? null

  await probeCompaniesRow()
  await probeTenantIdsConsistent()
  await probeTraficos()
  await probeEntradas()
  await probePedimentos(tenantRfc)
  await probeGlobalpcPartidas()
  await probeGlobalpcFacturas()
  await probeGlobalpcProductos()
  await probeExpedientes()
  await probeEcontaCartera(clave)
  await probeEcontaFacturas(clave)
  await probeAgentDecisions()
  await probeSyncLog()
  await probeHeartbeat()
  await probeSystemConfig()

  // ── Output ───────────────────────────────────────────────────
  if (ARGS.json) {
    const output = {
      tenant: TENANT,
      clave_cliente: clave,
      generated_at: new Date().toISOString(),
      probes,
      summary: {
        total: probes.length,
        ok: probes.filter((p) => p.status === 'ok').length,
        warn: probes.filter((p) => p.status === 'warn').length,
        crit: probes.filter((p) => p.status === 'crit').length,
      },
    }
    process.stdout.write(JSON.stringify(output, null, 2) + '\n')
  } else {
    const MARKER = { ok: '✓', warn: '⚠', crit: '✗' }
    const hdr = `  EVCO Integrity Audit · tenant=${TENANT} · clave=${clave ?? '—'}`
    process.stdout.write('\n' + '═'.repeat(hdr.length + 2) + '\n')
    process.stdout.write(hdr + '\n')
    process.stdout.write(`  Generado ${new Date().toISOString()}\n`)
    process.stdout.write('═'.repeat(hdr.length + 2) + '\n\n')
    for (const p of probes) {
      process.stdout.write(`  ${MARKER[p.status]} ${p.id.padEnd(20)} ${p.title}\n`)
      process.stdout.write(`      ${p.detail}\n\n`)
    }
    const okN = probes.filter((p) => p.status === 'ok').length
    const warnN = probes.filter((p) => p.status === 'warn').length
    const critN = probes.filter((p) => p.status === 'crit').length
    process.stdout.write(`  ─ RESUMEN · ${okN} ok · ${warnN} warn · ${critN} crit ─\n\n`)
  }

  const critCount = probes.filter((p) => p.status === 'crit').length
  process.exit(critCount > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[audit] fatal:', err)
  process.exit(1)
})
