import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getIVARate, getDTARates, getExchangeRate } from '@/lib/rates'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { verifySession } from '@/lib/session'
import { sanitizeFilter } from '@/lib/sanitize'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const REQUIRED_DOCS = ['factura_comercial', 'packing_list', 'bill_of_lading', 'cove', 'mve_folio']
const DOC_LABELS: Record<string, string> = {
  factura_comercial: 'Factura Comercial', packing_list: 'Packing List',
  bill_of_lading: 'Bill of Lading', cove: 'COVE', mve_folio: 'MVE Folio',
  usmca_cert: 'Certificado USMCA', cfdi_xml: 'CFDI XML', carta_porte: 'Carta Porte',
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trafico = request.nextUrl.searchParams.get('trafico')
  if (!trafico) return NextResponse.json({ error: 'trafico param required' }, { status: 400 })
  const safe = sanitizeFilter(trafico)
  const safeSuffix = trafico.includes('-') ? sanitizeFilter(trafico.split('-').slice(1).join('-')) : safe

  // Parallel fetches
  const [trafRes, factRes, partRes, provRes, docRes, riskRes, scRes, tcRes] = await Promise.all([
    supabase.from('traficos').select('*').eq('trafico', safe).gte('fecha_llegada', PORTAL_DATE_FROM).single(),
    supabase.from('globalpc_facturas').select('*').eq('cve_trafico', safe),
    supabase.from('globalpc_partidas').select('*').eq('cve_trafico', safe),
    supabase.from('globalpc_proveedores').select('*').limit(100),
    supabase.from('expediente_documentos').select('doc_type, file_url, nombre').or(`pedimento_id.eq.${safe},pedimento_id.eq.${safeSuffix}`),
    supabase.from('pedimento_risk_scores').select('score, risk_factors').eq('trafico_id', trafico).single(),
    supabase.from('supplier_contacts').select('supplier_name, usmca_eligible').limit(200),
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '.supabase.co')}/rest/v1/`, { headers: {} }).catch(() => null),
  ])

  const traf = trafRes.data
  if (!traf) return NextResponse.json({ error: 'Trafico not found' }, { status: 404 })

  // Resolve client identity from cookie → companies table
  const companyId = request.cookies.get('company_id')?.value ?? ''
  const { data: company } = await supabase
    .from('companies')
    .select('name, rfc')
    .eq('company_id', companyId)
    .single()
  const clientName = company?.name ?? ''
  const clientRfc = company?.rfc ?? ''

  const facturas = factRes.data || []
  const partidas = partRes.data || []
  const docs = docRes.data || []
  const riskScore = riskRes.data?.score || 0
  const riskFactors = riskRes.data?.risk_factors || []
  const tmecSuppliers = new Set((scRes.data || []).filter((s: { supplier_name?: string | null; usmca_eligible?: boolean | null }) => s.usmca_eligible).map((s: { supplier_name?: string | null }) => s.supplier_name?.toUpperCase()))

  // Get tipo de cambio from system_config (single source of truth)
  const { rate: tipoCambio } = await getExchangeRate()

  // Calculate financials
  const valorUSD = facturas.reduce((s: number, f: Record<string, unknown>) => s + (Number(f.valor_comercial) || 0), 0)
  const valorMXN = valorUSD * tipoCambio

  // Check T-MEC eligibility
  const supplierName = facturas[0]?.cve_proveedor || ''
  const tmecApplicable = tmecSuppliers.has(supplierName.toUpperCase())
  const usmcaCertOnFile = docs.some((d: { doc_type?: string }) => d.doc_type?.includes('usmca') || d.doc_type?.includes('tmec'))

  // IGI: use 0 when T-MEC applies, otherwise flag as pending (no hardcoded rate)
  const igiPending = !(tmecApplicable && usmcaCertOnFile)
  const igiRate = 0
  const dtaRates = await getDTARates()
  const dta = valorMXN * dtaRates.A1.rate
  const igi = valorMXN * igiRate
  const ivaRate = await getIVARate()
  const iva = (valorMXN + dta + igi) * ivaRate
  const totalGravamen = dta + igi + iva

  // Document completeness
  const presentDocs = docs.map((d: { doc_type?: string }) => d.doc_type).filter((x): x is string => !!x)
  const missingDocs = REQUIRED_DOCS.filter(d => !presentDocs.some(p => p.includes(d.split('_')[0])))
  const blockers: string[] = []
  if (missingDocs.length > 0) blockers.push(`Faltan ${missingDocs.length} documentos: ${missingDocs.map(d => DOC_LABELS[d] || d).join(', ')}`)
  if (!traf.pedimento) blockers.push('Sin numero de pedimento')
  if (riskScore > 70) blockers.push(`Risk score alto: ${riskScore}/100`)
  if (igiPending) blockers.push('Tasa IGI pendiente — requiere clasificación arancelaria')

  // Build fracciones list
  const fracciones = partidas.map((p: { fraccion_arancelaria?: string; fraccion?: string; descripcion_mercancia?: string; cantidad?: number; valor_comercial?: number; precio_unitario?: number }) => ({
    fraccion: p.fraccion_arancelaria || p.fraccion || '',
    descripcion: p.descripcion_mercancia || '',
    cantidad: Number(p.cantidad) || 0,
    valor: Number(p.valor_comercial) || Number(p.precio_unitario) || 0,
  }))

  // Proveedores
  const proveedores = [...new Set(facturas.map((f: Record<string, unknown>) => f.cve_proveedor as string).filter(Boolean))]

  return NextResponse.json({
    trafico,
    importador: { rfc: clientRfc, nombre: clientName },
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
    igi_pending: igiPending,
    risk_score: riskScore,
    risk_factors: riskFactors,
    documents: {
      present: docs.map((d: { doc_type?: string; nombre?: string; file_url?: string }) => ({ type: d.doc_type, name: d.nombre, url: d.file_url })),
      missing: missingDocs.map(d => ({ type: d, label: DOC_LABELS[d] || d })),
    },
    ready_to_transmit: blockers.length === 0,
    blockers,
    estatus: traf.estatus,
    fecha_llegada: traf.fecha_llegada,
  })
}
