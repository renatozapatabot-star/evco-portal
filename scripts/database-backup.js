const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const BACKUP_DIR = path.join(process.env.HOME || '', 'evco-backups')

const TABLES = [
  { table: 'traficos', filter: { column: 'company_id', value: 'evco' } },
  { table: 'entradas', filter: { column: 'company_id', value: 'evco' } },
  { table: 'aduanet_facturas', filter: { column: 'clave_cliente', value: '9254' } },
  { table: 'coves', filter: null },
  { table: 'documents', filter: null },
]

async function sendTelegram(msg) {
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' }) })
}

function fmtSize(b) { return b > 1048576 ? `${(b/1048576).toFixed(1)} MB` : b > 1024 ? `${(b/1024).toFixed(1)} KB` : `${b} B` }

async function backupTable(table, filter) {
  let q = supabase.from(table).select('*')
  if (filter) q = q.eq(filter.column, filter.value)
  const PAGE = 10000; let page = 0, all = [], more = true
  while (more) {
    const { data, error } = await q.range(page * PAGE, (page + 1) * PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) { more = false; break }
    all = [...all, ...data]
    if (data.length < PAGE) more = false
    page++
  }
  return all
}

async function runBackup() {
  console.log(`🗄️  Starting database backup — ${new Date().toISOString()}\n`)
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const dateStr = new Date().toISOString().split('T')[0]
  const backupPath = path.join(BACKUP_DIR, `evco-backup-${dateStr}`)
  if (!fs.existsSync(backupPath)) fs.mkdirSync(backupPath)

  const results = []; let totalRows = 0, totalSize = 0

  for (const { table, filter } of TABLES) {
    try {
      process.stdout.write(`  ${table}... `)
      const data = await backupTable(table, filter)
      const json = JSON.stringify(data, null, 2)
      const fp = path.join(backupPath, `${table}.json`)
      fs.writeFileSync(fp, json)
      const size = fs.statSync(fp).size
      results.push({ table, rows: data.length, size, status: 'ok' })
      totalRows += data.length; totalSize += size
      console.log(`${data.length.toLocaleString()} rows (${fmtSize(size)})`)
    } catch (e) {
      results.push({ table, rows: 0, size: 0, status: 'error', error: e.message })
      console.log(`❌ Error: ${e.message}`)
    }
  }

  fs.writeFileSync(path.join(backupPath, 'manifest.json'), JSON.stringify({ backup_date: new Date().toISOString(), total_rows: totalRows, total_size: totalSize, tables: results }, null, 2))

  // Retain 7 days
  const backups = fs.readdirSync(BACKUP_DIR).filter(d => d.startsWith('evco-backup-')).sort().reverse()
  backups.slice(7).forEach(old => { fs.rmSync(path.join(BACKUP_DIR, old), { recursive: true }); console.log(`  🗑️  Removed: ${old}`) })

  console.log(`\n✅ Backup complete: ${backupPath}`)
  console.log(`   Total: ${totalRows.toLocaleString()} rows · ${fmtSize(totalSize)}`)

  const errors = results.filter(r => r.status === 'error')
  await sendTelegram([
    `🗄️ <b>DATABASE BACKUP ${errors.length > 0 ? '⚠️' : '✅'}</b>`, `${new Date().toLocaleDateString('es-MX')}`,
    `━━━━━━━━━━━━━━━━━━━━`, `Tablas: ${results.length} · Filas: ${totalRows.toLocaleString()} · ${fmtSize(totalSize)}`,
    errors.length > 0 ? `⚠️ Errores: ${errors.map(e => e.table).join(', ')}` : `✅ Sin errores`,
    `━━━━━━━━━━━━━━━━━━━━`, `— CRUZ 🦀`
  ].join('\n'))
}

runBackup().catch(err => { console.error('Fatal error:', err); process.exit(1) })
