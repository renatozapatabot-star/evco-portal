import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const envelope = (data: any) => ({
  success: true,
  data,
  meta: { generated_at: new Date().toISOString(), version: '1.0' },
})

export async function GET(req: NextRequest) {
  const companyId = req.cookies.get('company_id')?.value ?? ''
  const type = req.nextUrl.searchParams.get('type')
  const id = req.nextUrl.searchParams.get('id')

  if (type === 'risk' && id) {
    const { data } = await supabase.from('pedimento_risk_scores')
      .select('*').eq('trafico_id', id).single()
    return NextResponse.json(envelope(data))
  }

  if (type === 'crossing' && id) {
    const { data } = await supabase.from('crossing_predictions')
      .select('*').eq('trafico_id', id).single()
    return NextResponse.json(envelope(data))
  }

  if (type === 'supplier' && id) {
    const { data } = await supabase.from('supplier_network')
      .select('*').ilike('supplier_name', `%${id}%`).limit(5)
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
    const { data } = await supabase.from('regulatory_alerts')
      .select('*').order('created_at', { ascending: false }).limit(10)
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
    supabase.from('pedimento_risk_scores').select('overall_score', { count: 'exact', head: false }).limit(5).order('overall_score', { ascending: false }),
    supabase.from('compliance_predictions').select('severity', { count: 'exact' }).eq('resolved', false),
    supabase.from('client_benchmarks').select('metric_name, client_value, industry_avg').eq('company_id', companyId),
    supabase.from('bridge_intelligence').select('*', { count: 'exact', head: true }),
  ])

  return NextResponse.json(envelope({
    risk_scores: { count: risk.count, top_5: risk.data },
    compliance: { count: comp.count, predictions: comp.data },
    benchmarks: bench.data,
    bridge_records: bridge.count,
  }))
}
