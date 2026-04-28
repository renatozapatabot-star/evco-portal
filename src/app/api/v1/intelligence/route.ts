import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

// P0-A4: explicit service-role requirement. /v1 intelligence endpoint
// — partner API key auth gates the call, but DB query needs service
// role since RLS is deny-all on the underlying tenant tables.
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY required for /api/v1/intelligence')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SERVICE_ROLE
)

const envelope = (data: unknown) => ({
  success: true,
  data,
  meta: { generated_at: new Date().toISOString(), version: '1.0' },
})

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } }, { status: 401 })
  }

  const companyId = session.companyId
  const type = req.nextUrl.searchParams.get('type')
  const id = req.nextUrl.searchParams.get('id')

  if (type === 'risk' && id) {
    // V1 tenant scope — risk scores are tenant data
    const { data } = await supabase.from('pedimento_risk_scores')
      .select('*').eq('trafico_id', id).eq('company_id', companyId).single()
    return NextResponse.json(envelope(data))
  }

  if (type === 'crossing' && id) {
    // V1 tenant scope — crossing predictions linked to tenant tráfico
    const { data } = await supabase.from('crossing_predictions')
      .select('*').eq('trafico_id', id).eq('company_id', companyId).single()
    return NextResponse.json(envelope(data))
  }

  if (type === 'supplier' && id) {
    // V1 tenant scope — supplier_network per tenant
    const { data } = await supabase.from('supplier_network')
      .select('*').eq('company_id', companyId).ilike('supplier_name', `%${id}%`).limit(5)
    return NextResponse.json(envelope(data))
  }

  if (type === 'benchmark') {
    const { data } = await supabase.from('client_benchmarks')
      .select('*').eq('company_id', companyId).limit(10)
    return NextResponse.json(envelope(data))
  }

  if (type === 'compliance') {
    const { data: predictions } = await supabase.from('compliance_predictions')
      .select('*').eq('company_id', companyId).eq('resolved', false)
    const critical = predictions?.filter(p => p.severity === 'critical').length || 0
    const warning = predictions?.filter(p => p.severity === 'warning').length || 0
    const score = Math.max(0, 100 - (critical * 15) - (warning * 5))
    return NextResponse.json(envelope({ score, predictions, critical, warning }))
  }

  if (type === 'regulatory') {
    // V1 tenant scope — regulatory_alerts table has company_id column.
    // Was previously unscoped → cross-tenant alert leak.
    const { data } = await supabase.from('regulatory_alerts')
      .select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(10)
    return NextResponse.json(envelope(data))
  }

  if (type === 'oca' && id) {
    const { data } = await supabase.from('oca_database')
      .select('*').textSearch('product_description', id).gt('confidence', 0.6)
      .order('confidence', { ascending: false }).limit(5)
    return NextResponse.json(envelope(data))
  }

  // Summary
  const [risk, comp, bench, bridge] = await Promise.all([
    // V1 tenant scope — was previously unscoped on risk + compliance.
    supabase.from('pedimento_risk_scores').select('overall_score', { count: 'exact', head: false }).eq('company_id', companyId).limit(5).order('overall_score', { ascending: false }),
    supabase.from('compliance_predictions').select('severity', { count: 'exact' }).eq('company_id', companyId).eq('resolved', false),
    supabase.from('client_benchmarks').select('metric_name, client_value, industry_avg').eq('company_id', companyId),
    // bridge_intelligence is shared reference data — no tenant scope needed
    supabase.from('bridge_intelligence').select('*', { count: 'exact', head: true }),
  ])

  return NextResponse.json(envelope({
    risk_scores: { count: risk.count, top_5: risk.data },
    compliance: { count: comp.count, predictions: comp.data },
    benchmarks: bench.data,
    bridge_records: bridge.count,
  }))
}
