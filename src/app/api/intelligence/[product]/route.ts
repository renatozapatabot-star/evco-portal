import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALLOWED_PRODUCTS: Record<string, { table: string; adminOnly: boolean; limit: number }> = {
  'anomalies':       { table: 'anomaly_baselines',        adminOnly: true,  limit: 50 },
  'demand':          { table: 'demand_forecasts',          adminOnly: false, limit: 20 },
  'po-predictions':  { table: 'po_predictions',           adminOnly: false, limit: 20 },
  'cost-insights':   { table: 'cost_insights',            adminOnly: false, limit: 30 },
  'inventory':       { table: 'inventory_estimates',       adminOnly: false, limit: 30 },
  'suppliers':       { table: 'supplier_network_scores',   adminOnly: false, limit: 50 },
  'risk':            { table: 'compliance_risk_scores',    adminOnly: true,  limit: 50 },
  'ghosts':          { table: 'ghost_detections',          adminOnly: true,  limit: 50 },
  'profitability':   { table: 'client_profitability',      adminOnly: true,  limit: 50 },
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ product: string }> }
) {
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  }

  const { product } = await params
  const config = ALLOWED_PRODUCTS[product]
  if (!config) {
    return NextResponse.json({ data: null, error: { code: 'NOT_FOUND', message: `Unknown intelligence product: ${product}` } }, { status: 404 })
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  if (config.adminOnly && !isInternal) {
    return NextResponse.json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } }, { status: 403 })
  }

  let query = supabase.from(config.table).select('*').limit(config.limit)

  // Client isolation: filter by company_id if not internal
  if (!isInternal && session.companyId) {
    query = query.eq('company_id', session.companyId)
  }

  // Order by most recent first
  query = query.order('created_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    // Table may not exist yet — return empty gracefully
    return NextResponse.json({ data: [], error: null })
  }

  return NextResponse.json({ data: data || [], error: null })
}
