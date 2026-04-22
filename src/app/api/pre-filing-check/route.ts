import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAllDocuments(traficoId: string) {
  const [d1, d2] = await Promise.all([
    supabase.from('documents').select('*').eq('trafico_id', traficoId),
    supabase.from('expediente_documentos').select('*').eq('trafico_id', traficoId)
  ])
  const all = [...(d1.data || []), ...(d2.data || [])]
  return all.filter((d, i, arr) => arr.findIndex(x => x.file_url === d.file_url) === i)
}

async function runPreFilingCheck(traficoId: string, companyId: string) {
  const checks = []

  // 1. Document completeness
  const docs = await getAllDocuments(traficoId)
  const docTypes = docs.map(d => (d.doc_type || d.document_type || '').toUpperCase())
  const required = ['FACTURA', 'PACKING', 'BILL', 'COVE']
  const missing = required.filter(r => !docTypes.some(t => t.includes(r)))
  checks.push({
    name: 'Documentos',
    passed: missing.length === 0,
    message: missing.length === 0
      ? 'Todos los documentos presentes'
      : `Faltan: ${missing.join(', ')}`,
    severity: missing.length > 0 ? 'critical' : 'ok'
  })

  // 2. MVE folio
  const { data: trafico } = await supabase
    .from('traficos').select('*').eq('trafico', traficoId).gte('fecha_llegada', PORTAL_DATE_FROM).single()
  const nowLaredo = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  const mveMandatory = nowLaredo >= new Date('2026-03-31T00:00:00-05:00')
  checks.push({
    name: 'MVE Folio',
    passed: !mveMandatory || !!trafico?.mve_folio,
    message: !mveMandatory ? 'No requerido aún'
      : trafico?.mve_folio ? `Folio: ${trafico.mve_folio}`
      : 'FALTANTE — obligatorio desde 31/03/2026',
    severity: mveMandatory && !trafico?.mve_folio ? 'critical' : 'ok'
  })

  // 3. Value validation
  // globalpc_facturas real columns: valor_comercial, cve_proveedor, cove_vucem.
  // valor, proveedor, cove were phantoms (M15 sweep).
  const { data: facturas } = await supabase
    .from('globalpc_facturas')
    .select('valor_comercial, cve_proveedor, cove_vucem')
    .eq('cve_trafico', traficoId)
  const totalValue = facturas?.reduce((s, f) => s + (f.valor_comercial || 0), 0) || 0
  checks.push({
    name: 'Valor declarado',
    passed: totalValue > 0,
    message: totalValue > 0 ? `$${totalValue.toLocaleString()} USD` : 'Sin valor declarado',
    severity: totalValue === 0 ? 'critical' : 'ok'
  })

  // 4. Risk score
  const { data: risk } = await supabase
    .from('pedimento_risk_scores')
    .select('overall_score, risk_factors')
    .eq('trafico_id', traficoId).single()
  const riskScore = risk?.overall_score || 0
  checks.push({
    name: 'Risk Score',
    passed: riskScore < 50,
    message: `Score: ${riskScore}/100${riskScore >= 50 ? ' — REVISAR' : ''}`,
    severity: riskScore >= 70 ? 'critical' : riskScore >= 50 ? 'warning' : 'ok'
  })

  // 5. Supplier verification
  const suppliers = [...new Set(facturas?.map(f => f.cve_proveedor).filter(Boolean))]
  checks.push({
    name: 'Proveedores',
    passed: suppliers.length > 0,
    message: suppliers.length > 0
      ? `${suppliers.length} proveedor(es): ${suppliers.slice(0, 2).join(', ')}${suppliers.length > 2 ? '...' : ''}`
      : 'Sin proveedores identificados',
    severity: suppliers.length === 0 ? 'warning' : 'ok'
  })

  // 6. T-MEC check
  const { data: supplierNet } = await supabase
    .from('supplier_network')
    .select('tmec_eligible')
    .in('supplier_name', suppliers.length > 0 ? suppliers : ['__none__'])
  const tmecEligible = supplierNet?.some(s => s.tmec_eligible)
  checks.push({
    name: 'T-MEC',
    passed: true,
    message: tmecEligible ? 'Proveedor(es) elegible(s) T-MEC' : 'Verificar elegibilidad',
    severity: 'ok'
  })

  // 7. COVEs
  const coves = facturas?.filter(f => f.cove_vucem).length || 0
  const totalFacturas = facturas?.length || 0
  checks.push({
    name: 'COVEs',
    passed: totalFacturas === 0 || coves === totalFacturas,
    message: `${coves}/${totalFacturas} facturas con COVE`,
    severity: coves < totalFacturas && totalFacturas > 0 ? 'warning' : 'ok'
  })

  const critical = checks.filter(c => c.severity === 'critical').length
  const warnings = checks.filter(c => c.severity === 'warning').length

  return {
    trafico_id: traficoId,
    can_transmit: critical === 0,
    overall: critical > 0 ? 'red' : warnings > 0 ? 'yellow' : 'green',
    checks,
    summary: critical > 0
      ? `NO TRANSMITIR — ${critical} problema(s) critico(s)`
      : warnings > 0
        ? `REVISAR — ${warnings} advertencia(s) antes de transmitir`
        : 'LISTO PARA TRANSMITIR'
  }
}

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const companyId = request.cookies.get('company_id')?.value ?? ''
  const { trafico_id, company_id } = await request.json()
  if (!trafico_id) {
    return NextResponse.json({ error: 'trafico_id required' }, { status: 400 })
  }
  const result = await runPreFilingCheck(trafico_id, company_id || companyId)
  return NextResponse.json(result)
}
