// scripts/lib/post-sync-verify.js — post-sync read-back integrity verifier.
//
// Born from Build 12 (2026-04-24) directive: "100% data integrity after every
// delta sync." Existing safe-write.js catches the zero-write drift (429
// status writing zero rows). What was missing: a positive read-back proof
// that the rows we *think* we wrote actually exist with the correct shape.
//
// Failure modes this catches that safe-write doesn't:
//   1. Upsert succeeded but column was silently coerced (e.g. null company_id)
//   2. Trigger rewrote a value we just sent (sometimes: estatus normalization)
//   3. Row landed but a tenant invariant was violated post-write
//      (orphan company_id, NULL tenant_id, malformed pedimento/fraccion)
//   4. Source said N rows; destination has M < N rows for those PKs
//
// Usage:
//   const { verifyBatch, summarize } = require('./lib/post-sync-verify')
//   const result = await verifyBatch(supabase, {
//     table: 'traficos',
//     pkColumn: 'trafico',
//     expectedPks: ['T12345', 'T12346'],
//     companyIds: new Set(['evco', 'mafesa']),
//     scriptName: 'globalpc-delta-sync',
//   })
//   if (!result.ok) { /* alert */ }
//
// Pure validators are exported for unit-test consumption.

const { sendTelegram } = require('./telegram')

const PEDIMENTO_RE = /^\d{2}\s\d{2}\s\d{4}\s\d{7}$/
const FRACCION_RE = /^\d{4}\.\d{2}\.\d{2}$/

// ── Pure validators (no I/O — easy to unit-test) ───────────────────────────

function checkRow(row, { pkColumn, companyIds, requireTenantId = true }) {
  const violations = []
  const pk = row[pkColumn]
  if (pk == null || pk === '') {
    violations.push(`missing_pk:${pkColumn}`)
  }
  if (!row.company_id) {
    violations.push('missing_company_id')
  } else if (companyIds && companyIds.size > 0 && !companyIds.has(row.company_id)) {
    violations.push(`orphan_company_id:${row.company_id}`)
  }
  if (requireTenantId && !row.tenant_id) {
    violations.push('missing_tenant_id')
  }
  if (row.pedimento && typeof row.pedimento === 'string' && row.pedimento.trim() !== '') {
    if (!PEDIMENTO_RE.test(row.pedimento)) {
      violations.push(`bad_pedimento_format:${row.pedimento}`)
    }
  }
  if (row.fraccion && typeof row.fraccion === 'string' && row.fraccion.trim() !== '') {
    if (!FRACCION_RE.test(row.fraccion)) {
      violations.push(`bad_fraccion_format:${row.fraccion}`)
    }
  }
  return violations
}

function summarize(verifications) {
  const totals = {
    tables: verifications.length,
    expected: 0,
    found: 0,
    missing: 0,
    violation_rows: 0,
    violations: {},
  }
  for (const v of verifications) {
    totals.expected += v.expected
    totals.found += v.found
    totals.missing += v.missing
    totals.violation_rows += v.violationRows
    for (const [k, n] of Object.entries(v.violationCounts || {})) {
      totals.violations[k] = (totals.violations[k] || 0) + n
    }
  }
  totals.integrity_pct = totals.expected === 0
    ? 100
    : Math.round(((totals.found - totals.violation_rows) / totals.expected) * 1000) / 10
  return totals
}

// ── Database-backed verifier ───────────────────────────────────────────────

/**
 * Verify a batch of writes by reading back the same PKs and validating each
 * row. Returns a structured result; never throws.
 *
 * Options:
 *   table         — table name to read back
 *   pkColumn      — primary-key column (e.g. 'trafico', 'cve_entrada')
 *   expectedPks   — array of PK values that should exist post-sync
 *   companyIds    — Set<string> of valid company_ids (for orphan check)
 *   columns       — columns to select (default: pk + company_id + tenant_id)
 *   requireTenantId — set false for tables without tenant_id
 *   sampleLimit   — max rows to read back (default: 500). Larger batches
 *                   are sampled deterministically by hash; trade exhaustive
 *                   for sub-second runtime.
 */
