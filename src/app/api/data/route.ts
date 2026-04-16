import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import { verifySession } from '@/lib/session'
import { sanitizeFilter } from '@/lib/sanitize'
import { dataQuerySchema } from '@/lib/api-schemas'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const ALLOWED_TABLES = [
  // 'pedimentos' is intentionally NOT in this list until the
  // 20260417_pedimento_data.sql migration lands in prod. The caller in
  // /pedimentos/page.tsx already has `.catch(() => ({ data: [] }))` on
  // this branch, so a 400 falls through cleanly — re-adding here
  // before the table exists causes a Postgres "relation does not
  // exist" 500 instead of the cleaner 400.
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
  'daily_performance',
  'calendar_events',
]

// Tables that contain client-specific data and MUST be filtered by a client identifier.
// Querying these without company_id, clave_cliente, or cve_cliente is a cross-client data leak risk.
// Every table here has company_id OR cve_cliente. For client role, /api/data auto-injects
// session.companyId (see below) — never trust a query param from the browser.
const CLIENT_SCOPED_TABLES = new Set([
  // Core operational
  'traficos',
  'entradas',
  'expedientes',
  'pedimentos',
  'expediente_documentos',
  'pipeline_overview',
  'daily_performance',
  // GlobalPC — every row belongs to one client
  'globalpc_facturas',
  'globalpc_productos',
  'globalpc_partidas',
  'globalpc_proveedores',
  'globalpc_eventos',
  // Aduanet — has company_id column
  'aduanet_facturas',
  // Intelligence tables — all have company_id
  'product_intelligence',
  'financial_intelligence',
  'crossing_intelligence',
  'warehouse_intelligence',
  'pre_arrival_briefs',
  'compliance_predictions',
  'pedimento_risk_scores',
  'anomaly_baselines',
  'crossing_predictions',
  'monthly_intelligence_reports',
  'client_benchmarks',
  'supplier_contacts',
  'supplier_network',
  'compliance_events',
  'documents',
])

// Tables that do NOT have a tenant column and therefore cannot be safely
// scoped to a client. Clients are forbidden from reading them directly —
// broker/admin callers can still hit them (they aggregate across tenants).
const CLIENT_FORBIDDEN_TABLES = new Set([
  // Econta tables keyed only by cve_cliente — clients can't tamper with
  // cve_cliente and the session doesn't carry it signed. Route through
  // a dedicated endpoint that does server-side clave lookup instead.
  'econta_facturas',
  'econta_facturas_detalle',
  'econta_aplicaciones',
  'econta_polizas',
  'econta_anticipos',
  'econta_egresos',
  'econta_cartera',
  'econta_ingresos',
  'globalpc_contenedores',
  'globalpc_ordenes_carga',
  'globalpc_bultos',
  'document_metadata',
  'communication_events',
  'duplicates_detected',
  'regulatory_alerts',
  'trafico_completeness',
  'oca_database',
  'bridge_intelligence',
  'trade_prospects',
  'prospect_sightings',
  'competitor_sightings',
  'calendar_events',
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
  const parsed = dataQuerySchema.safeParse(Object.fromEntries(params))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos', details: parsed.error.issues.map(i => i.message) }, { status: 400 })
  }
  const table = parsed.data.table

  // Multi-tenant: resolve identity from signed HMAC session — never trust raw cookies for role.
  const sessionToken = req.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const cookieRole = session.role
  const isInternal = cookieRole === 'broker' || cookieRole === 'admin'

  // Client role cannot read tables that have no tenant column — they'd
  // see cross-tenant rows by construction. Broker/admin can (they aggregate).
  if (!isInternal && CLIENT_FORBIDDEN_TABLES.has(table)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

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

  const limit = parsed.data.limit
  const orderBy = parsed.data.order_by || undefined
  const orderDir = parsed.data.order_dir === 'asc'

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

  if (traficoPrefix) q = q.like('trafico', `${sanitizeFilter(traficoPrefix)}%`)

  const cveTrafico = params.get('cve_trafico')
  if (cveTrafico) q = q.eq('cve_trafico', sanitizeFilter(cveTrafico))

  // Whitelisted columns for generic filters — prevents column injection
  const ALLOWED_COLUMNS = [
    'fecha_llegada', 'fecha_cruce', 'fecha_pago', 'created_at', 'updated_at',
    'fecha_llegada_mercancia', 'processed_at', 'detected_at', 'recorded_at',
    'solicitado_at', 'transcribed_at', 'checked_at', 'importe_total',
    'pedimento', 'estatus', 'severity', 'status', 'trafico', 'date',
  ] as const

  // Generic gte filter — e.g. gte_field=fecha_llegada&gte_value=2024-01-01
  const gteField = params.get('gte_field')
  const gteValue = params.get('gte_value')
  if (gteField && gteValue && ALLOWED_COLUMNS.includes(gteField as typeof ALLOWED_COLUMNS[number])) {
    q = q.gte(gteField, gteValue)
  }

  // Generic lte filter — pair with gte_* for month-bounded queries
  const lteField = params.get('lte_field')
  const lteValue = params.get('lte_value')
  if (lteField && lteValue && ALLOWED_COLUMNS.includes(lteField as typeof ALLOWED_COLUMNS[number])) {
    q = q.lte(lteField, lteValue)
  }

  // Not-null filter — e.g. not_null=pedimento
  const notNullField = params.get('not_null')
  if (notNullField && ALLOWED_COLUMNS.includes(notNullField as typeof ALLOWED_COLUMNS[number])) {
    q = q.not(notNullField, 'is', null)
  }

  if (orderBy && ALLOWED_COLUMNS.includes(orderBy as typeof ALLOWED_COLUMNS[number])) {
    q = q.order(orderBy, { ascending: orderDir })
  }

  const { data, error } = await q

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Cache control based on table type
  const LONG_CACHE = new Set(['oca_database', 'supplier_network', 'anomaly_baselines'])
  const MEDIUM_CACHE = new Set(['aduanet_facturas', 'econta_facturas', 'econta_cartera', 'product_intelligence'])
  const maxAge = LONG_CACHE.has(table) ? 7200 : MEDIUM_CACHE.has(table) ? 3600 : 3600
  const stale = maxAge * 2

  return NextResponse.json({ data }, {
    headers: {
      'Cache-Control': `s-maxage=${maxAge}, stale-while-revalidate=${stale}`,
    },
  })
}
