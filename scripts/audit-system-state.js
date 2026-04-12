#!/usr/bin/env node
/**
 * ADUANA System State Auditor
 * Generates a comprehensive markdown snapshot of the entire system state.
 * Output: ~/evco-portal/docs/SYSTEM_STATE.md
 *
 * Read-only on the database. SELECT queries only.
 * Each section is independent — one section crashing does not prevent others.
 *
 * Usage: node scripts/audit-system-state.js
 * Patente 3596 · Aduana 240
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const REPO_ROOT = path.resolve(__dirname, '..')
const OUTPUT_PATH = path.join(REPO_ROOT, 'docs', 'SYSTEM_STATE.md')
const PREVIOUS_PATH = path.join(REPO_ROOT, 'docs', 'SYSTEM_STATE.previous.md')
const SCRIPTS_DIR = path.join(REPO_ROOT, 'scripts')
const SCRIPTS_LIB_DIR = path.join(SCRIPTS_DIR, 'lib')
const ARCHIVE_DIR = path.join(SCRIPTS_DIR, 'archive')

// ── Helpers ──

function runCmd(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 15000, ...opts }).trim()
  } catch (e) {
    return opts.fallback !== undefined ? opts.fallback : `(command failed: ${e.message.split('\n')[0]})`
  }
}

function formatTimestamp(date) {
  const utc = date.toISOString()
  const chicago = date.toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'full', timeStyle: 'long' })
  return `${utc} (UTC) / ${chicago} (Laredo)`
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ago24h() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

function ago7d() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
}

function ago30d() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
}

function ago1h() {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString()
}

function todayMidnightUTC() {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

async function safeCount(table) {
  try {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) return { total: null, error: error.message }
    return { total: count }
  } catch (e) {
    return { total: null, error: e.message }
  }
}

async function safeCountSince(table, since, dateCol = 'created_at') {
  try {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).gte(dateCol, since)
    if (error) return null
    return count
  } catch {
    return null
  }
}

// ── Section builders ──

async function buildSection1() {
  const now = new Date()
  const hostname = os.hostname()
  const branch = runCmd('git rev-parse --abbrev-ref HEAD')
  const commitHash = runCmd('git rev-parse --short HEAD')
  const uncommitted = runCmd('git status --porcelain | wc -l').trim()

  return {
    text: `## Section 1 — Header\n\n` +
      `| Field | Value |\n|---|---|\n` +
      `| Generated | ${formatTimestamp(now)} |\n` +
      `| Hostname | ${hostname} |\n` +
      `| Git branch | \`${branch}\` |\n` +
      `| Last commit | \`${commitHash}\` |\n` +
      `| Uncommitted files | ${uncommitted} |\n`,
    data: { branch, commitHash, uncommitted: parseInt(uncommitted) || 0 }
  }
}

async function buildSection2() {
  const tables = [
    'traficos', 'entradas', 'globalpc_productos', 'globalpc_proveedores',
    'partidas', 'oca_database', 'api_cost_log', 'workflow_events',
    'workflow_chains', 'operational_decisions', 'job_runs'
  ]

  const since24h = ago24h()
  const results = {}
  let totalRows = 0
  let tableCount = 0

  let lines = `## Section 2 — Database State\n\n`
  lines += `| Table | Total Rows | Last 24h |\n|---|---|---|\n`

  for (const table of tables) {
    const { total, error } = await safeCount(table)
    if (error) {
      lines += `| ${table} | NOT FOUND | — |\n`
      results[table] = { total: null, error }
      continue
    }
    const recent = await safeCountSince(table, since24h)
    lines += `| ${table} | ${(total || 0).toLocaleString()} | ${recent !== null ? `+${recent}` : 'N/A'} |\n`
    results[table] = { total: total || 0, recent24h: recent }
    totalRows += total || 0
    tableCount++
  }

  // globalpc_productos breakdown
  lines += `\n### globalpc_productos Breakdown\n\n`
  try {
    const { count: withFraccion } = await supabase.from('globalpc_productos').select('*', { count: 'exact', head: true }).not('fraccion', 'is', null)
    const { count: aiClassified } = await supabase.from('globalpc_productos').select('*', { count: 'exact', head: true }).eq('fraccion_source', 'ai_auto_classifier')
    const { count: legacyPriors } = await supabase.from('globalpc_productos').select('*', { count: 'exact', head: true }).not('fraccion', 'is', null).is('fraccion_source', null)

    lines += `| Metric | Count |\n|---|---|\n`
    lines += `| fraccion IS NOT NULL | ${(withFraccion || 0).toLocaleString()} |\n`
    lines += `| fraccion_source = 'ai_auto_classifier' | ${(aiClassified || 0).toLocaleString()} |\n`
    lines += `| Legacy priors (fraccion NOT NULL, source IS NULL) | ${(legacyPriors || 0).toLocaleString()} |\n`

    // Distinct fraccion_source values
    const { data: sources } = await supabase.from('globalpc_productos').select('fraccion_source').not('fraccion_source', 'is', null).limit(1000)
    if (sources && sources.length > 0) {
      const sourceCounts = {}
      for (const row of sources) {
        const s = row.fraccion_source || 'null'
        sourceCounts[s] = (sourceCounts[s] || 0) + 1
      }
      lines += `\n**fraccion_source distribution (sample):**\n\n`
      lines += `| Source | Count |\n|---|---|\n`
      for (const [src, count] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
        lines += `| ${src} | ${count} |\n`
      }
    }
    results._productos_breakdown = { withFraccion, aiClassified, legacyPriors }
  } catch (e) {
    lines += `(globalpc_productos breakdown failed: ${e.message})\n`
  }

  // workflow_events breakdown
  lines += `\n### workflow_events Breakdown\n\n`
  try {
    const statuses = ['pending', 'processing', 'completed', 'failed', 'dead_letter']
    lines += `| Status | Count |\n|---|---|\n`
    const statusCounts = {}
    for (const status of statuses) {
      const { count } = await supabase.from('workflow_events').select('*', { count: 'exact', head: true }).eq('status', status)
      lines += `| ${status} | ${(count || 0).toLocaleString()} |\n`
      statusCounts[status] = count || 0
    }

    // Top 10 event_type
    const { data: eventTypes } = await supabase.from('workflow_events').select('event_type').limit(1000)
    if (eventTypes && eventTypes.length > 0) {
      const typeCounts = {}
      for (const row of eventTypes) {
        const t = row.event_type || 'unknown'
        typeCounts[t] = (typeCounts[t] || 0) + 1
      }
      const top10 = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      lines += `\n**Top 10 event_type:**\n\n| Event Type | Count |\n|---|---|\n`
      for (const [type, count] of top10) {
        lines += `| ${type} | ${count} |\n`
      }
    }

    // Events in last 24h
    const events24h = await safeCountSince('workflow_events', since24h)
    lines += `\n- Events in last 24h: ${events24h ?? 'N/A'}\n`

    // Failed in last 7d
    const { count: failed7d } = await supabase.from('workflow_events').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', ago7d())
    lines += `- Failed events in last 7 days: ${failed7d || 0}\n`

    // Stuck events (pending > 1 hour)
    const { count: stuck } = await supabase.from('workflow_events').select('*', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', ago1h())
    lines += `- Stuck events (pending > 1h): ${stuck || 0}\n`

    results._workflow_events = { statusCounts, events24h, failed7d, stuck }
  } catch (e) {
    lines += `(workflow_events breakdown failed: ${e.message})\n`
  }

  // traficos breakdown
  lines += `\n### traficos Breakdown\n\n`
  try {
    const { data: companies } = await supabase.from('traficos').select('company_id').limit(5000)
    if (companies && companies.length > 0) {
      const compCounts = {}
      for (const row of companies) {
        const c = row.company_id || 'null'
        compCounts[c] = (compCounts[c] || 0) + 1
      }
      const top10 = Object.entries(compCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
      lines += `| company_id | Count |\n|---|---|\n`
      for (const [cid, count] of top10) {
        lines += `| ${cid} | ${count} |\n`
      }
      lines += `\nDistinct company_id values: ${Object.keys(compCounts).length}\n`
    }
  } catch (e) {
    lines += `(traficos breakdown failed: ${e.message})\n`
  }

  return { text: lines, data: { results, totalRows, tableCount } }
}

async function buildSection3() {
  let lines = `## Section 3 — PM2 Fleet State\n\n`
  let pm2Data = []

  try {
    const raw = runCmd('pm2 jlist 2>/dev/null', { fallback: '[]' })
    pm2Data = JSON.parse(raw)
  } catch (e) {
    lines += `(pm2 jlist parse failed: ${e.message})\n`
    return { text: lines, data: { processes: [], online: 0, total: 0 } }
  }

  if (pm2Data.length === 0) {
    lines += `No PM2 processes found.\n`
    return { text: lines, data: { processes: [], online: 0, total: 0 } }
  }

  lines += `| Name | Status | Script | Cron | Restarts | Memory | CPU | Uptime |\n`
  lines += `|---|---|---|---|---|---|---|---|\n`

  const flags = []
  let onlineCount = 0

  for (const p of pm2Data) {
    const name = p.name || 'unknown'
    const status = p.pm2_env?.status || 'unknown'
    const execPath = p.pm2_env?.pm_exec_path || p.pm_exec_path || ''
    const cron = p.pm2_env?.cron_restart || '—'
    const restarts = p.pm2_env?.restart_time || 0
    const mem = p.monit?.memory ? formatBytes(p.monit.memory) : '—'
    const cpu = p.monit?.cpu !== undefined ? `${p.monit.cpu}%` : '—'
    const uptime = p.pm2_env?.pm_uptime ? new Date(p.pm2_env.pm_uptime).toISOString() : '—'
    const shortPath = execPath.replace(REPO_ROOT + '/', '').replace(os.homedir() + '/', '~/')

    if (status === 'online') onlineCount++

    lines += `| ${name} | ${status} | ${shortPath} | ${cron} | ${restarts} | ${mem} | ${cpu} | ${uptime} |\n`

    // Flag checks
    if (execPath && !fs.existsSync(execPath)) {
      flags.push(`PHANTOM: \`${name}\` points to \`${shortPath}\` which does not exist`)
    }
    if (restarts > 5) {
      flags.push(`CRASH LOOP: \`${name}\` has ${restarts} restarts`)
    }
    if (status === 'errored') {
      flags.push(`ERRORED: \`${name}\` is in errored state`)
    }
  }

  if (flags.length > 0) {
    lines += `\n### Flags\n\n`
    for (const f of flags) {
      lines += `- ${f}\n`
    }
  }

  return { text: lines, data: { processes: pm2Data.map(p => p.name), online: onlineCount, total: pm2Data.length, flags } }
}

async function buildSection4() {
  let lines = `## Section 4 — Crontab State\n\n`

  const crontab = runCmd('crontab -l 2>/dev/null', { fallback: '' })
  if (!crontab) {
    lines += `No crontab entries found.\n`
    return { text: lines, data: { entries: [] } }
  }

  const entries = []
  const crontabLines = crontab.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('PATH=') && !l.startsWith('SHELL='))

  lines += `| Schedule | Command | Script Exists |\n|---|---|---|\n`

  for (const line of crontabLines) {
    // Parse crontab: first 5 fields are schedule, rest is command
    const parts = line.trim().split(/\s+/)
    if (parts.length < 6) continue
    const schedule = parts.slice(0, 5).join(' ')
    const command = parts.slice(5).join(' ')

    // Check if it references a script file
    let scriptExists = '—'
    const nodeMatch = command.match(/node\s+(\S+\.js)/)
    if (nodeMatch) {
      const scriptPath = nodeMatch[1]
      const fullPath = path.isAbsolute(scriptPath) ? scriptPath : path.resolve(REPO_ROOT, scriptPath)
      scriptExists = fs.existsSync(fullPath) ? 'YES' : 'MISSING'
    }

    const shortCmd = command.length > 80 ? command.slice(0, 77) + '...' : command
    lines += `| \`${schedule}\` | \`${shortCmd}\` | ${scriptExists} |\n`
    entries.push({ schedule, command, scriptExists })
  }

  const missing = entries.filter(e => e.scriptExists === 'MISSING')
  if (missing.length > 0) {
    lines += `\n### Missing Scripts\n\n`
    for (const m of missing) {
      lines += `- \`${m.command}\`\n`
    }
  }

  return { text: lines, data: { entries } }
}

async function buildSection5(pm2Data, crontabData) {
  let lines = `## Section 5 — Script Inventory\n\n`

  // Gather all .js files in scripts/ and scripts/lib/, excluding archive/
  const allScripts = []

  function scanDir(dir, prefix = '') {
    if (!fs.existsSync(dir)) return
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()
    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)
      const relativePath = prefix ? `${prefix}/${file}` : file

      // Read first 3 non-blank lines for header
      let headerLines = []
      try {
        const content = fs.readFileSync(fullPath, 'utf8')
        const contentLines = content.split('\n')
        let count = 0
        for (const line of contentLines) {
          const trimmed = line.trim()
          if (trimmed && count < 5) {
            // Skip shebang
            if (trimmed.startsWith('#!')) continue
            // Strip comment markers
            const clean = trimmed.replace(/^\/\/\s*/, '').replace(/^\*\s*/, '').replace(/^\/\*\*?\s*/, '').replace(/\*\/\s*$/, '')
            if (clean && !clean.match(/^[=─\-]+$/)) {
              headerLines.push(clean)
              count++
              if (count >= 3) break
            }
          }
        }
      } catch { /* best effort */ }

      allScripts.push({
        file: relativePath,
        fullPath,
        modified: stat.mtime,
        size: stat.size,
        header: headerLines.join(' | '),
      })
    }
  }

  scanDir(SCRIPTS_DIR)
  scanDir(SCRIPTS_LIB_DIR, 'lib')

  // Cross-reference for classification
  const pm2Paths = new Set()
  if (pm2Data && pm2Data.processes) {
    // Re-parse pm2 jlist for exec paths
    try {
      const raw = runCmd('pm2 jlist 2>/dev/null', { fallback: '[]' })
      const procs = JSON.parse(raw)
      for (const p of procs) {
        const execPath = p.pm2_env?.pm_exec_path || p.pm_exec_path || ''
        if (execPath) pm2Paths.add(execPath)
      }
    } catch { /* ignore */ }
  }

  const crontabCommands = (crontabData?.entries || []).map(e => e.command).join('\n')

  // Read package.json scripts
  let pkgScripts = {}
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'))
    pkgScripts = pkg.scripts || {}
  } catch { /* ignore */ }
  const pkgScriptValues = Object.values(pkgScripts).join('\n')

  // Check which scripts are archived
  const archivedFiles = new Set()
  if (fs.existsSync(ARCHIVE_DIR)) {
    for (const f of fs.readdirSync(ARCHIVE_DIR)) {
      archivedFiles.add(f)
    }
  }

  // Classify each script
  const counts = { PM2: 0, CRONTAB: 0, NPM_SCRIPT: 0, GHOST: 0, ARCHIVED: 0 }

  for (const s of allScripts) {
    const basename = path.basename(s.file)
    if (archivedFiles.has(basename)) {
      s.classification = 'ARCHIVED'
    } else if (pm2Paths.has(s.fullPath)) {
      s.classification = 'PM2'
    } else if (crontabCommands.includes(basename)) {
      s.classification = 'CRONTAB'
    } else if (pkgScriptValues.includes(basename)) {
      s.classification = 'NPM_SCRIPT'
    } else {
      s.classification = 'GHOST'
    }
    counts[s.classification]++
  }

  // Sort by classification then name
  const classOrder = { PM2: 0, CRONTAB: 1, NPM_SCRIPT: 2, GHOST: 3, ARCHIVED: 4 }
  allScripts.sort((a, b) => (classOrder[a.classification] - classOrder[b.classification]) || a.file.localeCompare(b.file))

  lines += `| File | Class | Size | Modified | Header |\n|---|---|---|---|---|\n`
  for (const s of allScripts) {
    const modDate = s.modified.toISOString().slice(0, 10)
    const header = s.header.length > 60 ? s.header.slice(0, 57) + '...' : s.header
    lines += `| ${s.file} | ${s.classification} | ${formatBytes(s.size)} | ${modDate} | ${header} |\n`
  }

  lines += `\n### Summary\n\n`
  lines += `- **Total:** ${allScripts.length}\n`
  lines += `- **PM2:** ${counts.PM2}\n`
  lines += `- **Crontab:** ${counts.CRONTAB}\n`
  lines += `- **NPM Scripts:** ${counts.NPM_SCRIPT}\n`
  lines += `- **Ghost:** ${counts.GHOST}\n`
  lines += `- **Archived:** ${counts.ARCHIVED}\n`

  return {
    text: lines,
    data: { total: allScripts.length, counts, scripts: allScripts.map(s => ({ file: s.file, classification: s.classification })) }
  }
}

