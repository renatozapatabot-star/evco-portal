import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Broker command center data — fetches cross-client operational data. */
export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Auth: broker or admin only
  const role = req.cookies.get('user_role')?.value
  if (role !== 'broker' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const section = req.nextUrl.searchParams.get('section')

  // Section: heartbeat — latest heartbeat_log entry
  if (section === 'heartbeat') {
    const { data: heartbeat } = await supabase
      .from('heartbeat_log')
      .select('created_at, all_ok, pm2_ok, supabase_ok, vercel_ok, sync_ok, sync_age_hours, details')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({ heartbeat: heartbeat || null })
  }

  // Section: intelligence — email_intelligence stats for today
  if (section === 'intelligence') {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: rows } = await supabase
      .from('email_intelligence')
      .select('source_inbox, created_at')
      .gte('created_at', todayStart.toISOString())

    const byAccount: Record<string, number> = {}
    if (rows) {
      for (const row of rows) {
        const account = row.source_inbox || 'desconocido'
        byAccount[account] = (byAccount[account] || 0) + 1
      }
    }

    return NextResponse.json({
      intelligence: {
        total_today: rows?.length || 0,
        by_account: byAccount,
      },
    })
  }

  // Section: ops-center — metrics for all three staff roles
  if (section === 'ops-center') {
    const now = new Date()
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const weekAgo = new Date(now.getTime() - 7 * 86400000)

    const [draftsRes, autoDraftsRes, classRes, correctionsRes, emailsRes, escalationsRes, companiesRes, activeTrafRes] = await Promise.all([
      // Exceptions: pending drafts
      supabase.from('pedimento_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      // Auto-processed today
      supabase.from('pedimento_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .gte('updated_at', todayStart.toISOString()),
      // Pending classifications (low confidence)
      supabase.from('shadow_classifications')
        .select('id', { count: 'exact', head: true })
        .lt('confidence', 0.8)
        .gte('created_at', weekAgo.toISOString()),
      // Corrections this week
      supabase.from('staff_corrections')
        .select('original_value, corrected_value, created_at')
        .gte('created_at', weekAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10),
      // Emails processed today
      supabase.from('email_intelligence')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString()),
      // Pending escalations
      supabase.from('documento_solicitudes')
        .select('id', { count: 'exact', head: true })
        .lt('deadline', now.toISOString())
        .neq('status', 'completed'),
      // All companies
      supabase.from('companies')
        .select('company_id, name')
        .eq('active', true)
        .not('portal_password', 'is', null),
      // Companies with recent embarques (active in 7d)
      supabase.from('traficos')
        .select('company_id')
        .gte('updated_at', weekAgo.toISOString()),
    ])

    // Compute active vs inactive clients
    const activeCompanyIds = new Set((activeTrafRes.data || []).map(t => t.company_id))
    const allCompanies = companiesRes.data || []
    const inactiveClients = allCompanies
      .filter(c => !activeCompanyIds.has(c.company_id))
      .map(c => ({ company_id: c.company_id, name: c.name, daysSinceActivity: 7 }))

    // Accuracy: average from recent shadow classifications
    const { data: recentShadow } = await supabase.from('shadow_classifications')
      .select('accuracy')
      .not('accuracy', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30)
    const accValues = (recentShadow || []).map(s => Number(s.accuracy)).filter(v => v > 0)
    const accuracyCurrent = accValues.length > 0 ? accValues.reduce((a, b) => a + b, 0) / accValues.length : 0

    const corrections = (correctionsRes.data || []).map(c => ({
      original: c.original_value || '',
      corrected: c.corrected_value || '',
      date: c.created_at || '',
    }))

    return NextResponse.json({
      exceptionsToday: draftsRes.count || 0,
      autoProcessedToday: autoDraftsRes.count || 0,
      clientsAtRisk: inactiveClients.slice(0, 10),
      dailySavings: 0, // T-MEC savings would require traficos query — skip for now
      pendingClassifications: classRes.count || 0,
      accuracyCurrent: Math.round(accuracyCurrent * 100) / 100,
      correctionsThisWeek: corrections.length,
      recentLearnings: corrections.slice(0, 5),
      pendingEscalations: escalationsRes.count || 0,
      activeClients7d: activeCompanyIds.size,
      totalClients: allCompanies.length,
      emailsProcessedToday: emailsRes.count || 0,
      inactiveClients: inactiveClients.slice(0, 10),
    })
  }

  // Default: companies + pendientes (main dashboard data)
  const { data: companiesRaw } = await supabase
    .from('companies')
    .select('company_id, name, clave_cliente')
    .eq('active', true)
    .not('portal_password', 'is', null)

  const companies = []
  const pendientes = []

  if (companiesRaw) {
    const ytdStart = new Date(new Date().getFullYear(), 0, 1).toISOString()

    for (const co of companiesRaw) {
      // Embarques count + valor YTD (batched per company — acceptable for small client count)
      const [traficoRes, valorRes] = await Promise.all([
        supabase
          .from('traficos')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', co.company_id)
          .gte('fecha_llegada', PORTAL_DATE_FROM),
        supabase
          .from('traficos')
          .select('importe_total')
          .eq('company_id', co.company_id)
          .gte('created_at', ytdStart)
          .gte('fecha_llegada', PORTAL_DATE_FROM),
      ])

      const traficoCount = traficoRes.count || 0
      const valorYtd = (valorRes.data || []).reduce(
        (sum, t) => sum + (t.importe_total || 0), 0
      )

      companies.push({
        company_id: co.company_id,
        name: co.name,
        clave_cliente: co.clave_cliente,
        trafico_count: traficoCount,
        valor_ytd: valorYtd,
      })

      // Pendientes for this company
      const now = new Date()
      const [solRes, entRes] = await Promise.all([
        supabase
          .from('documento_solicitudes')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', co.company_id)
          .lt('deadline', now.toISOString())
          .neq('status', 'completed'),
        supabase
          .from('entradas')
          .select('cve_entrada', { count: 'exact', head: true })
          .eq('company_id', co.company_id)
          .is('trafico', null)
          .lt('created_at', new Date(now.getTime() - 48 * 3600000).toISOString()),
      ])

      const solCount = solRes.count || 0
      const entCount = entRes.count || 0

      if (solCount > 0 || entCount > 0) {
        pendientes.push({
          company_name: co.name,
          company_id: co.company_id,
          solicitudes_vencidas: solCount,
          entradas_sin_trafico: entCount,
        })
      }
    }
  }

  return NextResponse.json(
    { companies, pendientes },
    { headers: { 'Cache-Control': 'private, max-age=60' } }
  )
}
