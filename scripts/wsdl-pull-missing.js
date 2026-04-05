#!/usr/bin/env node
/**
 * WSDL Document Pull — TARGETED for missing EVCO tráficos only
 *
 * Instead of pulling all 10K+ tráficos from GlobalPC MySQL,
 * this queries Supabase for EVCO tráficos with 0 docs in
 * expediente_documentos, then checks GlobalPC MySQL to get
 * their sCveTrafico + sCveCliente, and pulls docs via WSDL.
 *
 * Usage: node scripts/wsdl-pull-missing.js [--dry-run]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const soap = require('soap')
const mysql = require('mysql2/promise')
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'
const ERROR_LOG = '/tmp/wsdl-pull-missing-errors.log'
const DRY_RUN = process.argv.includes('--dry-run')

const DOC_TYPE_MAP = {
  'FACTURA': 'factura_comercial',
  'FACTURA DOLARES': 'factura_comercial',
  'FACTURA PESOS': 'factura_comercial',
  'LISTA DE EMPAQUE': 'packing_list',
  'DETALLE DE COVE': 'cove',
  'XML DE COVE': 'cove',
  'ACUSE DE COVE': 'acuse_cove',
  'ACUSE DE E-DOCUMENT': 'acuse_cove',
  'PEDIMENTO': 'pedimento_detallado',
  'PEDIMENTO DETALLADO': 'pedimento_detallado',
  'PEDIMENTO SIMPLIFICADO': 'pedimento_simplificado',
  'QR DODA': 'doda',
  'ARCHIVOS DE VALIDACION': 'archivos_validacion',
  'XML DE FACTURA': 'factura_comercial',
  'CARTA': 'otro',
  'GUIA AEREA': 'bol',
  'CONOCIMIENTO DE EMBARQUE': 'bol',
  'CUENTA DE GASTOS': 'cuenta_gastos',
  'MANIFESTACION DE VALOR': 'mve',
}
function mapDocType(label) {
  return DOC_TYPE_MAP[(label || '').toUpperCase()] || 'otro'
}

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true' || !TG) return
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}

async function getKey(existingClient) {
  const client = existingClient || await soap.createClientAsync(process.env.GLOBALPC_WSDL_URL)
  const [auth] = await client.getWSAccesoAsync({
    token: process.env.GLOBALPC_TOKEN,
    usr: process.env.GLOBALPC_USER,
    pwd: process.env.GLOBALPC_PASS
  })
  if (auth.return?.key) return { client, key: auth.return.key }
  throw new Error('WSDL auth failed: ' + (auth.return?.msg || JSON.stringify(auth.return)))
}

async function pullDocs(client, key, sCveTrafico) {
  const [result] = await client.getListaDocumentosTraficoAsync({
    clave_trafico: sCveTrafico,
    tipo_documento: '',
    key
  })
  const ret = result?.return
  if (ret?.error === '1' || (ret?.error && ret?.error !== '0' && ret?.error !== 'FALSE')) {
    const msg = ret.msg || ''
    if (msg.includes('No se encontraron registros')) return { docs: [], reauth: false }
    if (msg.includes('Llave') || msg.includes('key') || msg.includes('valida')) return { docs: [], reauth: true }
    return { docs: [], reauth: false, error: msg }
  }
  const items = ret?.ListaDocumentosTrafico?.item
  if (!items) return { docs: [], reauth: false }
  return { docs: Array.isArray(items) ? items : [items], reauth: false }
}

async function insertDocs(docs, trafico) {
  const rows = docs.map(d => ({
    pedimento_id: trafico.sCveTrafico,
    doc_type: mapDocType(d.tipo_documento),
    file_name: d.descripcion || '',
    file_url: `globalpc://doc/${d.id}`,
    company_id: trafico.company_id,
    uploaded_by: 'wsdl-pull-missing',
    metadata: { globalpc_doc_id: d.id || null, id_tipo_documento: d.id_tipo_documento || null, wsdl_label: d.tipo_documento }
  }))
  const { error } = await supabase.from('expediente_documentos').insert(rows)
  if (error && !error.message.includes('duplicate')) {
    fs.appendFileSync(ERROR_LOG, `${new Date().toISOString()} | ${trafico.sCveTrafico} | INSERT: ${error.message}\n`)
    return false
  }
  return true
}

async function run() {
  console.log(DRY_RUN ? '🔍 DRY RUN\n' : '🔧 LIVE WSDL PULL — missing EVCO tráficos\n')

  // Step 1: Find EVCO tráficos with 0 docs in expediente_documentos
  console.log('Step 1: Finding EVCO tráficos with 0 docs...')
  const allTraficos = []
  let offset = 0
  while (true) {
    const { data } = await supabase.from('traficos')
      .select('trafico, pedimento')
      .eq('company_id', 'evco')
      .gte('fecha_llegada', '2024-01-01')
      .not('pedimento', 'is', null).neq('pedimento', '')
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    allTraficos.push(...data)
    offset += data.length
    if (data.length < 1000) break
  }

  const withDocs = new Set()
  for (let i = 0; i < allTraficos.length; i += 100) {
    const chunk = allTraficos.slice(i, i + 100).map(t => t.trafico)
    const { data: docs } = await supabase.from('expediente_documentos')
      .select('pedimento_id').in('pedimento_id', chunk)
    for (const d of (docs || [])) withDocs.add(d.pedimento_id)
  }

  const missing = allTraficos.filter(t => !withDocs.has(t.trafico))
  console.log(`  Total EVCO tráficos: ${allTraficos.length}`)
  console.log(`  With docs: ${withDocs.size}`)
  console.log(`  Missing: ${missing.length}`)

  if (missing.length === 0) { console.log('Nothing to pull.'); return }

  // Step 2: Match against GlobalPC MySQL to get sCveTrafico + sCveCliente
  console.log('\nStep 2: Matching against GlobalPC MySQL...')
  const conn = await mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST,
    port: parseInt(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER,
    password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38'
  })

  const missingTraficoIds = missing.map(t => t.trafico)
  const [gpcRows] = await conn.query(
    'SELECT sCveTrafico, sCveCliente FROM cb_trafico WHERE sCveTrafico IN (?)',
    [missingTraficoIds]
  )
  await conn.end()

  // Build lookup: sCveTrafico → { sCveTrafico, sCveCliente, company_id }
  const gpcMap = new Map()
  for (const r of gpcRows) {
    gpcMap.set(r.sCveTrafico, {
      sCveTrafico: r.sCveTrafico,
      sCveCliente: r.sCveCliente,
      company_id: 'evco'
    })
  }

  const pullable = missing.filter(t => gpcMap.has(t.trafico))
  const notInGpc = missing.filter(t => !gpcMap.has(t.trafico))
  console.log(`  In GlobalPC: ${pullable.length}`)
  console.log(`  Not in GlobalPC: ${notInGpc.length}`)

  if (DRY_RUN) {
    console.log(`\n🔍 Would pull docs for ${pullable.length} tráficos via WSDL.`)
    return
  }

  if (pullable.length === 0) { console.log('Nothing pullable.'); return }

  // Step 3: WSDL pull
  console.log(`\nStep 3: Pulling docs via WSDL for ${pullable.length} tráficos...`)
  let { client, key } = await getKey()
  console.log('  WSDL authenticated')

  let docsFound = 0, noDocsCount = 0, errors = 0, linked = 0

  for (let idx = 0; idx < pullable.length; idx++) {
    const t = pullable[idx]
    const gpc = gpcMap.get(t.trafico)

    try {
      // Re-auth before every call (GlobalPC keys are single-use)
      try {
        const refreshed = await getKey(client)
        client = refreshed.client
        key = refreshed.key
      } catch (e) {
        console.error('\n  Auth failed:', e.message)
        errors++
        break
      }

      const result = await pullDocs(client, key, gpc.sCveTrafico)

      if (result.reauth) {
        // Retry once
        try {
          const refreshed = await getKey(client)
          client = refreshed.client
          key = refreshed.key
          const retry = await pullDocs(client, key, gpc.sCveTrafico)
          if (retry.docs.length > 0) {
            if (await insertDocs(retry.docs, gpc)) { docsFound += retry.docs.length; linked++ }
            else errors++
          } else noDocsCount++
        } catch (e) { errors++; break }
      } else if (result.error) {
        errors++
        fs.appendFileSync(ERROR_LOG, `${new Date().toISOString()} | ${gpc.sCveTrafico} | ${result.error}\n`)
      } else if (result.docs.length > 0) {
        if (await insertDocs(result.docs, gpc)) { docsFound += result.docs.length; linked++ }
        else errors++
      } else {
        noDocsCount++
      }

      if ((idx + 1) % 25 === 0) {
        process.stdout.write(`\r  ${(idx + 1)} / ${pullable.length} · ${docsFound} docs · ${linked} linked · ${noDocsCount} empty · ${errors} err`)
      }

      // 300ms delay to respect rate limits
      await new Promise(r => setTimeout(r, 300))

    } catch (e) {
      errors++
      fs.appendFileSync(ERROR_LOG, `${new Date().toISOString()} | ${gpc.sCveTrafico} | EXCEPTION: ${e.message?.substring(0, 200)}\n`)
      if (errors <= 5) console.error('\n  Error:', gpc.sCveTrafico, e.message?.substring(0, 100))
      if (e.message?.includes('Llave') || e.message?.includes('key')) {
        try { const r = await getKey(client); client = r.client; key = r.key }
        catch { break }
      }
    }
  }

  console.log(`\n\n═══════════════════════════════════════════`)
  console.log(`  WSDL PULL COMPLETE`)
  console.log(`═══════════════════════════════════════════`)
  console.log(`  Tráficos processed: ${pullable.length}`)
  console.log(`  Linked (got docs):  ${linked}`)
  console.log(`  Docs inserted:      ${docsFound}`)
  console.log(`  No docs in WSDL:    ${noDocsCount}`)
  console.log(`  Errors:             ${errors}`)
  console.log(`  Not in GlobalPC:    ${notInGpc.length}`)
  console.log(`═══════════════════════════════════════════`)

  await tg(`📄 <b>WSDL pull (missing) complete</b>\n${linked} linked · ${docsFound} docs\nEmpty: ${noDocsCount} · Errors: ${errors}\n— CRUZ 🦀`)
}

run().catch(async (e) => {
  console.error('Fatal:', e)
  await tg(`🔴 <b>WSDL pull (missing) FATAL</b>\n${e.message}\n— CRUZ 🦀`)
  process.exit(1)
})