async function buildSection6() {
  let lines = `## Section 6 — Workflow Handler State\n\n`

  // Read workflow-processor.js and extract handlers
  const processorPath = path.join(SCRIPTS_DIR, 'workflow-processor.js')
  if (!fs.existsSync(processorPath)) {
    lines += `(workflow-processor.js not found)\n`
    return { text: lines, data: {} }
  }

  const content = fs.readFileSync(processorPath, 'utf8')
  const contentLines = content.split('\n')

  // Extract handler keys by looking for lines like 'workflow.event_type': async
  const handlers = []
  let currentHandler = null
  let handlerBodyLines = []
  let braceDepth = 0
  let inHandler = false

  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i]

    // Detect handler registration: 'key': async (event) =>
    const handlerMatch = line.match(/^\s*'([a-z_]+\.[a-z_]+)'\s*:\s*async\s*\(/)
    if (handlerMatch) {
      // Save previous handler
      if (currentHandler) {
        handlers.push({ key: currentHandler, body: handlerBodyLines.join('\n') })
      }
      currentHandler = handlerMatch[1]
      handlerBodyLines = [line]
      inHandler = true
      continue
    }

    if (inHandler) {
      handlerBodyLines.push(line)
      // Detect end of handler block (next top-level key or end of HANDLERS object)
      if (line.match(/^\s*'[a-z_]+\.[a-z_]+'\s*:\s*async/) || line.match(/^const\s/) || line.match(/^\/\/\s*═/)) {
        // We've hit the next handler or end of dispatch table
        handlers.push({ key: currentHandler, body: handlerBodyLines.slice(0, -1).join('\n') })
        currentHandler = null
        handlerBodyLines = []
        inHandler = false
        // Re-check this line for a new handler
        const recheck = line.match(/^\s*'([a-z_]+\.[a-z_]+)'\s*:\s*async\s*\(/)
        if (recheck) {
          currentHandler = recheck[1]
          handlerBodyLines = [line]
          inHandler = true
        }
      }
    }
  }
  // Flush last handler
  if (currentHandler) {
    handlers.push({ key: currentHandler, body: handlerBodyLines.join('\n') })
  }

  // Classify each handler
  for (const h of handlers) {
    const body = h.body
    const parts = h.key.split('.')
    h.workflow = parts[0]
    h.eventType = parts[1]

    // Heuristics for classification
    const hasRequire = body.includes('require(')
    const hasSpawn = body.includes('spawn(') || body.includes('exec(')
    const hasSupabaseWrite = body.includes('.insert(') || body.includes('.update(') || body.includes('.upsert(')
    const hasEmitEvent = body.includes('emitEvent(')
    const hasTelegram = body.includes('tg(') || body.includes('sendTelegram(')
    const isTrivialReturn = body.match(/return\s*\{\s*success:\s*true,?\s*result:/) && !hasSupabaseWrite && !hasEmitEvent && !hasRequire && !hasSpawn && !hasTelegram
    const hasThrowNotImpl = body.includes("throw new Error('not implemented')")

    if (hasThrowNotImpl) {
      h.classification = 'TODO'
    } else if ((hasRequire || hasSpawn || hasSupabaseWrite || hasEmitEvent) && !isTrivialReturn) {
      h.classification = 'REAL'
    } else {
      h.classification = 'STUB'
    }
  }

  // Check which handlers have fired in last 7 days
  const since7d = ago7d()
  for (const h of handlers) {
    try {
      const { count } = await supabase.from('workflow_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', h.eventType)
        .eq('workflow', h.workflow)
        .eq('status', 'completed')
        .gte('created_at', since7d)
      h.firedLast7d = count || 0
    } catch {
      h.firedLast7d = null
    }
  }

  lines += `| Handler Key | Class | Fired (7d) |\n|---|---|---|\n`
  for (const h of handlers) {
    lines += `| ${h.key} | ${h.classification} | ${h.firedLast7d !== null ? h.firedLast7d : '?'} |\n`
  }

  const realCount = handlers.filter(h => h.classification === 'REAL').length
  const stubCount = handlers.filter(h => h.classification === 'STUB').length
  const todoCount = handlers.filter(h => h.classification === 'TODO').length

  lines += `\n### Summary\n\n`
  lines += `- Total handlers: ${handlers.length}\n`
  lines += `- REAL: ${realCount}\n`
  lines += `- STUB: ${stubCount}\n`
  lines += `- TODO: ${todoCount}\n`

  // Check workflow_chains for gaps (event types with no handler)
  try {
    const { data: chains } = await supabase.from('workflow_chains').select('*').limit(100)
    if (chains && chains.length > 0) {
      const handlerKeys = new Set(handlers.map(h => h.key))
      const gaps = []
      for (const chain of chains) {
        const targetKey = `${chain.target_workflow}.${chain.target_event}`
        if (!handlerKeys.has(targetKey)) {
          gaps.push(targetKey)
        }
      }
      if (gaps.length > 0) {
        lines += `\n### Chain Gaps (no handler registered)\n\n`
        for (const g of gaps) {
          lines += `- \`${g}\`\n`
        }
      }
    }
  } catch (e) {
    lines += `\n(workflow_chains gap check failed: ${e.message})\n`
  }

  return {
    text: lines,
    data: { total: handlers.length, real: realCount, stub: stubCount, todo: todoCount, handlers: handlers.map(h => ({ key: h.key, classification: h.classification })) }
  }
}

async function buildSection7() {
  let lines = `## Section 7 — AI Cost and Classification State\n\n`

  // api_cost_log totals
  lines += `### API Cost\n\n`
  try {
    const periods = [
      { label: 'Last 24h', since: ago24h() },
      { label: 'Last 7 days', since: ago7d() },
      { label: 'Last 30 days', since: ago30d() },
    ]

    lines += `| Period | Cost (USD) | Calls |\n|---|---|---|\n`

    let cost24h = 0
    let calls24h = 0

    for (const p of periods) {
      const { data, error } = await supabase.from('api_cost_log')
        .select('cost_usd')
        .gte('created_at', p.since)
      if (error) {
        lines += `| ${p.label} | error | — |\n`
        continue
      }
      const totalCost = (data || []).reduce((sum, r) => sum + (parseFloat(r.cost_usd) || 0), 0)
      lines += `| ${p.label} | $${totalCost.toFixed(4)} | ${(data || []).length} |\n`
      if (p.label === 'Last 24h') {
        cost24h = totalCost
        calls24h = (data || []).length
      }
    }

    // All-time
    const { data: allTime } = await supabase.from('api_cost_log').select('cost_usd').limit(10000)
    const allTimeCost = (allTime || []).reduce((sum, r) => sum + (parseFloat(r.cost_usd) || 0), 0)
    lines += `| All-time | $${allTimeCost.toFixed(4)} | ${(allTime || []).length} |\n`

    // Top 5 most expensive calls in last 7d
    const { data: expensive } = await supabase.from('api_cost_log')
      .select('*')
      .gte('created_at', ago7d())
      .order('cost_usd', { ascending: false })
      .limit(5)

    if (expensive && expensive.length > 0) {
      lines += `\n**Top 5 most expensive calls (7d):**\n\n`
      lines += `| Cost | Model | Action | Timestamp |\n|---|---|---|---|\n`
      for (const row of expensive) {
        lines += `| $${parseFloat(row.cost_usd || 0).toFixed(4)} | ${row.model || '—'} | ${row.action || '—'} | ${row.created_at || '—'} |\n`
      }
    }

    lines += `\n### AI Classifications Today\n\n`
    const todayUTC = todayMidnightUTC()
    // Classifications written today
    try {
      const { count: classifiedToday } = await supabase.from('globalpc_productos')
        .select('*', { count: 'exact', head: true })
        .gte('fraccion_classified_at', todayUTC)
      lines += `- Classifications written today: ${classifiedToday || 0}\n`

      // Top 5 suppliers by classification count today
      const { data: todayRows } = await supabase.from('globalpc_productos')
        .select('cve_proveedor')
        .gte('fraccion_classified_at', todayUTC)
        .limit(500)
      if (todayRows && todayRows.length > 0) {
        const supplierCounts = {}
        for (const row of todayRows) {
          const s = row.cve_proveedor || 'unknown'
          supplierCounts[s] = (supplierCounts[s] || 0) + 1
        }
        const top5 = Object.entries(supplierCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
        lines += `\n**Top 5 suppliers by classification count today:**\n\n`
        lines += `| Supplier | Count |\n|---|---|\n`
        for (const [sup, count] of top5) {
          lines += `| ${sup} | ${count} |\n`
        }
      }
    } catch (e) {
      lines += `(classification breakdown failed: ${e.message})\n`
    }

    return { text: lines, data: { cost24h, calls24h } }
  } catch (e) {
    lines += `(Section 7 failed: ${e.message})\n`
    return { text: lines, data: { cost24h: 0, calls24h: 0 } }
  }
}

async function buildSection8(pm2DataRaw) {
  let lines = `## Section 8 — Recent Failures and Silent Errors\n\n`
  let healthIssues = []

  // workflow_events failures
  lines += `### Workflow Failures\n\n`
  try {
    const { count: failed24h } = await supabase.from('workflow_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', ago24h())
    const { count: deadLetterAll } = await supabase.from('workflow_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'dead_letter')
    const { count: stuck } = await supabase.from('workflow_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('created_at', ago1h())

    lines += `| Metric | Count |\n|---|---|\n`
    lines += `| Failed (24h) | ${failed24h || 0} |\n`
    lines += `| Dead letter (all time) | ${deadLetterAll || 0} |\n`
    lines += `| Stuck (pending > 1h) | ${stuck || 0} |\n`

    if (failed24h > 0) healthIssues.push(`${failed24h} failed workflow events in 24h`)
    if (deadLetterAll > 0) healthIssues.push(`${deadLetterAll} dead letter events`)
    if (stuck > 100) healthIssues.push(`${stuck} stuck events (CRITICAL)`)
    else if (stuck > 0) healthIssues.push(`${stuck} stuck events`)

    // Recent failed events
    const { data: recentFailed } = await supabase.from('workflow_events')
      .select('id, event_type, workflow, error_message, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5)
    if (recentFailed && recentFailed.length > 0) {
      lines += `\n**Recent failed events:**\n\n`
      lines += `| ID | Type | Error | When |\n|---|---|---|---|\n`
      for (const r of recentFailed) {
        const err = (r.error_message || '—').slice(0, 60)
        lines += `| ${r.id} | ${r.workflow}.${r.event_type} | ${err} | ${r.created_at} |\n`
      }
    }

    // Recent dead letters
    const { data: recentDL } = await supabase.from('workflow_events')
      .select('id, event_type, workflow, error_message, created_at')
      .eq('status', 'dead_letter')
      .order('created_at', { ascending: false })
      .limit(5)
    if (recentDL && recentDL.length > 0) {
      lines += `\n**Recent dead letter events:**\n\n`
      lines += `| ID | Type | Error | When |\n|---|---|---|---|\n`
      for (const r of recentDL) {
        const err = (r.error_message || '—').slice(0, 60)
        lines += `| ${r.id} | ${r.workflow}.${r.event_type} | ${err} | ${r.created_at} |\n`
      }
    }

    // Recent stuck events
    const { data: recentStuck } = await supabase.from('workflow_events')
      .select('id, event_type, workflow, created_at')
      .eq('status', 'pending')
      .lt('created_at', ago1h())
      .order('created_at', { ascending: false })
      .limit(5)
    if (recentStuck && recentStuck.length > 0) {
      lines += `\n**Stuck events (pending > 1h):**\n\n`
      lines += `| ID | Type | Created At |\n|---|---|---|\n`
      for (const r of recentStuck) {
        lines += `| ${r.id} | ${r.workflow}.${r.event_type} | ${r.created_at} |\n`
      }
    }
  } catch (e) {
    lines += `(workflow failure check failed: ${e.message})\n`
  }

  // job_runs failures
  lines += `\n### Job Run Failures\n\n`
  try {
    const { count: jobFailed24h } = await supabase.from('job_runs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failure')
      .gte('started_at', ago24h())
    const { count: staleRunning } = await supabase.from('job_runs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'running')
      .lt('started_at', ago1h())

    lines += `- Failed jobs (24h): ${jobFailed24h || 0}\n`
    lines += `- Stale running jobs (started > 1h ago): ${staleRunning || 0}\n`

    if (jobFailed24h > 0) healthIssues.push(`${jobFailed24h} failed jobs in 24h`)
    if (staleRunning > 0) healthIssues.push(`${staleRunning} stale running jobs`)

    // Recent 10 failures
    const { data: recentJobFails } = await supabase.from('job_runs')
      .select('job_name, error_message, started_at')
      .eq('status', 'failure')
      .order('started_at', { ascending: false })
      .limit(10)

    if (recentJobFails && recentJobFails.length > 0) {
      lines += `\n**Recent job failures:**\n\n`
      lines += `| Job | Error | Started At |\n|---|---|---|\n`
      for (const r of recentJobFails) {
        const err = (r.error_message || '—').slice(0, 60)
        lines += `| ${r.job_name} | ${err} | ${r.started_at} |\n`
      }
    }
  } catch (e) {
    lines += `(job_runs table may not exist: ${e.message})\n`
  }

  // PM2 error logs
  lines += `\n### PM2 Error Logs (last 5 lines each)\n\n`
  try {
    const raw = runCmd('pm2 jlist 2>/dev/null', { fallback: '[]' })
    const procs = JSON.parse(raw)
    let anyErrors = false
    for (const p of procs) {
      const name = p.name
      const errLog = runCmd(`pm2 logs ${name} --err --lines 5 --nostream 2>/dev/null`, { fallback: '' })
      const errLines = errLog.split('\n').filter(l => l.trim() && !l.includes('PM2') && !l.match(/^\s*$/)).slice(-5)
      if (errLines.length > 0) {
        anyErrors = true
        lines += `**${name}:**\n\`\`\`\n${errLines.join('\n')}\n\`\`\`\n\n`
        healthIssues.push(`${name} has recent error log entries`)
      }
    }
    if (!anyErrors) {
      lines += `No recent error log entries.\n`
    }
  } catch (e) {
    lines += `(PM2 error log check failed: ${e.message})\n`
  }

  // Uncommitted files
  lines += `\n### Uncommitted Files\n\n`
  const gitStatus = runCmd('git status --porcelain', { fallback: '' })
  if (gitStatus) {
    const statusLines = gitStatus.split('\n').filter(l => l.trim())
    lines += `${statusLines.length} uncommitted file(s):\n\n\`\`\`\n${statusLines.slice(0, 30).join('\n')}${statusLines.length > 30 ? '\n... (' + (statusLines.length - 30) + ' more)' : ''}\n\`\`\`\n`
  } else {
    lines += `Working tree clean.\n`
  }

  return { text: lines, data: { healthIssues } }
}

async function buildSection9(currentData) {
  let lines = `## Section 9 — Diff from Previous Run\n\n`

  if (!fs.existsSync(PREVIOUS_PATH)) {
    lines += `(first run, no diff available)\n`
    return { text: lines }
  }

  try {
    const prevContent = fs.readFileSync(PREVIOUS_PATH, 'utf8')

    // ── Row count deltas ──
    const extractRowCounts = (content) => {
      const counts = {}
      // Match rows in Section 2 table: | table_name | 1,234 | +5 |
      const tableRegex = /\|\s*(\w+)\s*\|\s*([\d,]+)\s*\|/g
      let match
      while ((match = tableRegex.exec(content)) !== null) {
        const table = match[1]
        const count = parseInt(match[2].replace(/,/g, ''))
        if (!isNaN(count) && !['Table', 'Field', 'Metric', 'Source', 'Status', 'Period', 'Cost'].includes(table)) {
          counts[table] = count
        }
      }
      return counts
    }

    const prevCounts = extractRowCounts(prevContent)
    const currCounts = {}
    if (currentData.section2?.data?.results) {
      for (const [table, info] of Object.entries(currentData.section2.data.results)) {
        if (table.startsWith('_')) continue
        if (info.total !== null) currCounts[table] = info.total
      }
    }

    const allTables = new Set([...Object.keys(prevCounts), ...Object.keys(currCounts)])
    let hasRowChanges = false
    let deltaLines = `### Row Count Deltas\n\n| Table | Previous | Current | Delta |\n|---|---|---|---|\n`
    for (const table of allTables) {
      const prev = prevCounts[table]
      const curr = currCounts[table]
      if (prev !== undefined && curr !== undefined && prev !== curr) {
        hasRowChanges = true
        const delta = curr - prev
        deltaLines += `| ${table} | ${prev.toLocaleString()} | ${curr.toLocaleString()} | ${delta > 0 ? '+' : ''}${delta.toLocaleString()} |\n`
      }
    }
    lines += hasRowChanges ? deltaLines : `No row count changes detected.\n`

    // ── Health transition ──
    const prevHealthMatch = prevContent.match(/Health:\s*(GREEN|YELLOW|RED)/)
    const currentHealth = currentData.health || 'UNKNOWN'
    if (prevHealthMatch) {
      const prevHealth = prevHealthMatch[1]
      const transition = prevHealth === currentHealth ? `${currentHealth} (unchanged)` : `${prevHealth} → ${currentHealth}`
      lines += `\n### Health Transition\n\n- ${transition}\n`
    }

    // ── AI cost delta ──
    const prevCostMatch = prevContent.match(/\|\s*Last 24h\s*\|\s*\$([\d.]+)\s*\|/)
    const currCost = currentData.section7?.data?.cost24h || 0
    if (prevCostMatch) {
      const prevCost = parseFloat(prevCostMatch[1])
      const costDelta = currCost - prevCost
      lines += `\n### AI Cost (24h)\n\n- Previous: $${prevCost.toFixed(4)}\n- Current: $${currCost.toFixed(4)}\n- Delta: ${costDelta >= 0 ? '+' : ''}$${costDelta.toFixed(4)}\n`
    }

    // ── PM2 process diff ──
    const extractPM2Names = (content) => {
      const names = {}
      const pm2Regex = /\|\s*(\S+)\s*\|\s*(online|stopped|errored|launching)\s*\|/g
      let m
      while ((m = pm2Regex.exec(content)) !== null) {
        if (m[1] !== 'Name') names[m[1]] = m[2]
      }
      return names
    }
    const prevPM2 = extractPM2Names(prevContent)
    const currPM2 = {}
    if (currentData.section3?.data?.processes) {
      try {
        const raw = runCmd('pm2 jlist 2>/dev/null', { fallback: '[]' })
        const procs = JSON.parse(raw)
        for (const p of procs) {
          currPM2[p.name] = p.pm2_env?.status || 'unknown'
        }
      } catch { /* use empty */ }
    }

    const allProcs = new Set([...Object.keys(prevPM2), ...Object.keys(currPM2)])
    if (allProcs.size > 0) {
      const pm2Changes = []
      for (const name of allProcs) {
        const prev = prevPM2[name]
        const curr = currPM2[name]
        if (!prev && curr) pm2Changes.push(`+ \`${name}\` (new, ${curr})`)
        else if (prev && !curr) pm2Changes.push(`- \`${name}\` (removed, was ${prev})`)
        else if (prev !== curr) pm2Changes.push(`~ \`${name}\` ${prev} → ${curr}`)
      }
      if (pm2Changes.length > 0) {
        lines += `\n### PM2 Changes\n\n`
        for (const c of pm2Changes) lines += `- ${c}\n`
      }
    }

    // ── Handler breakdown diff ──
    const prevHandlerMatch = prevContent.match(/- REAL: (\d+)\n- STUB: (\d+)\n- TODO: (\d+)/)
    if (prevHandlerMatch && currentData.section6?.data) {
      const prev = { real: parseInt(prevHandlerMatch[1]), stub: parseInt(prevHandlerMatch[2]), todo: parseInt(prevHandlerMatch[3]) }
      const curr = currentData.section6.data
      const changes = []
      if (prev.real !== curr.real) changes.push(`REAL: ${prev.real} → ${curr.real}`)
      if (prev.stub !== curr.stub) changes.push(`STUB: ${prev.stub} → ${curr.stub}`)
      if (prev.todo !== curr.todo) changes.push(`TODO: ${prev.todo} → ${curr.todo}`)
      if (changes.length > 0) {
        lines += `\n### Handler Changes\n\n`
        for (const c of changes) lines += `- ${c}\n`
      }
    }

    // ── Uncommitted files diff ──
    const prevUncommittedMatch = prevContent.match(/(\d+) uncommitted file/)
    const currUncommitted = currentData.section1?.data?.uncommitted || 0
    if (prevUncommittedMatch) {
      const prevCount = parseInt(prevUncommittedMatch[1])
      if (prevCount !== currUncommitted) {
        lines += `\n### Uncommitted Files\n\n- Previous: ${prevCount}\n- Current: ${currUncommitted}\n`
      }
    }

  } catch (e) {
    lines += `(diff failed: ${e.message})\n`
  }

  return { text: lines }
}

function buildBrokenSummary(sectionData, sectionErrors) {
  const criticals = []
  const warnings = []

  // Crashed/errored PM2 processes
  const pm2Flags = sectionData.section3?.data?.flags || []
  for (const f of pm2Flags) {
    if (f.startsWith('ERRORED')) criticals.push(f)
    else if (f.startsWith('CRASH LOOP')) criticals.push(f)
    else if (f.startsWith('PHANTOM')) warnings.push(f)
  }

  // Stuck workflow events > 1h
  const stuck = sectionData.section2?.data?.results?._workflow_events?.stuck || 0
  if (stuck > 100) criticals.push(`${stuck} workflow events stuck pending > 1 hour`)
  else if (stuck > 0) warnings.push(`${stuck} workflow events stuck pending > 1 hour`)

  // Failed jobs in 24h
  const healthIssues = sectionData.section8?.data?.healthIssues || []
  for (const issue of healthIssues) {
    if (issue.includes('failed') || issue.includes('CRITICAL')) criticals.push(issue)
    else if (issue.includes('dead letter') || issue.includes('stale') || issue.includes('error')) warnings.push(issue)
  }

  // Section build failures
  for (const err of sectionErrors) {
    warnings.push(`Audit section failed: ${err}`)
  }

  const total = criticals.length + warnings.length
  const topItems = [...criticals, ...warnings].slice(0, 5)

  let block = `=== WHAT'S BROKEN RIGHT NOW ===\n`
  if (criticals.length > 0) block += `🔴 ${criticals.length} critical issue${criticals.length === 1 ? '' : 's'}\n`
  if (warnings.length > 0) block += `🟡 ${warnings.length} warning${warnings.length === 1 ? '' : 's'}\n`
  if (total === 0) block += `🟢 No critical issues\n`

  if (topItems.length > 0) {
    block += `\nTop actionable items:\n`
    for (let i = 0; i < topItems.length; i++) {
      block += `${i + 1}. ${topItems[i]}\n`
    }
  }

  return block
}

// ── Main ──

async function main() {
  const startTime = Date.now()
  console.log('[audit-system-state] Starting system audit...')

  const sectionData = {}
  const sections = []
  const sectionErrors = []

  // Section 1 — Header
  try {
    sectionData.section1 = await buildSection1()
    sections.push(sectionData.section1.text)
    console.log('  Section 1 (Header) done')
  } catch (e) {
    sections.push(`## Section 1 — Header\n\n(section failed: ${e.message})\n`)
    sectionErrors.push(`Section 1: ${e.message}`)
    console.error('  Section 1 FAILED:', e.message)
  }

  // Section 2 — Database state
  try {
    sectionData.section2 = await buildSection2()
    sections.push(sectionData.section2.text)
    console.log('  Section 2 (Database) done')
  } catch (e) {
    sections.push(`## Section 2 — Database State\n\n(section failed: ${e.message})\n`)
    sectionErrors.push(`Section 2: ${e.message}`)
    console.error('  Section 2 FAILED:', e.message)
  }

  // Section 3 — PM2
  try {
    sectionData.section3 = await buildSection3()
    sections.push(sectionData.section3.text)
    console.log('  Section 3 (PM2) done')
  } catch (e) {
    sections.push(`## Section 3 — PM2 Fleet State\n\n(section failed: ${e.message})\n`)
    sectionErrors.push(`Section 3: ${e.message}`)
    console.error('  Section 3 FAILED:', e.message)
  }

  // Section 4 — Crontab
  try {
    sectionData.section4 = await buildSection4()
    sections.push(sectionData.section4.text)
    console.log('  Section 4 (Crontab) done')
  } catch (e) {
    sections.push(`## Section 4 — Crontab State\n\n(section failed: ${e.message})\n`)
    sectionErrors.push(`Section 4: ${e.message}`)
    console.error('  Section 4 FAILED:', e.message)
  }

  // Section 5 — Script inventory
  try {
    sectionData.section5 = await buildSection5(sectionData.section3?.data, sectionData.section4?.data)
    sections.push(sectionData.section5.text)
    console.log('  Section 5 (Scripts) done')
  } catch (e) {
    sections.push(`## Section 5 — Script Inventory\n\n(section failed: ${e.message})\n`)
    sectionErrors.push(`Section 5: ${e.message}`)
    console.error('  Section 5 FAILED:', e.message)
  }

  // Section 6 — Workflow handlers
  try {
    sectionData.section6 = await buildSection6()
    sections.push(sectionData.section6.text)
    console.log('  Section 6 (Handlers) done')
  } catch (e) {
    sections.push(`## Section 6 — Workflow Handler State\n\n(section failed: ${e.message})\n`)
    sectionErrors.push(`Section 6: ${e.message}`)
    console.error('  Section 6 FAILED:', e.message)
  }

  // Section 7 — AI cost
  try {
    sectionData.section7 = await buildSection7()
    sections.push(sectionData.section7.text)
    console.log('  Section 7 (AI Cost) done')
  } catch (e) {
    sections.push(`## Section 7 — AI Cost and Classification State\n\n(section failed: ${e.message})\n`)
    sectionErrors.push(`Section 7: ${e.message}`)
    console.error('  Section 7 FAILED:', e.message)
  }

  // Section 8 — Failures
  try {
    sectionData.section8 = await buildSection8()
    sections.push(sectionData.section8.text)
    console.log('  Section 8 (Failures) done')
  } catch (e) {
    sections.push(`## Section 8 — Recent Failures and Silent Errors\n\n(section failed: ${e.message})\n`)
    sectionErrors.push(`Section 8: ${e.message}`)
    console.error('  Section 8 FAILED:', e.message)
  }

  // Compute health
  const healthIssues = sectionData.section8?.data?.healthIssues || []
  const pm2Flags = sectionData.section3?.data?.flags || []
  const allIssues = [...healthIssues, ...pm2Flags.map(f => f)]
  const stuck = sectionData.section2?.data?.results?._workflow_events?.stuck || 0

  let health = 'GREEN'
  if (allIssues.length > 0) health = 'YELLOW'
  if (stuck > 100 || pm2Flags.some(f => f.startsWith('ERRORED')) || sectionErrors.length > 2) health = 'RED'

  const totalRows = sectionData.section2?.data?.totalRows || 0
  const tableCount = sectionData.section2?.data?.tableCount || 0
  const pm2Online = sectionData.section3?.data?.online || 0
  const pm2Total = sectionData.section3?.data?.total || 0
  const handlersReal = sectionData.section6?.data?.real || 0
  const handlersTotal = sectionData.section6?.data?.total || 0
  const events24h = sectionData.section2?.data?.results?._workflow_events?.events24h || 0
  const classifications24h = sectionData.section7?.data?.calls24h || 0
  const cost24h = sectionData.section7?.data?.cost24h || 0

  // Section 9 — Diff (pass all section data for richer comparison)
  const currentSummary = {
    section1: sectionData.section1,
    section2: sectionData.section2,
    section3: sectionData.section3,
    section6: sectionData.section6,
    section7: sectionData.section7,
    health,
  }
  try {
    sectionData.section9 = await buildSection9(currentSummary)
    sections.push(sectionData.section9.text)
    console.log('  Section 9 (Diff) done')
  } catch (e) {
    sections.push(`## Section 9 — Diff from Previous Run\n\n(section failed: ${e.message})\n`)
    console.error('  Section 9 FAILED:', e.message)
  }

  // Build 5-line header
  const header = [
    `=== ADUANA SYSTEM STATE ===`,
    `Generated: ${new Date().toISOString()}`,
    `Health: ${health}`,
    `Database: ${totalRows.toLocaleString()} rows across ${tableCount} tables`,
    `Pipeline: ${pm2Online}/${pm2Total} online, ${handlersReal}/${handlersTotal} handlers wired`,
    `Last 24h: ${events24h} events processed, ${classifications24h} classifications, $${cost24h.toFixed(4)}`,
  ].join('\n')

  // Build "What's broken" summary
  const brokenSummary = buildBrokenSummary(sectionData, sectionErrors)

  // Assemble final output
  const output = [
    '```',
    header,
    '```',
    '',
    '```',
    brokenSummary,
    '```',
    '',
    '# ADUANA System State Audit',
    '',
    ...sections
  ].join('\n')

  // Backup previous
  if (fs.existsSync(OUTPUT_PATH)) {
    fs.copyFileSync(OUTPUT_PATH, PREVIOUS_PATH)
    console.log('  Backed up previous SYSTEM_STATE.md')
  }

  // Write output
  fs.writeFileSync(OUTPUT_PATH, output, 'utf8')
  const outputSize = fs.statSync(OUTPUT_PATH).size
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log(`\n[audit-system-state] Complete in ${elapsed}s`)
  console.log(`  Output: ${OUTPUT_PATH} (${formatBytes(outputSize)})`)
  console.log(`  Health: ${health}`)

  // Print status block
  const allPresent = sections.length >= 9
  console.log(`
AUDIT SCRIPT BUILD · STATUS
Script created at scripts/audit-system-state.js:    [OK]
First run produced SYSTEM_STATE.md:                  [${fs.existsSync(OUTPUT_PATH) ? 'OK' : 'FAIL'}]
All 8 sections present in output:                    [${allPresent ? 'OK' : 'PARTIAL'}]
5-line header summary present:                       [OK]
Health classification (GREEN/YELLOW/RED):            [${health}]
Total runtime:                                       ${elapsed}s
Output file size:                                    ${formatBytes(outputSize)}`)

  if (allIssues.length > 0) {
    console.log('Notable findings:')
    for (const issue of allIssues.slice(0, 5)) {
      console.log(`  - ${issue}`)
    }
  }

  process.exit(0)
}

main().catch(err => {
  console.error('[audit-system-state] Fatal error:', err.message)
  process.exit(1)
})