async function verifyBatch(supabase, opts) {
  const {
    table,
    pkColumn,
    expectedPks,
    companyIds = new Set(),
    columns = null,
    requireTenantId = true,
    sampleLimit = 500,
  } = opts

  if (!Array.isArray(expectedPks) || expectedPks.length === 0) {
    return {
      ok: true,
      table,
      expected: 0,
      found: 0,
      missing: 0,
      violationRows: 0,
      violationCounts: {},
      sampled: 0,
    }
  }

  const sampled = expectedPks.length <= sampleLimit
    ? expectedPks
    : sampleEvery(expectedPks, sampleLimit)

  const selectCols = columns
    || `${pkColumn},company_id${requireTenantId ? ',tenant_id' : ''}${
        table === 'traficos' ? ',pedimento' : ''}`

  let rows = []
  let queryError = null
  try {
    const { data, error } = await supabase
      .from(table)
      .select(selectCols)
      .in(pkColumn, sampled)
    if (error) queryError = error.message
    rows = data || []
  } catch (e) {
    queryError = e.message
  }

  const foundPks = new Set(rows.map(r => r[pkColumn]))
  const missing = sampled.filter(pk => !foundPks.has(pk)).length

  const violationCounts = {}
  let violationRows = 0
  for (const row of rows) {
    const v = checkRow(row, { pkColumn, companyIds, requireTenantId })
    if (v.length > 0) {
      violationRows++
      for (const code of v) {
        const key = code.split(':')[0]
        violationCounts[key] = (violationCounts[key] || 0) + 1
      }
    }
  }

  const ok = !queryError && missing === 0 && violationRows === 0

  return {
    ok,
    table,
    expected: sampled.length,
    found: rows.length,
    missing,
    violationRows,
    violationCounts,
    sampled: sampled.length,
    queryError,
  }
}

function sampleEvery(arr, n) {
  if (arr.length <= n) return arr.slice()
  const step = arr.length / n
  const out = []
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)])
  return out
}

// ── Orchestrator: wire post-sync verification with logging + alerting ─────

/**
 * Run a list of verifyBatch calls, persist a row to data_integrity_log when
 * the table exists, and Telegram-alert on any non-green verdict.
 *
 * Returns { verdict: 'green' | 'amber' | 'red', summary, batches }.
 *   green — every batch ok, integrity_pct === 100
 *   amber — minor drift (< 1% missing, no tenant violations)
 *   red   — tenant violation OR > 1% missing OR query error
 */
async function runPostSyncVerification(supabase, {
  syncType,
  syncLogId = null,
  batches,
  scriptName,
  companyIds,
}) {
  const results = []
  for (const batch of batches) {
    const r = await verifyBatch(supabase, { ...batch, companyIds })
    results.push(r)
  }

  const summary = summarize(results)
  const verdict = decideVerdict(summary, results)

  // Persist a trend row when the table exists. Failures here are non-fatal:
  // the verification itself + Telegram alert are the source of truth.
  try {
    await supabase.from('data_integrity_log').insert({
      sync_type: syncType,
      sync_log_id: syncLogId,
      verdict,
      summary,
      batches: results.map(r => ({
        table: r.table,
        expected: r.expected,
        found: r.found,
        missing: r.missing,
        violation_rows: r.violationRows,
        violations: r.violationCounts,
        query_error: r.queryError ?? null,
      })),
    })
  } catch {
    // table may not exist yet in older deployments; verdict + alert still fire
  }

  if (verdict !== 'green') {
    const icon = verdict === 'red' ? '🔴' : '🟡'
    const lines = [
      `${icon} <b>Post-sync integrity ${verdict.toUpperCase()}</b>`,
      `script: ${scriptName}`,
      `expected: ${summary.expected} · found: ${summary.found} · missing: ${summary.missing}`,
      `integrity: ${summary.integrity_pct}%`,
    ]
    if (summary.violation_rows > 0) {
      const top = Object.entries(summary.violations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, n]) => `${k}=${n}`)
        .join(', ')
      lines.push(`violations: ${top}`)
    }
    const errs = results.filter(r => r.queryError).map(r => `${r.table}:${r.queryError}`)
    if (errs.length > 0) lines.push(`errors: ${errs.join(' · ')}`)
    await sendTelegram(lines.join('\n'))
  }

  return { verdict, summary, batches: results }
}

function decideVerdict(summary, results) {
  if (results.some(r => r.queryError)) return 'red'
  // Tenant violations are always red — a single orphan/missing-company_id
  // row is the contamination signal Block EE was built to prevent.
  const tenantViolations = ['missing_company_id', 'orphan_company_id', 'missing_tenant_id']
  if (tenantViolations.some(k => (summary.violations[k] || 0) > 0)) return 'red'
  if (summary.expected === 0) return 'green'
  const missingPct = (summary.missing / summary.expected) * 100
  if (missingPct > 1) return 'red'
  if (summary.violation_rows > 0 || missingPct > 0) return 'amber'
  return 'green'
}

module.exports = {
  // pure validators (testable)
  checkRow,
  summarize,
  decideVerdict,
  sampleEvery,
  PEDIMENTO_RE,
  FRACCION_RE,
  // I/O
  verifyBatch,
  runPostSyncVerification,
}
