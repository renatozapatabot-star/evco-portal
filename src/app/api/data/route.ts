import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { verifySession } from '@/lib/session'

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
  'expediente_documentos',
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
  // Rate limit: 100 requests per minute per IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = rateLimit(`data:${ip}`, 100, 60000)
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta de nuevo.' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) },
    })
  }

  const params = req.nextUrl.searchParams
  const table = params.get('table')

  if (!table || !ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  }

  // Multi-tenant: resolve identity from signed HMAC session — never trust raw cookies for role.
  const sessionToken = req.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const cookieRole = session.role
  const isInternal = cookieRole === 'broker' || cookieRole === 'admin'

  // For client role: company_id comes from the SIGNED session, not from cookies or query params.
  // This prevents cross-client data leaks via cookie/param manipulation.
  // For broker/admin: internal company_id values ('admin','internal') are not real
  // client identifiers — they use query params to select which client to view.
  const sessionCompanyId = session.companyId
  const cookieClave = req.cookies.get('company_clave')?.value

  const effectiveCookieCompanyId = isInternal ? undefined : sessionCompanyId
  const effectiveCookieClave = isInternal ? undefined : cookieClave

  // Only apply clave_cliente when explicitly passed — not every table has this column.
  // Client isolation for tables without clave_cliente is handled by company_id filter.
  const claveCliente = params.get('clave_cliente') || undefined
  const cveCliente = params.get('cve_cliente') || undefined
  // Client: always use session company_id (ignore query param company_id)
  // Broker/admin: use query param company_id (they can view any client)
  const companyId = isInternal
    ? (params.get('company_id') || undefined)
    : (effectiveCookieCompanyId || undefined)
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
  // clave_cliente only exists on: aduanet_facturas, companies
  const CLAVE_TABLES = ['aduanet_facturas', 'companies']
  if (claveCliente && CLAVE_TABLES.includes(table)) q = q.eq('clave_cliente', claveCliente)
  // For other tables, use cve_cliente or company_id instead
  if (claveCliente && table === 'globalpc_facturas') q = q.eq('cve_cliente', claveCliente)
  if (cveCliente) q = q.eq('cve_cliente', cveCliente)
  if (companyId) q = q.eq('company_id', companyId)

  // broker_id filter removed — not all tables have this column,
  // and this is a single-broker system (Patente 3596).

  if (traficoPrefix) q = q.like('trafico', `${traficoPrefix}%`)

  const cveTrafico = params.get('cve_trafico')
  if (cveTrafico) q = q.eq('cve_trafico', cveTrafico)

  // Generic gte filter — e.g. gte_field=fecha_llegada&gte_value=2024-01-01
  const gteField = params.get('gte_field')
  const gteValue = params.get('gte_value')
  if (gteField && gteValue) q = q.gte(gteField, gteValue)

  // Not-null filter — e.g. not_null=pedimento filters to rows where column is not null
  const notNullField = params.get('not_null')
  if (notNullField) q = q.not(notNullField, 'is', null)

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
