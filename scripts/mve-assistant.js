#!/usr/bin/env node
// scripts/mve-assistant.js — FEATURE 9
// Daily MVE filing assistant — checks for pending MVEs
// Cron: 30 7 * * * (7:30 AM daily)

const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkhpafacchjxawnscplf.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'
const COMPANY_ID = 'evco'
const CLAVE = '9254'
const MVE_DEADLINE = new Date('2026-03-31')

async function sendTG(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) { console.log(msg); return }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  })
}

async function main() {
  console.log('📋 MVE Filing Assistant — CRUZ')

  // 1. Get tráficos En Proceso (post-deadline, all need MVE)
  const { data: traficos } = await supabase.from('traficos')
    .select('trafico, estatus, fecha_llegada, descripcion_mercancia, pedimento, mve_folio')
    .eq('company_id', COMPANY_ID).eq('estatus', 'En Proceso')
    .order('fecha_llegada', { ascending: true })

  const pending = (traficos || []).filter(t => !t.mve_folio)
  const filed = (traficos || []).filter(t => t.mve_folio)

  console.log(`${pending.length} pending MVE · ${filed.length} filed`)

  if (pending.length === 0) {
    console.log('✅ All tráficos have MVE folio')
    return
  }

  // 2. For each pending, fetch factura data for pre-fill
  const prefills = []
  for (const t of pending.slice(0, 20)) { // Process top 20
    const { data: facturas } = await supabase.from('globalpc_facturas')
      .select('cve_proveedor, valor_comercial, moneda, incoterm, numero')
      .eq('cve_trafico', t.trafico)

    const factura = facturas?.[0]
    prefills.push({
      trafico: t.trafico,
      fecha_llegada: t.fecha_llegada,
      descripcion: t.descripcion_mercancia,
      prefill: {
        importador_rfc: 'EPM001109I74',
        importador: 'EVCO PLASTICS DE MEXICO S.A. DE C.V.',
        proveedor: factura?.cve_proveedor || '—',
        valor_transaccion: factura?.valor_comercial || 0,
        moneda: factura?.moneda || 'USD',
        incoterm: factura?.incoterm || 'DAP',
        tipo_cambio: 20.50, // Will be updated with live rate
        descripcion: t.descripcion_mercancia || '—',
        facturas: (facturas || []).map(f => ({
          numero: f.numero, valor: f.valor_comercial, proveedor: f.cve_proveedor
        })),
      }
    })
  }

  // 3. Send Telegram alert to Ursula
  const urgentCount = pending.filter(t => {
    if (!t.fecha_llegada) return false
    const days = Math.floor((Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000)
    return days > 14
  }).length

  const msg = [
    `📋 <b>MVE QUEUE</b> — ${pending.length} traficos pendientes`,
    urgentCount > 0 ? `🔴 ${urgentCount} con mas de 14 dias sin folio` : '',
    ``,
    `Top 5 mas antiguos:`,
    ...pending.slice(0, 5).map((t, i) => {
      const days = t.fecha_llegada ? Math.floor((Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000) : '?'
      return `  ${i + 1}. ${t.trafico} · ${days}d · ${(t.descripcion_mercancia || '').substring(0, 30)}`
    }),
    ``,
    `👉 https://evco-portal.vercel.app/mve`,
    `— CRUZ 🦀`
  ].filter(Boolean).join('\n')

  await sendTG(msg)
  console.log(`✅ MVE alert sent · ${pending.length} pending · ${urgentCount} urgent`)
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
