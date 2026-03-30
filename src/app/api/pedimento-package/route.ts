import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const REQUIRED_DOCS = ['factura_comercial', 'packing_list', 'bill_of_lading', 'cove', 'mve_folio']
const DOC_LABELS: Record<string, string> = {
  factura_comercial: 'Factura Comercial', packing_list: 'Packing List',
  bill_of_lading: 'Bill of Lading', cove: 'COVE', mve_folio: 'MVE Folio',
  usmca_cert: 'Certificado USMCA', cfdi_xml: 'CFDI XML', carta_porte: 'Carta Porte',
}

export async function GET(request: NextRequest) {
  const trafico = request.nextUrl.searchParams.get('trafico')
  if (!trafico) return NextResponse.json({ error: 'trafico param required' }, { status: 400 })

  // Parallel fetches
  const [trafRes, factRes, partRes, provRes, docRes, riskRes, scRes, tcRes] = await Promise.all([
    supabase.from('traficos').select('*').eq('trafico', trafico).single(),
    supabase.from('globalpc_facturas').select('*').eq('cve_trafico', trafico),
    supabase.from('globalpc_partidas').select('*').eq('cve_trafico', trafico),
    supabase.from('globalpc_proveedores').select('*').limit(100),
    supabase.from('expediente_documentos').select('doc_type, file_url, nombre').or(`pedimento_id.eq.${trafico},pedimento_id.eq.${trafico.includes('-') ? trafico.split('-').slice(1).join('-') : trafico}`),
    supabase.from('pedimento_risk_scores').select('score, risk_factors').eq('trafico_id', trafico).single(),
    supabase.from('supplier_contacts').select('supplier_name, usmca_eligible').limit(200),
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '.supabase.co')}/rest/v1/`, { headers: {} }).catch(() => null),
  ])

  const traf = trafRes.data
  if (!traf) return NextResponse.json({ error: 'Trafico not found' }, { status: 404 })

  const facturas = factRes.data || []
  const partidas = partRes.data || []
  const docs = docRes.data || []
  const riskScore = riskRes.data?.score || 0
  const riskFactors = riskRes.data?.risk_factors || []
  const tmecSuppliers = new Set((scRes.data || []).filter((s: any) => s.usmca_eligible).map((s: any) => s.supplier_name?.toUpperCase()))

  // Get tipo de cambio from API
  let tipoCambio = 20.50
  try {
    const tcData = await fetch(`${request.nextUrl.origin}/api/tipo-cambio`).then(r => r.json())
    if (tcData?.rate) tipoCambio = Number(tcData.rate)
  } catch {}

  // Calculate financials
  const valorUSD = facturas.reduce((s: number, f: any) => s + (Number(f.valor_comercial) || 0), 0)
  const valorMXN = valorUSD * tipoCambio

  // Check T-MEC eligibility
  const supplierName = facturas[0]?.cve_proveedor || ''
  const tmecApplicable = tmecSuppliers.has(supplierName.toUpperCase())
  const usmcaCertOnFile = docs.some((d: any) => d.doc_type?.includes('usmca') || d.doc_type?.includes('tmec'))

  const igiRate = tmecApplicable && usmcaCertOnFile ? 0 : 0.05
  const dta = valorMXN * 0.008
  const igi = valorMXN * igiRate
  const iva = (valorMXN + dta + igi) * 0.16
  const totalGravamen = dta + igi + iva

  // Document completeness
  const presentDocs = docs.map((d: any) => d.doc_type).filter(Boolean)
  const missingDocs = REQUIRED_DOCS.filter(d => !presentDocs.some(p => p.includes(d.split('_')[0])))
  const blockers: string[] = []
  if (missingDocs.length > 0) blockers.push(`Faltan ${missingDocs.length} documentos: ${missingDocs.map(d => DOC_LABELS[d] || d).join(', ')}`)
  if (!traf.pedimento) blockers.push('Sin numero de pedimento')
  if (riskScore > 70) blockers.push(`Risk score alto: ${riskScore}/100`)

  // Build fracciones list
  const fracciones = partidas.map((p: any) => ({
    fraccion: p.fraccion_arancelaria || p.fraccion || '',
    descripcion: p.descripcion || p.descripcion_mercancia || '',
    cantidad: Number(p.cantidad) || 0,
    valor: Number(p.valor_comercial) || Number(p.precio_unitario) || 0,
  }))

  // Proveedores
  const proveedores = [...new Set(facturas.map((f: any) => f.cve_proveedor).filter(Boolean))]

  return NextResponse.json({
    trafico,
    importador: { rfc: 'EPM001109I74', nombre: 'EVCO PLASTICS DE MEXICO S.A. DE C.V.' },
    proveedores,
    valor_aduana_usd: Math.round(valorUSD * 100) / 100,
    valor_aduana_mxn: Math.round(valorMXN * 100) / 100,
    tipo_cambio: tipoCambio,
    dta: Math.round(dta * 100) / 100,
    igi: Math.round(igi * 100) / 100,
    iva: Math.round(iva * 100) / 100,
    total_gravamen: Math.round(totalGravamen * 100) / 100,
    fracciones,
    tmec_applicable: tmecApplicable,
    usmca_cert_on_file: usmcaCertOnFile,
    risk_score: riskScore,
    risk_factors: riskFactors,
    documents: {
      present: docs.map((d: any) => ({ type: d.doc_type, name: d.nombre, url: d.file_url })),
      missing: missingDocs.map(d => ({ type: d, label: DOC_LABELS[d] || d })),
    },
    ready_to_transmit: blockers.length === 0,
    blockers,
    estatus: traf.estatus,
    fecha_llegada: traf.fecha_llegada,
  })
}
