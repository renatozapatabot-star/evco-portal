#!/usr/bin/env node
/**
 * CRUZ Integration Health Monitor
 * Checks all integrations every 5 minutes
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CHECKS = [
  {
    name: 'GlobalPC MySQL',
    check: async () => {
      const conn = await mysql.createConnection({
        host: process.env.GLOBALPC_DB_HOST,
        port: parseInt(process.env.GLOBALPC_DB_PORT),
        user: process.env.GLOBALPC_DB_USER,
        password: process.env.GLOBALPC_DB_PASS,
        database: 'bd_demo_38',
        connectTimeout: 5000
      })
      const [r] = await conn.execute('SELECT 1 as ok')
      await conn.end()
      return r[0].ok === 1
    }
  },
  {
    name: 'Supabase',
    check: async () => {
      const { error } = await supabase.from('companies').select('company_id').limit(1)
      return !error
    }
  },
  {
    name: 'Banxico API',
    check: async () => {
      if (!process.env.BANXICO_TOKEN) return false
      const res = await fetch('https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/oportuno', {
        headers: { 'Bmx-Token': process.env.BANXICO_TOKEN },
        signal: AbortSignal.timeout(5000)
      })
      return res.ok
    }
  },
  {
    name: 'Ollama Qwen',
    check: async () => {
      const res = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(3000)
      })
      const data = await res.json()
      return data.models?.length > 0
    }
  },
  {
    name: 'Telegram Bot',
    check: async () => {
      if (!process.env.TELEGRAM_BOT_TOKEN) return false
      const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`)
      const data = await res.json()
      return data.ok === true
    }
  },
  {
    name: 'Vapi Voice Agent',
    check: async () => {
      if (!process.env.VAPI_PRIVATE_KEY) return false
      const res = await fetch('https://api.vapi.ai/assistant', {
        headers: { Authorization: `Bearer ${process.env.VAPI_PRIVATE_KEY}` },
        signal: AbortSignal.timeout(5000)
      })
      return res.ok
    }
  },
  {
    name: 'Gmail OAuth',
    check: async () => {
      return !!(process.env.GMAIL_REFRESH_TOKEN && process.env.GMAIL_CLIENT_ID)
    }
  }
]

async function runHealthChecks() {
  console.log('🏥 Integration Health Check — CRUZ')
  const results = []

  for (const check of CHECKS) {
    const start = Date.now()
    try {
      const healthy = await check.check()
      const ms = Date.now() - start
      results.push({
        integration_name: check.name,
        status: healthy ? 'healthy' : 'degraded',
        response_time_ms: ms,
        error_message: null,
        checked_at: new Date().toISOString()
      })
      console.log(`  ${healthy ? '✅' : '⚠️'}  ${check.name}: ${healthy ? 'healthy' : 'degraded'} (${ms}ms)`)
    } catch (e) {
      const ms = Date.now() - start
      results.push({
        integration_name: check.name,
        status: 'down',
        error_message: e.message,
        response_time_ms: ms,
        checked_at: new Date().toISOString()
      })
      console.log(`  ❌ ${check.name}: DOWN — ${e.message} (${ms}ms)`)
    }
  }

  // Clear old results and insert fresh
  await supabase.from('integration_health').delete().neq('integration_name', '__never__')
  await supabase.from('integration_health').insert(results)

  // Alert on failures
  const down = results.filter(r => r.status === 'down')
  if (down.length > 0 && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_SILENT !== 'true') {
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: '-5085543275',
        text: `⚠️ <b>INTEGRACIÓN CAÍDA</b>\n${down.map(d => `❌ ${d.integration_name}: ${d.error_message}`).join('\n')}\n— CRUZ 🦀`,
        parse_mode: 'HTML'
      })
    }).catch(() => {})
  }

  const healthy = results.filter(r => r.status === 'healthy').length
  console.log(`\n✅ ${healthy}/${results.length} healthy`)
  return results
}

runHealthChecks().catch(console.error)
