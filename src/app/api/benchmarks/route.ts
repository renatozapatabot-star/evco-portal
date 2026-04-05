import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = session.role === 'client' ? session.companyId : (req.nextUrl.searchParams.get('company_id') || session.companyId)

  // Get latest benchmarks for fleet and this client
  const metrics = ['avg_crossing_days', 'tmec_rate', 'doc_completeness', 'avg_value_usd']

  const results: Record<string, { client: number | null; fleet: number | null; sample: number }> = {}

  for (const metric of metrics) {
    const { data: fleetRow } = await supabase
      .from('benchmarks')
      .select('value, sample_size')
      .eq('metric', metric)
      .eq('dimension', 'fleet')
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: clientRow } = await supabase
      .from('benchmarks')
      .select('value, sample_size')
      .eq('metric', metric)
      .eq('dimension', companyId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    results[metric] = {
      client: clientRow?.value ?? null,
      fleet: fleetRow?.value ?? null,
      sample: fleetRow?.sample_size ?? 0,
    }
  }

  // Compute comparisons
  const comparisons: Record<string, { you: string; fleet: string; delta: string; better: boolean }> = {}

  if (results.avg_crossing_days.client != null && results.avg_crossing_days.fleet != null) {
    const pct = Math.round(((results.avg_crossing_days.fleet - results.avg_crossing_days.client) / results.avg_crossing_days.fleet) * 100)
    comparisons.crossing = {
      you: `${results.avg_crossing_days.client} días`,
      fleet: `${results.avg_crossing_days.fleet} días`,
      delta: pct > 0 ? `${pct}% más rápido` : `${Math.abs(pct)}% más lento`,
      better: pct > 0,
    }
  }

  if (results.tmec_rate.client != null && results.tmec_rate.fleet != null) {
    comparisons.tmec = {
      you: `${results.tmec_rate.client}%`,
      fleet: `${results.tmec_rate.fleet}%`,
      delta: `${results.tmec_rate.client - results.tmec_rate.fleet > 0 ? '+' : ''}${results.tmec_rate.client - results.tmec_rate.fleet}pp`,
      better: results.tmec_rate.client >= results.tmec_rate.fleet,
    }
  }

  if (results.doc_completeness.client != null && results.doc_completeness.fleet != null) {
    comparisons.docs = {
      you: `${results.doc_completeness.client}%`,
      fleet: `${results.doc_completeness.fleet}%`,
      delta: `${results.doc_completeness.client - results.doc_completeness.fleet > 0 ? '+' : ''}${results.doc_completeness.client - results.doc_completeness.fleet}pp`,
      better: results.doc_completeness.client >= results.doc_completeness.fleet,
    }
  }

  return NextResponse.json({ benchmarks: results, comparisons })
}
