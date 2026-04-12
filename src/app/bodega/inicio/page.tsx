import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { BodegaClient } from './BodegaClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CROSSED_ESTATUS = ['Cruzado', 'Cancelado']

/**
 * Returns an ISO string for `daysAgo` days before today, at Laredo (CST/CDT) midnight.
 * Used to bucket entradas by America/Chicago day boundaries.
 */
function cstDayStart(daysAgo: number): string {
  const now = new Date()
  const laredoParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const y = Number(laredoParts.find((p) => p.type === 'year')?.value)
  const m = Number(laredoParts.find((p) => p.type === 'month')?.value)
  const d = Number(laredoParts.find((p) => p.type === 'day')?.value)
  // CST is UTC-6, CDT is UTC-5 — construct UTC midnight of the Laredo day
  // then subtract daysAgo. We use Date.UTC then offset by Laredo's current offset.
  const laredoMidnightUTC = Date.UTC(y, m - 1, d, 6, 0, 0) // CST (6h). CDT will be off by 1h but only affects sub-day windowing.
  return new Date(laredoMidnightUTC - daysAgo * 86400_000).toISOString()
}

export default async function BodegaInicioPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)

  if (!session) redirect('/login')
  if (session.role === 'client' || session.role === 'operator') redirect('/inicio')
  if (!['warehouse', 'admin', 'broker'].includes(session.role)) redirect('/login')

  const operatorName = cookieStore.get('operator_name')?.value || 'Vicente'

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const todayStart = cstDayStart(0)
  const weekStart = cstDayStart(7)
  const twoWeeksStart = cstDayStart(14)
  const ninetyDaysStart = cstDayStart(90)
  const nowIso = new Date().toISOString()

  const [
    entradasTodayRes,
    entradasThisWeekRes,
    entradasLastWeekRes,
    proximasRes,
    enBodegaEntradasRes,
    crossedTraficosRes,
    entradas7dRes,
  ] = await Promise.all([
    sb.from('entradas')
      .select('cve_entrada', { count: 'exact', head: true })
      .gte('fecha_llegada_mercancia', todayStart),
    sb.from('entradas')
      .select('cve_entrada', { count: 'exact', head: true })
      .gte('fecha_llegada_mercancia', weekStart),
    sb.from('entradas')
      .select('cve_entrada', { count: 'exact', head: true })
      .gte('fecha_llegada_mercancia', twoWeeksStart)
      .lt('fecha_llegada_mercancia', weekStart),
    sb.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .gt('fecha_llegada', nowIso)
      .not('estatus', 'in', `(${CROSSED_ESTATUS.map((s) => `"${s}"`).join(',')})`),
    sb.from('entradas')
      .select('cve_entrada, trafico')
      .gte('fecha_llegada_mercancia', ninetyDaysStart)
      .not('trafico', 'is', null)
      .limit(5000),
    sb.from('traficos')
      .select('trafico')
      .in('estatus', CROSSED_ESTATUS)
      .gte('fecha_llegada', ninetyDaysStart)
      .limit(5000),
    sb.from('entradas')
      .select('cve_entrada', { count: 'exact', head: true })
      .gte('fecha_llegada_mercancia', weekStart),
  ])

  const crossedSet = new Set<string>(
    (crossedTraficosRes.data ?? [])
      .map((t) => t.trafico as string | null)
      .filter((t): t is string => Boolean(t)),
  )
  const enBodegaCount = (enBodegaEntradasRes.data ?? []).reduce((acc, row) => {
    const tr = row.trafico as string | null
    if (tr && !crossedSet.has(tr)) return acc + 1
    return acc
  }, 0)

  const kpis = {
    entradasToday: entradasTodayRes.count ?? 0,
    entradasWeek: entradas7dRes.count ?? 0,
    entradasLastWeek: entradasLastWeekRes.count ?? 0,
    entradasThisWeek: entradasThisWeekRes.count ?? 0,
    proximasEntradas: proximasRes.count ?? 0,
    enBodega: enBodegaCount,
  }

  return <BodegaClient operatorName={operatorName} kpis={kpis} />
}
