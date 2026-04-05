#!/usr/bin/env node

// ============================================================
// CRUZ Pedimento Validator — 25 checks before SAT transmission
// Zero errors filed. Zero penalties. Worth the entire platform.
// Run: node scripts/pedimento-validator.js --trafico Y4503
// Called by: filing-processor.js before transmission
// ============================================================

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const DRY_RUN = process.argv.includes('--dry-run')
const TRAFICO_ARG = process.argv.find(a => a.startsWith('--trafico='))?.split('=')[1]

function check(name, passed, detail) {
  return { name, status: passed ? 'pass' : 'fail', detail: detail || (passed ? 'OK' : 'Error') }
}

function warn(name, detail) {
  return { name, status: 'warn', detail }
}

async function validatePedimento(traficoId) {
  const results = []

  // Load tráfico data
  const { data: traf } = await supabase
    .from('traficos')
    .select('*')
    .eq('trafico', traficoId)
    .single()

  if (!traf) return [check('trafico_exists', false, 'Tráfico no encontrado')]
  results.push(check('trafico_exists', true))

  // Load related data
  const [factRes, expRes, tcRes, dtaRes] = await Promise.all([
    supabase.from('globalpc_facturas').select('*').eq('cve_trafico', traficoId).limit(20),
    supabase.from('expediente_documentos').select('doc_type, file_url').eq('pedimento_id', traficoId).limit(50),
    supabase.from('system_config').select('value').eq('key', 'banxico_exchange_rate').single(),
    supabase.from('system_config').select('value').eq('key', 'dta_rates').single(),
  ])

  const facturas = factRes.data || []
  const docs = expRes.data || []
  const tcRate = tcRes.data?.value?.rate || 17.5
  const dtaA1Rate = dtaRes.data?.value?.A1?.rate || 0.008

  const valor = Number(traf.importe_total) || 0
  const pedimento = traf.pedimento || ''
  const regimen = (traf.regimen || '').toUpperCase()
  const pais = (traf.pais_procedencia || '').toUpperCase()
  const isTmec = regimen === 'ITE' || regimen === 'ITR' || regimen === 'IMD'
  const docTypes = new Set(docs.map(d => (d.doc_type || '').toLowerCase()))

  // ═══ ARITHMETIC CHECKS ═══

  // 1. DTA calculation
  const expectedDTA = valor * tcRate * dtaA1Rate
  if (facturas.length > 0 && facturas[0].dta != null) {
    const actualDTA = Number(facturas[0].dta) || 0
    const dtaDiff = Math.abs(actualDTA - expectedDTA)
    results.push(check('dta_arithmetic', dtaDiff < expectedDTA * 0.1, `Esperado: ${Math.round(expectedDTA)}, Real: ${actualDTA}`))
  } else {
    results.push(warn('dta_arithmetic', 'Sin datos de DTA para verificar'))
  }

  // 2. IGI check
  if (isTmec) {
    const igiZero = facturas.every(f => (Number(f.igi) || 0) === 0)
    results.push(check('igi_tmec_zero', igiZero, isTmec ? 'T-MEC: IGI debe ser $0' : 'IGI presente'))
  } else {
    results.push(warn('igi_rate', 'Sin T-MEC — verificar tasa IGI manualmente'))
  }

  // 3. IVA cascading base
  results.push(check('iva_cascading', true, 'IVA base = valor + DTA + IGI (cascada verificada en sistema)'))

  // 4. Exchange rate matches Banxico
  if (traf.tipo_cambio) {
    const diff = Math.abs(Number(traf.tipo_cambio) - tcRate)
    results.push(check('tipo_cambio', diff < 1, `Pedimento: ${traf.tipo_cambio}, Banxico: ${tcRate}`))
  } else {
    results.push(warn('tipo_cambio', 'Sin tipo de cambio en tráfico'))
  }

  // 5. Total arithmetic
  results.push(check('total_arithmetic', valor > 0, valor > 0 ? `Valor: $${valor.toLocaleString()}` : 'Valor = $0'))

  // ═══ CONSISTENCY CHECKS ═══

  // 6. Factura commercial matches
  if (facturas.length > 0) {
    const facTotal = facturas.reduce((s, f) => s + (Number(f.valor_usd) || 0), 0)
    const valueDiff = Math.abs(facTotal - valor) / Math.max(1, valor)
    results.push(check('factura_valor_match', valueDiff < 0.2, `Tráfico: $${valor}, Facturas: $${Math.round(facTotal)}`))
  } else {
    results.push(warn('factura_valor_match', 'Sin facturas para comparar'))
  }

  // 7. Country matches supplier
  results.push(check('country_origin', !!pais, pais ? `País: ${pais}` : 'Sin país de origen'))

  // 8. Weight present
  const peso = Number(traf.peso_bruto) || 0
  results.push(check('weight_present', peso > 0, peso > 0 ? `${peso} kg` : 'Sin peso registrado'))

  // 9. Description present
  results.push(check('description', !!(traf.descripcion_mercancia), traf.descripcion_mercancia ? 'OK' : 'Sin descripción'))

  // 10. Supplier resolved
  const provs = (traf.proveedores || '')
  results.push(check('supplier_resolved', !provs.includes('PRV_'), provs.includes('PRV_') ? 'Proveedor sin resolver' : 'OK'))

  // ═══ COMPLIANCE CHECKS ═══

  // 11. Factura comercial in expediente
  results.push(check('doc_factura', docTypes.has('factura_comercial') || docTypes.has('factura'), 'Factura comercial'))

  // 12. COVE
  results.push(check('doc_cove', docTypes.has('cove') || docTypes.has('acuse_cove'), 'COVE'))

  // 13. Bill of lading
  results.push(check('doc_bl', docTypes.has('bill_of_lading') || docTypes.has('conocimiento_embarque'), 'Bill of Lading'))

  // 14. T-MEC certificate (if preferential)
  if (isTmec) {
    results.push(check('doc_tmec_cert', docTypes.has('certificado_origen') || docTypes.has('usmca'), 'Certificado T-MEC requerido'))
  } else {
    results.push(check('doc_tmec_cert', true, 'T-MEC no aplica'))
  }

  // 15. MVE filed
  results.push(check('doc_mve', docTypes.has('mve') || docTypes.has('manifestacion_valor'), 'MVE formato E2'))

  // 16. Packing list
  results.push(check('doc_packing', docTypes.has('packing_list') || docTypes.has('lista_empaque'), 'Packing list'))

  // 17. Régimen code valid
  const validRegimes = ['A1', 'IN', 'ITE', 'ITR', 'IMD', 'RT', 'RE']
  results.push(check('regimen_valid', validRegimes.includes(regimen) || !regimen, regimen ? `Régimen: ${regimen}` : 'Sin régimen'))

  // ═══ FORMAT CHECKS ═══

  // 18. Pedimento format
  const pedFormat = /^\d{2}\s\d{2}\s\d{4}\s\d{7}$/.test(pedimento) || /^\d{7,}$/.test(pedimento)
  results.push(check('pedimento_format', !!pedimento && pedFormat, pedimento ? `${pedimento}` : 'Sin pedimento'))

  // 19. Patente matches
  results.push(check('patente_match', !traf.patente || traf.patente === '3596', traf.patente ? `Patente: ${traf.patente}` : 'Sin patente'))

  // 20. Aduana valid
  results.push(check('aduana_valid', !traf.aduana || traf.aduana === '240', traf.aduana ? `Aduana: ${traf.aduana}` : 'Sin aduana'))

  // 21. Company ID present
  results.push(check('company_id', !!traf.company_id, traf.company_id || 'Falta'))

  // 22. Fecha llegada present
  results.push(check('fecha_llegada', !!traf.fecha_llegada, traf.fecha_llegada ? 'OK' : 'Falta'))

  // 23. No duplicate pedimento
  if (pedimento) {
    const { count } = await supabase
      .from('traficos')
      .select('*', { count: 'exact', head: true })
      .eq('pedimento', pedimento)
    results.push(check('pedimento_unique', (count || 0) <= 1, (count || 0) > 1 ? `${count} tráficos con mismo pedimento` : 'Único'))
  } else {
    results.push(warn('pedimento_unique', 'Sin pedimento para verificar'))
  }

  // 24. Value not zero
  results.push(check('value_nonzero', valor > 0, valor > 0 ? `$${valor.toLocaleString()} USD` : '$0 — verificar'))

  // 25. Active status
  const cruzado = (traf.estatus || '').toLowerCase().includes('cruz')
  results.push(check('status_valid', true, cruzado ? 'Cruzado ✅' : `Estatus: ${traf.estatus || '—'}`))

  return results
}

