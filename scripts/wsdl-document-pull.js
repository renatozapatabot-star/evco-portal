#!/usr/bin/env node
/**
 * CRUZ WSDL Document Pull (v2 — fixed)
 * Pulls document metadata for all tráficos from GlobalPC SOAP API
 * Registers documents in expediente_documentos table
 *
 * v2 fixes:
 *   - Uses sCveTrafico from GlobalPC MySQL (e.g. "9254-Y4466")
 *     instead of Supabase numeric ID
 *   - Re-auths on error:"1" responses, not just exceptions
 *   - Proactive re-auth every 100 tráficos (short key TTL)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const soap = require('soap')
const mysql = require('mysql2/promise')
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'
const CHECKPOINT = '/tmp/wsdl-doc-pull-checkpoint.json'
const ERROR_LOG = '/tmp/wsdl-doc-pull-errors.log'
const REAUTH_INTERVAL = 1 // GlobalPC keys are single-use — auth before every call

// Map WSDL Spanish labels → check-constrained doc_type codes
const DOC_TYPE_MAP = {
  // Facturas
  'FACTURA': 'factura_comercial',
  'FACTURA DOLARES': 'factura_comercial',
  'FACTURA PESOS': 'factura_comercial',
  'FACTURA COMERCIAL': 'factura_comercial',
  'XML DE FACTURA': 'factura_comercial',
  'CFDI': 'factura_comercial',
  'XML CFDI': 'factura_comercial',
  'COMPLEMENTO DE PAGO': 'factura_comercial',
  'PROFORMA': 'proforma',
  'PRO FORMA': 'proforma',
  // Packing
  'LISTA DE EMPAQUE': 'packing_list',
  'PACKING LIST': 'packing_list',
  'PACKING': 'packing_list',
  // COVE
  'DETALLE DE COVE': 'cove',
  'XML DE COVE': 'cove',
  'COVE': 'cove',
  'ACUSE DE COVE': 'acuse_cove',
  'ACUSE DE E-DOCUMENT': 'acuse_cove',
  'ACUSE E-DOCUMENT': 'acuse_cove',
  'ACUSE': 'acuse_cove',
  // Pedimento
  'PEDIMENTO': 'pedimento_detallado',
  'PEDIMENTO DETALLADO': 'pedimento_detallado',
  'PEDIMENTO SIMPLIFICADO': 'pedimento_simplificado',
  'PEDIMENTO COMPLEMENTARIO': 'pedimento_detallado',
  // DODA
  'QR DODA': 'doda',
  'DODA': 'doda',
  'DODA PREVIO': 'doda',
  'DESPACHO PREVIO': 'doda',
  // Transport / BL
  'CONOCIMIENTO DE EMBARQUE': 'bol',
  'BILL OF LADING': 'bol',
  'BL': 'bol',
  'BOL': 'bol',
  'GUIA DE EMBARQUE': 'bol',
  'GUIA AEREA': 'bol',
  'AWB': 'bol',
  'CARTA PORTE': 'carta_porte',
  'CARTA DE PORTE': 'carta_porte',
  'CFDI TRASLADO': 'carta_porte',
  // Certificates
  'CERTIFICADO DE ORIGEN': 'certificado_origen',
  'CERTIFICATE OF ORIGIN': 'certificado_origen',
  'T-MEC': 'certificado_origen',
  'USMCA': 'certificado_origen',
  'CERTIFICADO': 'certificado_origen',
  // Value declaration
  'MANIFESTACION DE VALOR': 'mve',
  'MVE': 'mve',
  'MV': 'mve',
  // Compliance / NOM
  'NOM': 'nom',
  'NORMA OFICIAL': 'nom',
  'CERTIFICADO DE ANALISIS': 'coa',
  'COA': 'coa',
  // Accounting
  'CUENTA DE GASTOS': 'cuenta_gastos',
  'CUENTA GASTOS': 'cuenta_gastos',
  'HONORARIOS': 'cuenta_gastos',
  // Permits
  'PERMISO': 'permiso',
  'COFEPRIS': 'permiso',
  // Orders
  'ORDEN DE COMPRA': 'orden_compra',
  'PURCHASE ORDER': 'orden_compra',
  // Validation
  'ARCHIVOS DE VALIDACION': 'archivos_validacion',
  'VALIDACION': 'archivos_validacion',
  // Bodega
  'ENTRADA DE BODEGA': 'entrada_bodega',
  'RECIBO DE ALMACEN': 'entrada_bodega',
  // Catch-all (truly unclassifiable)
  'CARTA': 'otro',
  'OTROS': 'otro',
  'OTRO': 'otro',
}
function mapDocType(wsdlLabel) {
  return DOC_TYPE_MAP[(wsdlLabel || '').toUpperCase()] || 'otro'
}

async function tg(msg) {
  if (process.env.TELEGRAM_SILENT === 'true') return
  if (!TG) return
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' })
  }).catch(() => {})
}


async function notify(company_id, type, severity, title, description, trafico_id) {
  try {
    await supabase.from('notifications').insert({
      company_id: company_id || 'unknown',
      type, severity, title, description,
      trafico_id: trafico_id || null,
      action_url: trafico_id ? `/traficos/${trafico_id}` : null,
      read: false,
    })
  } catch (e) { /* non-fatal */ }
}
function loadCheckpoint() {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) }
  catch { return { completed: [], totalDocs: 0, errors: 0 } }
}
function saveCheckpoint(cp) { fs.writeFileSync(CHECKPOINT, JSON.stringify(cp)) }

