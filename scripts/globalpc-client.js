const soap = require('soap')
require('dotenv').config({ path: '.env.local' })

const WSDL = process.env.GLOBALPC_WSDL_URL
const USER = process.env.GLOBALPC_USER
const PASS = process.env.GLOBALPC_PASS

// Document type codes — how GlobalPC refers to each of the 61 types
// UPDATE THESE with the actual GlobalPC doc type codes Mario provides
const GLOBALPC_DOC_CODES = {
  factura_comercial:       'A01',
  packing_list:            'A02',
  bill_of_lading:          'A03',
  purchase_order:          'A04',
  cove:                    'B01',
  mve_folio:               'B02',
  comprobante_pago:        'B03',
  cfdi_xml:                'B04',
  vucem_acuse:             'B05',
  usmca_cert:              'C01',
  eur1:                    'C02',
  pais_origen_declaration: 'C03',
  complemento_carta_porte: 'D01',
  cfdi_traslado:           'D02',
  nom_cert:                'E01',
  cofepris_permit:         'E02',
  semarnat_permit:         'E03',
  se_permit:               'E04',
  immex_auth:              'E05',
  carta_porte:             'F01',
  airway_bill:             'F02',
  insurance_cert:          'F03',
  bl_mexicano:             'F04',
  proof_of_payment:        'G01',
  freight_invoice:         'G02',
  bank_transfer:           'G03',
  poder_notarial:          'H01',
  rfc_document:            'H02',
  acta_constitutiva:       'H03',
  msds:                    'I01',
  technical_datasheet:     'I02',
  photos:                  'I03',
  damage_report:           'I04',
  purchase_contract:       'J01',
  maquila_agreement:       'J02',
  supply_agreement:        'J03',
  rectificacion:           'K01',
  escrito_libre:           'K02',
  note_of_protest:         'K03',
  inspection_report:       'K04',
  cert_analysis:           'K05',
  cert_conformity:         'K06',
  lab_test:                'K07',
  fumigation_cert:         'K08',
  weighing_cert:           'K09',
  temperature_log:         'K10',
  seal_cert:               'K11',
  manifest:                'K12',
  devan_report:            'K13',
}

let client = null

async function getClient() {
  if (client) return client
  if (!WSDL) throw new Error('GLOBALPC_WSDL_URL not set in .env.local')
  client = await soap.createClientAsync(WSDL)
  return client
}

async function authenticate() {
  const c = await getClient()
  const result = await c.LoginAsync({
    usuario: USER,
    contrasena: PASS
  })
  return result[0]?.token || result[0]?.Token
}

async function getTraficos(token, claveCliente, empresa) {
  const c = await getClient()
  const result = await c.GetTraficosAsync({
    token,
    clave_cliente: claveCliente,
    empresa: empresa,
  })
  return result[0]?.traficos || result[0]?.Traficos || []
}

async function getDocument(token, trafico, docCode) {
  const c = await getClient()
  try {
    const result = await c.GetDocumentoAsync({
      token,
      trafico,
      tipo_documento: docCode
    })
    const doc = result[0]?.documento || result[0]?.Documento
    if (!doc) return null
    return {
      found: true,
      nombre: doc.nombre || doc.Nombre || `${trafico}_${docCode}`,
      url: doc.url || doc.URL || null,
      base64: doc.contenido || doc.Contenido || null,
    }
  } catch (e) {
    // Document not found for this type — normal
    return null
  }
}

async function testConnection() {
  console.log('🔌 Testing GlobalPC SOAP connection...')

  if (!WSDL) {
    console.log('⏳ GLOBALPC_WSDL_URL not set — connection test skipped')
    console.log('   Add to .env.local when Mario provides the endpoint')
    return false
  }

  try {
    console.log(`   Connecting to: ${WSDL}`)
    const token = await authenticate()
    if (!token) throw new Error('No token returned from Login')
    console.log(`✅ Authenticated — token received`)

    // Test pulling one tráfico list (uses first active client from env or defaults)
    const testClave = process.env.GLOBALPC_TEST_CLAVE || '9254'
    const testEmpresa = process.env.GLOBALPC_TEST_EMPRESA || 'evco'
    const traficos = await getTraficos(token, testClave, testEmpresa)
    console.log(`✅ Got ${traficos.length} traficos from GlobalPC (clave=${testClave})`)

    if (traficos.length > 0) {
      // Test pulling one document
      const first = traficos[0]
      console.log(`   Testing document pull for: ${first.trafico || first.Trafico}`)
      const doc = await getDocument(token, first.trafico || first.Trafico, 'A01')
      console.log(`   Document A01 (Factura): ${doc ? '✅ Found' : '⚠️ Not found (may not exist)'}`)
    }

    return true
  } catch (e) {
    console.error(`❌ Connection failed: ${e.message}`)
    return false
  }
}

module.exports = { getClient, authenticate, getTraficos, getDocument, GLOBALPC_DOC_CODES, testConnection }

// Run test if called directly
if (require.main === module) {
  testConnection().then(ok => {
    if (ok) console.log('\n✅ GlobalPC client ready')
    else console.log('\n⏳ GlobalPC client waiting for credentials')
  }).catch(console.error)
}