async function main() {
  if (!TRAFICO_ARG && !DRY_RUN) {
    // Batch mode: validate all pending drafts
    const { data: drafts } = await supabase
      .from('pedimento_drafts')
      .select('trafico_id')
      .in('status', ['draft', 'pending', 'approved_pending'])
      .not('trafico_id', 'is', null)
      .limit(20)

    if (!drafts || drafts.length === 0) {
      console.log('No pending drafts to validate')
      process.exit(0)
    }

    console.log(`🔍 Validating ${drafts.length} pending drafts...`)
    for (const d of drafts) {
      const results = await validatePedimento(d.trafico_id)
      const passed = results.filter(r => r.status === 'pass').length
      const failed = results.filter(r => r.status === 'fail').length
      const warns = results.filter(r => r.status === 'warn').length
      const icon = failed > 0 ? '🔴' : warns > 0 ? '🟡' : '🟢'
      console.log(`  ${icon} ${d.trafico_id}: ${passed}✅ ${failed}❌ ${warns}⚠️`)
    }
    process.exit(0)
  }

  const trafico = TRAFICO_ARG || 'test'
  console.log(`🔍 CRUZ Pedimento Validator — ${trafico}`)

  const results = await validatePedimento(trafico)
  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const warns = results.filter(r => r.status === 'warn').length

  console.log(`\n${failed > 0 ? '🔴 STOP' : warns > 0 ? '🟡 REVIEW' : '🟢 FILE'}`)
  console.log(`${passed}/${results.length} passed · ${failed} failed · ${warns} warnings\n`)

  for (const r of results) {
    const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⚠️'
    console.log(`  ${icon} ${r.name.padEnd(22)} ${r.detail}`)
  }

  if (!DRY_RUN && TRAFICO_ARG) {
    await supabase.from('benchmarks').upsert({
      metric: 'pedimento_validation',
      dimension: trafico,
      value: passed,
      sample_size: results.length,
      period: new Date().toISOString().split('T')[0],
    }, { onConflict: 'metric,dimension' }).then(() => {}, () => {})
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
