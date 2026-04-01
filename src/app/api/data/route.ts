import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ALLOWED_TABLES = [
  'traficos', 'aduanet_facturas', 'entradas', 'documents', 'soia_cruces', 'soia_payment_status',
  'globalpc_facturas', 'globalpc_partidas', 'globalpc_eventos', 'globalpc_contenedores',
  'globalpc_ordenes_carga', 'globalpc_proveedores', 'globalpc_productos', 'globalpc_bultos',
  'econta_facturas', 'econta_facturas_detalle', 'econta_cartera', 'econta_aplicaciones',
  'econta_ingresos', 'econta_egresos', 'econta_anticipos', 'econta_polizas',
  'product_intelligence', 'financial_intelligence', 'crossing_intelligence', 'warehouse_intelligence',
  'pre_arrival_briefs', 'duplicates_detected', 'compliance_predictions', 'pedimento_risk_scores',
  'anomaly_baselines', 'supplier_contacts', 'crossing_predictions', 'monthly_intelligence_reports',
  'client_benchmarks', 'oca_database', 'supplier_network', 'bridge_intelligence',
  'regulatory_alerts', 'document_metadata', 'communication_events', 'compliance_events',
  'trade_prospects', 'prospect_sightings', 'competitor_sightings',
  'pipeline_overview',
  'trafico_completeness',
]

// Tables that contain client-specific data and MUST be filtered by a client identifier.
// Querying these without company_id, clave_cliente, or cve_cliente is a cross-client data leak risk.
const CLIENT_SCOPED_TABLES = new Set([
  'traficos',
  'entradas',
  'expedientes',
  'pedimentos',
  'expediente_documentos',
  'globalpc_facturas',
  'aduanet_facturas',
  'econta_cartera',
  'econta_ingresos',
  'pipeline_overview',
])

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const table = params.get('table')

  if (!table || !ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  }

  // Multi-tenant: resolve identity from auth cookies.
  const cookieRole = req.cookies.get('user_role')?.value
  const isInternal = cookieRole === 'broker' || cookieRole === 'admin'

  const cookieCompanyId = req.cookies.get('company_id')?.value
  const cookieClave = req.cookies.get('company_clave')?.value
  const brokerId = req.cookies.get('broker_id')?.value

  // For broker/admin: internal company_id values ('admin','internal') are not real
  // client identifiers — they must not be applied as filters on client-scoped tables.
  const effectiveCookieCompanyId = isInternal ? undefined : cookieCompanyId
  const effectiveCookieClave = isInternal ? undefined : cookieClave

  const claveCliente = params.get('clave_cliente') || effectiveCookieClave || undefined
  const cveCliente = params.get('cve_cliente') || undefined
  const companyId = effectiveCookieCompanyId || params.get('company_id') || undefined
  const traficoPrefix = params.get('trafico_prefix')
  const hasClientFilter = !!(claveCliente || cveCliente || companyId || traficoPrefix)

  // Broker/admin can query client-scoped tables without a filter (they see all data).
  // Client role MUST always have a filter — no exceptions.
  if (CLIENT_SCOPED_TABLES.has(table) && !hasClientFilter && !isInternal) {
    return NextResponse.json(
      { error: 'Client filter required for this table' },
      { status: 400 }
    )
  }

  const limit = Math.min(Number(params.get('limit') || '50'), 5000)
  const orderBy = params.get('order_by') || undefined
  const orderDir = params.get('order_dir') === 'asc'

  let q = supabase.from(table).select('*').limit(limit)

  // Apply filters — only real client identifiers, not internal placeholders
  if (claveCliente) q = q.eq('clave_cliente', claveCliente)
  if (cveCliente) q = q.eq('cve_cliente', cveCliente)
  if (companyId) q = q.eq('company_id', companyId)

  if (brokerId) q = q.eq('broker_id', brokerId)

  if (traficoPrefix) q = q.like('trafico', `${traficoPrefix}%`)

  const cveTrafico = params.get('cve_trafico')
  if (cveTrafico) q = q.eq('cve_trafico', cveTrafico)

  if (orderBy) q = q.order(orderBy, { ascending: orderDir })

  const { data, error } = await q

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Cache control based on table type
  const LONG_CACHE = new Set(['oca_database', 'supplier_network', 'anomaly_baselines'])
  const MEDIUM_CACHE = new Set(['aduanet_facturas', 'econta_facturas', 'econta_cartera', 'product_intelligence'])
  const maxAge = LONG_CACHE.has(table) ? 3600 : MEDIUM_CACHE.has(table) ? 300 : 30
  const stale = maxAge * 2

  return NextResponse.json({ data }, {
    headers: {
      'Cache-Control': `s-maxage=${maxAge}, stale-while-revalidate=${stale}`,
    },
  })
}
