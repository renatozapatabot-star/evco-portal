import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/** Broker command center data — fetches cross-client operational data. */
export async function GET(req: NextRequest) {
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
      // Tráficos count + valor YTD (batched per company — acceptable for small client count)
      const [traficoRes, valorRes] = await Promise.all([
        supabase
          .from('traficos')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', co.company_id),
        supabase
          .from('traficos')
          .select('importe_total')
          .eq('company_id', co.company_id)
          .gte('created_at', ytdStart),
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
