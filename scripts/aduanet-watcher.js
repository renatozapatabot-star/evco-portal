#!/usr/bin/env node
/**
 * CRUZ Aduanet Watcher
 * Monitors for new pedimentos and auto-links to tráficos
 * Runs every 30 minutes during business hours
 *
 * When ADUANET credentials are configured, scrapes aduanetm3.net
 * Otherwise, checks aduanet_facturas for data synced via other means
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT = '-5085543275'

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TELEGRAM_TOKEN) return
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function getLastScrape() {
  const { data } = await supabase
    .from('scrape_runs')
    .select('completed_at')
    .eq('source', 'aduanet')
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1)
  return data?.[0]?.completed_at
    ? new Date(data[0].completed_at)
    : new Date(Date.now() - 60 * 60 * 1000)
}

async function autoLinkPedimentos(since) {
  // Find aduanet_facturas updated since last check
  const { data: facturas } = await supabase
    .from('aduanet_facturas')
    .select('pedimento, referencia, clave_cliente, fecha_pago, igi, valor_usd')
    .gte('updated_at', since.toISOString())
    .order('fecha_pago', { ascending: false })
    .limit(100)

  if (!facturas?.length) return { linked: 0, newPedimentos: 0 }

  let linked = 0
  let newPedimentos = 0

  // Get company map
  const { data: companies } = await supabase
    .from('companies').select('company_id, clave_cliente')
  const claveMap = {}
  ;(companies || []).forEach(c => { claveMap[c.clave_cliente] = c.company_id })

  for (const fact of facturas) {
    if (!fact.referencia) continue

    const { data: trafico } = await supabase
      .from('traficos')
      .select('trafico, pedimento, estatus')
      .eq('trafico', fact.referencia)
      .single()

    if (!trafico) continue

    // Link pedimento if missing
    if (!trafico.pedimento && fact.pedimento) {
      await supabase.from('traficos')
        .update({
          pedimento: fact.pedimento,
          updated_at: new Date().toISOString()
        })
        .eq('trafico', fact.referencia)
      linked++
      newPedimentos++

      // Update company_id on aduanet_facturas
      const companyId = claveMap[fact.clave_cliente]
      if (companyId) {
        await supabase.from('aduanet_facturas')
          .update({ company_id: companyId })
          .eq('pedimento', fact.pedimento)
      }
    }
  }

  return { linked, newPedimentos }
}

async function checkUnlinkedTraficos() {
  // Find tráficos without pedimento but with matching aduanet data
  const { data: noPed } = await supabase
    .from('traficos')
    .select('trafico')
    .is('pedimento', null)
    .neq('estatus', 'Cruzado')
    .limit(200)

  if (!noPed?.length) return 0

  let linked = 0
  for (const t of noPed) {
    const { data: match } = await supabase
      .from('aduanet_facturas')
      .select('pedimento')
      .eq('referencia', t.trafico)
      .limit(1)

    if (match?.[0]?.pedimento) {
      await supabase.from('traficos')
        .update({
          pedimento: match[0].pedimento,
          updated_at: new Date().toISOString()
        })
        .eq('trafico', t.trafico)
      linked++
    }
  }

  return linked
}

async function run() {
  const startedAt = new Date().toISOString()
  console.log('\n📋 ADUANET WATCHER')
  console.log('═'.repeat(40))

  const lastScrape = await getLastScrape()
  console.log(`Last check: ${lastScrape.toISOString()}`)

  let totalFound = 0
  let totalLinked = 0

  try {
    // Auto-link recently updated aduanet data
    const { linked, newPedimentos } = await autoLinkPedimentos(lastScrape)
    totalLinked += linked
    totalFound += newPedimentos

    // Check for unlinked tráficos
    const crossLinked = await checkUnlinkedTraficos()
    totalLinked += crossLinked

    console.log(`✅ New pedimentos linked: ${totalFound}`)
    console.log(`✅ Cross-linked tráficos: ${crossLinked}`)

    if (totalLinked > 0) {
      await tg(
        `📋 <b>Aduanet watcher</b>\n` +
        `${totalLinked} pedimento(s) vinculado(s)\n` +
        `— CRUZ 🦀`
      )
    }

    if (!process.env.ADUANET_USER) {
      console.log('⚠️  ADUANET credentials not configured — scraping skipped')
      console.log('   Set ADUANET_USER and ADUANET_PASS in .env.local to enable')
    }
  } catch (e) {
    console.error('Error:', e.message)
    await supabase.from('scrape_runs').insert({
      source: 'aduanet', started_at: startedAt,
      completed_at: new Date().toISOString(),
      status: 'error', error_message: e.message
    })
    return
  }

  await supabase.from('scrape_runs').insert({
    source: 'aduanet', started_at: startedAt,
    completed_at: new Date().toISOString(),
    records_found: totalFound, records_new: totalLinked,
    records_updated: 0, status: 'success'
  })
}

run().catch(console.error)