async function getKey(existingClient) {
  const client = existingClient || await soap.createClientAsync(process.env.GLOBALPC_WSDL_URL)
  const [auth] = await client.getWSAccesoAsync({
    token: process.env.GLOBALPC_TOKEN,
    usr: process.env.GLOBALPC_USER,
    pwd: process.env.GLOBALPC_PASS
  })
  if (auth.return?.key) {
    return { client, key: auth.return.key }
  }
  throw new Error('WSDL auth failed: ' + (auth.return?.msg || JSON.stringify(auth.return)))
}

async function pullDocsForTrafico(client, key, sCveTrafico) {
  const [result] = await client.getListaDocumentosTraficoAsync({
    clave_trafico: sCveTrafico,
    tipo_documento: '',
    key
  })
  const ret = result?.return

  // Check for WSDL-level errors
  if (ret?.error === '1' || (ret?.error && ret?.error !== '0' && ret?.error !== 'FALSE')) {
    const msg = ret.msg || ''
    // "No se encontraron registros" = genuinely no docs, not a failure
    if (msg.includes('No se encontraron registros')) return { docs: [], needsReauth: false }
    // Key expired or other auth error
    if (msg.includes('Llave') || msg.includes('key') || msg.includes('valida')) {
      return { docs: [], needsReauth: true }
    }
    // Unknown error — log but don't reauth
    return { docs: [], needsReauth: false, error: msg }
  }

  const items = ret?.ListaDocumentosTrafico?.item
  if (!items) return { docs: [], needsReauth: false }
  const docs = Array.isArray(items) ? items : [items]
  return { docs, needsReauth: false }
}

