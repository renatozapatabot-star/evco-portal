#!/usr/bin/env node
/**
 * CRUZ WSDL Diagnostic v2
 * Deep investigation: what does error:0 mean? Try different ID formats.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const soap = require('soap')
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  console.log('\n🔬 WSDL DIAGNOSTIC v2 — Deep Investigation')
  console.log('═'.repeat(60))

  const client = await soap.createClientAsync(process.env.GLOBALPC_WSDL_URL)
  const [auth] = await client.getWSAccesoAsync({
    token: process.env.GLOBALPC_TOKEN,
    usr: process.env.GLOBALPC_USER,
    pwd: process.env.GLOBALPC_PASS
  })
  const key = auth.return.key
  console.log('✅ Authenticated\n')

  // Get a recent EVCO tráfico (clave 9254)
  const { data: sample } = await supabase
    .from('traficos')
    .select('trafico, company_id, pedimento, fecha_llegada')
    .eq('company_id', 'evco')
    .order('fecha_llegada', { ascending: false })
    .limit(3)

  console.log('Sample EVCO tráficos:', sample?.length || 0)
  if (!sample || sample.length === 0) { console.log('  No EVCO tráficos found'); return }
  for (const t of sample) {
    console.log(`  ${t.trafico} | ped: ${t.pedimento} | ${t.fecha_llegada}`)
  }

  const testTrafico = sample[0]

  // Test 1: Full tráfico ID as-is (e.g., "9254-Y4466")
  console.log(`\n--- Test 1: Full ID "${testTrafico.trafico}" ---`)
  await testCall(client, key, testTrafico.trafico)

  // Test 2: Just the suffix (e.g., "Y4466")
  const suffix = testTrafico.trafico.split('-')[1]
  if (suffix) {
    console.log(`\n--- Test 2: Suffix only "${suffix}" ---`)
    await testCall(client, key, suffix)
  }

  // Test 3: Just the clave-prefix number (e.g., "9254")
  const prefix = testTrafico.trafico.split('-')[0]
  console.log(`\n--- Test 3: Prefix only "${prefix}" ---`)
  await testCall(client, key, prefix)

  // Test 4: Without dash (e.g., "9254Y4466")
  const noDash = testTrafico.trafico.replace('-', '')
  console.log(`\n--- Test 4: No dash "${noDash}" ---`)
  await testCall(client, key, noDash)

  // Test 5: Pedimento number
  if (testTrafico.pedimento) {
    console.log(`\n--- Test 5: Pedimento "${testTrafico.pedimento}" ---`)
    await testCall(client, key, testTrafico.pedimento)
  }

  // Test 6: Try getListaDocumentosCliente (client-level, not tráfico-level)
  console.log(`\n--- Test 6: getListaDocumentosCliente (client=9254, last 5 docs) ---`)
  try {
    // First check what parameters this method expects
    const desc = client.describe()
    const svc = Object.keys(desc)[0]
    const port = Object.keys(desc[svc])[0]
    const methodDef = desc[svc][port]['getListaDocumentosCliente']
    console.log('  Method signature:', JSON.stringify(methodDef, null, 2))

    const [result] = await client.getListaDocumentosClienteAsync({
      clave_cliente: '9254',
      tipo_documento: '',
      key
    })
    const ret = result?.return
    console.log('  Response keys:', ret ? Object.keys(ret) : 'null')
    const retStr = JSON.stringify(ret)
    console.log('  Response:', retStr.substring(0, 1000))

    if (ret?.ListaDocumentosCliente?.item) {
      const items = Array.isArray(ret.ListaDocumentosCliente.item) ? ret.ListaDocumentosCliente.item : [ret.ListaDocumentosCliente.item]
      console.log(`  ✅ ${items.length} document(s) found`)
      for (const d of items.slice(0, 5)) {
        console.log(`     - ${d.tipo_documento || '?'}: ${d.descripcion || '?'} | trafico: ${d.clave_trafico || '?'}`)
      }
    }
  } catch (e) {
    console.log(`  ❌ ${e.message}`)
  }

  // Test 7: Try getTipoDocumentosTrafico — what doc types are available?
  console.log(`\n--- Test 7: getTipoDocumentosTrafico for "${testTrafico.trafico}" ---`)
  try {
    const [result] = await client.getTipoDocumentosTraficoAsync({
      clave_trafico: testTrafico.trafico,
      key
    })
    const ret = result?.return
    console.log('  Response:', JSON.stringify(ret).substring(0, 1000))
  } catch (e) {
    console.log(`  ❌ ${e.message}`)
  }

  // Test 8: Try getListaDocumentosCliente with different clave formats
  console.log(`\n--- Test 8: getListaDocumentosCliente with clave "Z9C" (token) ---`)
  try {
    const [result] = await client.getListaDocumentosClienteAsync({
      clave_cliente: process.env.GLOBALPC_TOKEN,
      tipo_documento: '',
      key
    })
    const ret = result?.return
    const retStr = JSON.stringify(ret)
    console.log('  Response:', retStr.substring(0, 1000))
  } catch (e) {
    console.log(`  ❌ ${e.message}`)
  }

  // Test 9: Check what the first 106 successful docs look like
  console.log(`\n--- Test 9: expediente_documentos from WSDL source ---`)
  const { data: existingDocs } = await supabase
    .from('expediente_documentos')
    .select('trafico_id, doc_type, file_name, globalpc_doc_id')
    .eq('source', 'globalpc_wsdl')
    .limit(10)

  if (existingDocs && existingDocs.length > 0) {
    console.log(`  ${existingDocs.length} sample docs in DB:`)
    for (const d of existingDocs) {
      console.log(`     ${d.trafico_id} | ${d.doc_type} | ${d.file_name} | id:${d.globalpc_doc_id}`)
    }

    // What tráfico IDs had docs?
    const { data: allDocs } = await supabase
      .from('expediente_documentos')
      .select('trafico_id')
      .eq('source', 'globalpc_wsdl')

    if (allDocs) {
      const unique = [...new Set(allDocs.map(d => d.trafico_id))]
      console.log(`\n  Unique tráficos with WSDL docs: ${unique.length}`)
      console.log(`  IDs: ${unique.slice(0, 20).join(', ')}`)

      // Check if these IDs follow a different pattern
      if (unique.length > 0) {
        // Query the tráficos table for these IDs to see their dates
        const { data: docTraficos } = await supabase
          .from('traficos')
          .select('trafico, fecha_llegada, company_id')
          .in('trafico', unique.slice(0, 10))
        if (docTraficos) {
          console.log('\n  Tráficos that had docs:')
          for (const t of docTraficos) {
            console.log(`     ${t.trafico} | ${t.fecha_llegada} | client: ${t.company_id}`)
          }
        }
      }
    }
  } else {
    console.log('  No WSDL-source docs in DB')
  }

  console.log('\n' + '═'.repeat(60))
}

async function testCall(client, key, claveTrafico) {
  try {
    const [result] = await client.getListaDocumentosTraficoAsync({
      clave_trafico: claveTrafico,
      tipo_documento: '',
      key
    })
    const ret = result?.return
    if (!ret) {
      console.log('  null response')
      return
    }
    console.log('  Response keys:', Object.keys(ret))
    const retStr = JSON.stringify(ret)
    console.log('  Response:', retStr.substring(0, 800))

    if (ret.ListaDocumentosTrafico?.item) {
      const items = Array.isArray(ret.ListaDocumentosTrafico.item) ? ret.ListaDocumentosTrafico.item : [ret.ListaDocumentosTrafico.item]
      console.log(`  ✅ ${items.length} doc(s)`)
      for (const d of items.slice(0, 3)) {
        console.log(`     - ${d.tipo_documento}: ${d.descripcion}`)
      }
    }
  } catch (e) {
    console.log(`  ❌ Exception: ${e.message?.substring(0, 200)}`)
  }
}

run().catch(e => { console.error('Fatal:', e); process.exit(1) })
