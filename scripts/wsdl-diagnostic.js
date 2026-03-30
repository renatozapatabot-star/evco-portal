#!/usr/bin/env node
/**
 * CRUZ WSDL Diagnostic
 * Tests getListaDocumentosTrafico against 5 tráficos from different date ranges
 * Reports exactly what the WSDL returns — no silent swallowing
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const soap = require('soap')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  console.log('\n🔍 WSDL DIAGNOSTIC — Document Pull Test')
  console.log('═'.repeat(60))

  // Step 1: Pick 5 tráficos from different date ranges
  const ranges = [
    { label: 'Recent (last 30 days)', offset: 0 },
    { label: '6 months ago', offset: 180 },
    { label: '1 year ago', offset: 365 },
    { label: '2 years ago', offset: 730 },
    { label: '3 years ago', offset: 1095 },
  ]

  const samples = []
  for (const range of ranges) {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() - range.offset)
    const dateStr = targetDate.toISOString().split('T')[0]

    // Find a tráfico near this date
    const { data, error } = await supabase
      .from('traficos')
      .select('trafico, fecha_llegada, estatus, pedimento')
      .lte('fecha_llegada', dateStr)
      .order('fecha_llegada', { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) {
      console.log(`  ⚠️  No tráfico found for ${range.label}`)
      continue
    }

    samples.push({ ...data[0], label: range.label })
  }

  console.log(`\nSelected ${samples.length} sample tráficos:`)
  for (const s of samples) {
    console.log(`  ${s.label}: ${s.trafico} (${s.fecha_llegada || 'no date'}) — ${s.estatus || '?'}`)
  }

  // Step 2: Authenticate to WSDL
  console.log('\n--- WSDL Authentication ---')
  let client, key
  try {
    client = await soap.createClientAsync(process.env.GLOBALPC_WSDL_URL)
    console.log('  SOAP client created')
    console.log('  WSDL URL:', process.env.GLOBALPC_WSDL_URL)

    // List available methods
    const desc = client.describe()
    const serviceName = Object.keys(desc)[0]
    const portName = Object.keys(desc[serviceName])[0]
    const methods = Object.keys(desc[serviceName][portName])
    console.log(`  Service: ${serviceName} / ${portName}`)
    console.log(`  Methods: ${methods.join(', ')}`)

    const [auth] = await client.getWSAccesoAsync({
      token: process.env.GLOBALPC_TOKEN,
      usr: process.env.GLOBALPC_USER,
      pwd: process.env.GLOBALPC_PASS
    })
    console.log('  Auth response:', JSON.stringify(auth.return, null, 2))

    if (auth.return?.key) {
      key = auth.return.key
      console.log(`  ✅ Key obtained: ${key.substring(0, 20)}...`)
    } else {
      console.log('  ❌ No key in auth response')
      return
    }
  } catch (e) {
    console.error('  ❌ Auth failed:', e.message)
    return
  }

  // Step 3: Test each sample tráfico — NO silent catch
  console.log('\n--- Document Pull Tests ---')

  for (const sample of samples) {
    console.log(`\n  📋 ${sample.label}: ${sample.trafico}`)
    console.log(`     fecha: ${sample.fecha_llegada} | estatus: ${sample.estatus} | ped: ${sample.pedimento || 'none'}`)

    try {
      const [result] = await client.getListaDocumentosTraficoAsync({
        clave_trafico: sample.trafico,
        tipo_documento: '',
        key
      })

      // Log raw response structure (not just items)
      const ret = result?.return
      if (!ret) {
        console.log('     ⚠️  result.return is null/undefined')
        console.log('     Raw result keys:', result ? Object.keys(result) : 'null')
        continue
      }

      // Check for error in response
      if (ret.error && ret.error !== 'FALSE') {
        console.log(`     ❌ WSDL error: ${ret.error}`)
        if (ret.msg) console.log(`     Message: ${ret.msg}`)
        continue
      }

      const lista = ret.ListaDocumentosTrafico
      if (!lista) {
        console.log('     📭 No ListaDocumentosTrafico in response')
        console.log('     Response keys:', Object.keys(ret))
        // Print the full response for debugging (truncated)
        const retStr = JSON.stringify(ret)
        console.log('     Full response:', retStr.substring(0, 500))
        continue
      }

      const items = lista.item
      if (!items) {
        console.log('     📭 ListaDocumentosTrafico exists but no items')
        console.log('     Lista keys:', Object.keys(lista))
        continue
      }

      const docs = Array.isArray(items) ? items : [items]
      console.log(`     ✅ ${docs.length} document(s) found:`)
      for (const doc of docs.slice(0, 5)) {
        console.log(`        - ${doc.tipo_documento || '?'}: ${doc.descripcion || '(no desc)'} [id: ${doc.id || '?'}]`)
      }
      if (docs.length > 5) console.log(`        ... and ${docs.length - 5} more`)

    } catch (e) {
      console.log(`     ❌ EXCEPTION: ${e.message}`)
      // Check if it's a key expiration
      if (e.message?.includes('Llave') || e.message?.includes('key') || e.message?.includes('expired')) {
        console.log('     ⚠️  Possible key expiration — re-authenticating...')
        try {
          const [auth] = await client.getWSAccesoAsync({
            token: process.env.GLOBALPC_TOKEN,
            usr: process.env.GLOBALPC_USER,
            pwd: process.env.GLOBALPC_PASS
          })
          key = auth.return.key
          console.log(`     ✅ Re-authenticated: ${key.substring(0, 20)}...`)
        } catch (reAuthErr) {
          console.log(`     ❌ Re-auth failed: ${reAuthErr.message}`)
        }
      }
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 500))
  }

  // Step 4: Also check — how many of the first 100 completed tráficos had docs?
  console.log('\n--- Checkpoint Analysis ---')
  try {
    const fs = require('fs')
    const cp = JSON.parse(fs.readFileSync('/tmp/wsdl-doc-pull-checkpoint.json', 'utf8'))
    console.log(`  Completed: ${cp.completed.length}`)
    console.log(`  Total docs: ${cp.totalDocs}`)
    console.log(`  Errors: ${cp.errors}`)
    console.log(`  Docs per tráfico: ${(cp.totalDocs / cp.completed.length).toFixed(4)}`)

    // Check if the 106 docs came from the first N tráficos
    const { data: docsInDb } = await supabase
      .from('expediente_documentos')
      .select('trafico_id')
      .eq('source', 'globalpc_wsdl')

    if (docsInDb) {
      const uniqueTraficos = new Set(docsInDb.map(d => d.trafico_id))
      console.log(`  Tráficos with docs in DB: ${uniqueTraficos.size}`)
      console.log(`  Docs in expediente_documentos (wsdl source): ${docsInDb.length}`)
    }
  } catch (e) {
    console.log(`  Checkpoint read error: ${e.message}`)
  }

  console.log('\n' + '═'.repeat(60))
  console.log('Diagnostic complete.\n')
}

run().catch(e => { console.error('Fatal:', e); process.exit(1) })