async function run() {
  console.log('\n\uD83D\uDCC4 WSDL DOCUMENT PULL v2')
  console.log('\u2550'.repeat(50))

  // Step 1: Get all sCveTrafico from GlobalPC MySQL
  console.log('Connecting to GlobalPC MySQL...')
  const conn = await mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST,
    port: parseInt(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER,
    password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38'
  })

  const [allTraficos] = await conn.execute(
    'SELECT sCveTrafico, sCveCliente, sReferenciaCliente FROM cb_trafico ORDER BY dFechaLlegadaMercancia DESC'
  )
  await conn.end()
  console.log(`\u2705 Loaded ${allTraficos.length.toLocaleString()} tr\u00E1ficos from GlobalPC MySQL`)

  // Step 2: Authenticate to WSDL
  let { client, key } = await getKey()
  let sinceLastAuth = 0
  console.log('\u2705 WSDL authenticated')

  // Step 3: Resume from checkpoint
  const cp = loadCheckpoint()
  // Reset checkpoint if it was from old format (Supabase numeric IDs)
  const hasOldFormat = cp.completed.length > 0 && !String(cp.completed[0]).includes('-')
  if (hasOldFormat) {
    console.log('\u26A0\uFE0F  Resetting checkpoint (old format detected — Supabase numeric IDs)')
    cp.completed = []
    cp.totalDocs = 0
    cp.errors = 0
    saveCheckpoint(cp)
  }

  const completedSet = new Set(cp.completed)
  const remaining = allTraficos.filter(t => !completedSet.has(t.sCveTrafico))
  console.log(`Already done: ${completedSet.size} \u00B7 Remaining: ${remaining.length}`)

  await tg(`\uD83D\uDCC4 <b>WSDL doc pull v2 iniciado</b>\n${remaining.length} tr\u00E1ficos (sCveTrafico format)\n\u2014 CRUZ \uD83E\uDD80`)

  let docsFound = cp.totalDocs
  let errors = cp.errors
  let processed = 0
  let noDocsCount = 0

  for (const t of remaining) {
    try {
      // Proactive re-auth every REAUTH_INTERVAL requests
      sinceLastAuth++
      if (sinceLastAuth >= REAUTH_INTERVAL) {
        try {
          const refreshed = await getKey(client)
          client = refreshed.client
          key = refreshed.key
          sinceLastAuth = 0
        } catch (e) {
          console.error('\n  \u26A0\uFE0F  Proactive re-auth failed:', e.message)
        }
      }

      const result = await pullDocsForTrafico(client, key, t.sCveTrafico)

      // Handle re-auth signal
      if (result.needsReauth) {
        console.log('\n  \uD83D\uDD11 Key expired \u2014 re-authenticating...')
        try {
          const refreshed = await getKey(client)
          client = refreshed.client
          key = refreshed.key
          sinceLastAuth = 0
          // Retry this tráfico with new key
          const retry = await pullDocsForTrafico(client, key, t.sCveTrafico)
          if (retry.docs.length > 0) {
            const ok = await insertDocs(retry.docs, t)
            if (ok) docsFound += retry.docs.length
            else errors++
          } else {
            noDocsCount++
          }
        } catch (e) {
          console.error('\n  \u274C Re-auth failed:', e.message)
          errors++
          break // Can't continue without a valid key
        }
      } else if (result.error) {
        errors++
        fs.appendFileSync(ERROR_LOG, `${new Date().toISOString()} | ${t.sCveTrafico} | ${result.error}\n`)
        await notify(t.sCveCliente, 'doc_pull_failed', 'warning',
          `Documento no encontrado — ${t.sCveTrafico}`,
          `WSDL error: ${result.error}`,
          t.sCveTrafico)
      } else if (result.docs.length > 0) {
        const ok = await insertDocs(result.docs, t)
        if (ok) {
          docsFound += result.docs.length
          if (result.docs.length > 0) {
            await notify(t.sCveCliente, 'doc_auto_pulled', 'success',
              `${result.docs.length} doc(s) obtenidos — ${t.sCveTrafico}`,
              `${result.docs.length} documentos extraídos de WSDL automáticamente`,
              t.sCveTrafico)
          }
        } else errors++
      } else {
        noDocsCount++
      }

      cp.completed.push(t.sCveTrafico)
      processed++

      // Checkpoint every 50
      if (processed % 50 === 0) {
        cp.totalDocs = docsFound
        cp.errors = errors
        saveCheckpoint(cp)
        process.stdout.write(`\r  ${processed.toLocaleString()} / ${remaining.length.toLocaleString()} \u00B7 ${docsFound.toLocaleString()} docs \u00B7 ${noDocsCount.toLocaleString()} empty \u00B7 ${errors} err`)
      }

      // Telegram every 500
      if (processed % 500 === 0) {
        await tg(`\uD83D\uDCC4 WSDL: ${processed.toLocaleString()} / ${remaining.length.toLocaleString()} \u00B7 ${docsFound.toLocaleString()} docs \u00B7 ${errors} err`)
      }

      // 300ms delay
      await new Promise(r => setTimeout(r, 300))

    } catch (e) {
      errors++
      fs.appendFileSync(ERROR_LOG, `${new Date().toISOString()} | ${t.sCveTrafico} | EXCEPTION: ${e.message?.substring(0, 200)}\n`)
      if (errors <= 10) console.error('\n  Error on', t.sCveTrafico, ':', e.message?.substring(0, 100))

      // Re-auth on exception if key-related
      if (e.message?.includes('Llave') || e.message?.includes('key') || e.message?.includes('valida')) {
        console.log('\n  \uD83D\uDD11 Re-authenticating after exception...')
        try {
          const refreshed = await getKey(client)
          client = refreshed.client
          key = refreshed.key
          sinceLastAuth = 0
        } catch { break }
      }
    }
  }

  cp.totalDocs = docsFound
  cp.errors = errors
  saveCheckpoint(cp)

  console.log(`\n\u2705 Done. Processed: ${processed.toLocaleString()} \u00B7 Docs: ${docsFound.toLocaleString()} \u00B7 No docs: ${noDocsCount.toLocaleString()} \u00B7 Errors: ${errors}`)

  const { count } = await supabase.from('expediente_documentos').select('*', { count: 'exact', head: true })
  console.log(`expediente_documentos total: ${(count || 0).toLocaleString()}`)

  await tg(`\u2705 <b>WSDL doc pull v2 complete</b>\n${processed.toLocaleString()} tr\u00E1ficos \u00B7 ${docsFound.toLocaleString()} docs\nNo docs: ${noDocsCount.toLocaleString()} \u00B7 Errors: ${errors}\nTotal expediente_documentos: ${(count || 0).toLocaleString()}\n\u2014 CRUZ \uD83E\uDD80`)
}

async function insertDocs(docs, trafico) {
  const rows = docs.map(d => ({
    pedimento_id: trafico.sCveTrafico,
    doc_type: mapDocType(d.tipo_documento),
    file_name: d.descripcion || '',
    file_url: `globalpc://doc/${d.id}`,
    company_id: trafico.sCveCliente || 'unknown',
    uploaded_by: 'globalpc_wsdl',
    metadata: { globalpc_doc_id: d.id || null, id_tipo_documento: d.id_tipo_documento || null, wsdl_label: d.tipo_documento }
  }))

  const { error } = await supabase.from('expediente_documentos').insert(rows)
  if (error && !error.message.includes('duplicate')) {
    fs.appendFileSync(ERROR_LOG, `${new Date().toISOString()} | ${trafico.sCveTrafico} | INSERT: ${error.message}\n`)
    return false
  }
  return true
}

run().catch(async (e) => {
  console.error('Fatal:', e)
  await tg(`\uD83D\uDD34 <b>WSDL doc pull v2 FATAL</b>\n${e.message}\n\u2014 CRUZ \uD83E\uDD80`)
  process.exit(1)
})
