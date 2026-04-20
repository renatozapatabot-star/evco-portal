import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { resolveTenantScope } from '@/lib/api/tenant-scope'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Session-authoritative for client role; param/cookie fallback
  // for internal roles via resolveTenantScope (restores admin
  // view-as). core-invariants rule 15.
  const companyId = resolveTenantScope(session, req)
  if (!companyId) return NextResponse.json({ error: 'Tenant scope required' }, { status: 400 })
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || '20'), 50)

  const [compRes, anomRes, crossRes] = await Promise.all([
    supabase.from('compliance_predictions')
      .select('id, prediction_type, description, severity, created_at, due_date, risk_level')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('anomaly_baselines')
      .select('id, metric_type, metric_key, mean_value, calculated_at')
      .eq('company_id', companyId)
      .eq('metric_type', 'value_guard')
      .order('calculated_at', { ascending: false })
      .limit(10),
    supabase.from('crossing_predictions')
      .select('id, trafico_id, predicted_crossing_date, confidence, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const items: Array<{ id: string; type: string; title: string; body: string; severity: string; action_url: string; created_at?: string; source: string }> = []

  // Compliance predictions
  ;(compRes.data || []).forEach(p => {
    if (p.prediction_type === 'weekly_prep' || p.prediction_type === 'supplier_network') return
    const severity = p.risk_level === 'critical' ? 'critical' : p.risk_level === 'high' ? 'critical' : p.severity === 'warning' || p.risk_level === 'warning' ? 'warning' : 'info'
    items.push({
      id: p.id,
      type: p.prediction_type,
      title: p.prediction_type?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Alerta',
      body: typeof p.description === 'string' && p.description.startsWith('{') ? 'Datos procesados' : (p.description || '').substring(0, 200),
      severity,
      action_url: p.prediction_type?.includes('tmec') ? '/usmca' : p.prediction_type?.includes('carrier') ? '/carriers' : p.prediction_type?.includes('mve') ? '/mve' : '/cumplimiento',
      created_at: p.created_at,
      source: p.prediction_type?.includes('carrier') ? 'operational' : p.prediction_type?.includes('financial') || p.prediction_type?.includes('savings') ? 'financial' : 'regulatory',
    })
  })

  // Value guard anomalies
  ;(anomRes.data || []).forEach(a => {
    items.push({
      id: a.id,
      type: 'value_anomaly',
      title: 'Anomalía de Valor',
      body: `${a.metric_key?.split('::')[2] || 'Producto'} — valor fuera de rango histórico`,
      severity: 'warning',
      action_url: `/embarques/${a.metric_key?.split('::')[0] || ''}`,
      created_at: a.calculated_at,
      source: 'operational',
    })
  })

  // Sort by severity then recency
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  items.sort((a, b) => {
    const sevDiff = (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2)
    if (sevDiff !== 0) return sevDiff
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })

  return NextResponse.json(items.slice(0, limit))
}
