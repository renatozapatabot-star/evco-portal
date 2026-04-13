import { createServerClient } from '@/lib/supabase-server'
import { softCount, softData } from '@/lib/cockpit/safe-query'
import { bucketDailySeries, sumRange, daysAgo, startOfToday } from '@/lib/cockpit/fetch'
import { EMPTY_NAV_COUNTS, type NavCounts } from '@/lib/cockpit/nav-tiles'
import type { CockpitHeroKPI } from '@/components/aguila'

export type OperatorRoleTag = 'trafico' | 'contabilidad' | 'warehouse'

export interface RoleCockpitData {
  heroKPIs: CockpitHeroKPI[]
  navCounts: NavCounts
  summaryLine: string
  systemStatus: 'healthy' | 'warning' | 'critical'
  recentTraficos: Array<{
    id: string
    trafico: string
    cliente: string | null
    estatus: string | null
    pedimento: string | null
    updated_at: string | null
  }>
}

export async function loadRoleCockpit(roleTag: OperatorRoleTag): Promise<RoleCockpitData> {
  const sb = createServerClient()
  const now = new Date()
  const todayStartIso = startOfToday(now).toISOString()
  const sevenDaysAgoIso = daysAgo(7, now).toISOString()
  const fourteenDaysAgoIso = daysAgo(14, now).toISOString()
  const weekEndIso = new Date(now.getTime() + 7 * 86400000).toISOString()
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    activosCount,
    pendientesCount,
    atrasadosCount,
    entradasHoyCount,
    entradas7dCount,
    pedimentosMonthCount,
    cruzados7dCount,
    expedientesTotalCount,
    activosSeriesRows,
    entradasSeriesRows,
    recentTraficosRows,
  ] = await Promise.all([
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).eq('estatus', 'En Proceso')),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).is('pedimento', null).lte('fecha_llegada', weekEndIso)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).eq('estatus', 'En Proceso').lte('updated_at', sevenDaysAgoIso)),
    softCount(sb.from('entradas').select('cve_entrada', { count: 'exact', head: true }).gte('fecha_llegada_mercancia', todayStartIso)),
    softCount(sb.from('entradas').select('cve_entrada', { count: 'exact', head: true }).gte('fecha_llegada_mercancia', sevenDaysAgoIso)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).not('pedimento', 'is', null).gte('updated_at', monthStartIso)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).eq('estatus', 'Cruzado').gte('updated_at', sevenDaysAgoIso)),
    softCount(sb.from('expediente_documentos').select('id', { count: 'exact', head: true })),
    softData<{ updated_at: string }>(
      sb.from('traficos').select('updated_at').eq('estatus', 'En Proceso').gte('updated_at', fourteenDaysAgoIso).limit(2000)
    ),
    softData<{ fecha_llegada_mercancia: string }>(
      sb.from('entradas').select('fecha_llegada_mercancia').gte('fecha_llegada_mercancia', fourteenDaysAgoIso).limit(2000)
    ),
    softData<{
      id: string; trafico: string; company_id: string | null;
      estatus: string | null; pedimento: string | null; updated_at: string | null;
    }>(
      sb.from('traficos')
        .select('id, trafico, company_id, estatus, pedimento, updated_at')
        .eq('estatus', 'En Proceso')
        .order('updated_at', { ascending: false })
        .limit(10)
    ),
  ])

  const activosSeries = bucketDailySeries(activosSeriesRows as Array<Record<string, unknown>>, 'updated_at', 14, now)
  const entradasSeries = bucketDailySeries(entradasSeriesRows as Array<Record<string, unknown>>, 'fecha_llegada_mercancia', 14, now)

  const navCounts: NavCounts = {
    ...EMPTY_NAV_COUNTS,
    traficos:        { count: activosCount, series: activosSeries, microStatus: `${cruzados7dCount} cruzaron esta semana` },
    pedimentos:      { count: pedimentosMonthCount, series: [], microStatus: 'Este mes' },
    expedientes:     { count: expedientesTotalCount, series: [], microStatus: `${expedientesTotalCount} documentos` },
    catalogo:        { count: null, series: [] },
    entradas:        { count: entradasHoyCount, series: entradasSeries, microStatus: `${entradas7dCount} esta semana` },
    clasificaciones: { count: null, series: [] },
  }

  let heroKPIs: CockpitHeroKPI[]
  let summaryLine = 'Sin pendientes inmediatos.'

  if (roleTag === 'trafico') {
    heroKPIs = [
      { key: 'activos',    label: 'Tráficos activos',    value: activosCount,    series: activosSeries,  href: '/traficos', current: sumRange(activosSeries, 7, 14), previous: sumRange(activosSeries, 0, 7) },
      { key: 'pendientes', label: 'Pedimentos pendientes', value: pendientesCount, href: '/pedimentos' },
      { key: 'atrasados',  label: 'Atrasados >7 días',   value: atrasadosCount,  urgent: atrasadosCount > 0, inverted: true },
      { key: 'cruzados',   label: 'Cruzados 7 días',     value: cruzados7dCount, href: '/traficos?estatus=cruzado' },
    ]
    summaryLine = atrasadosCount > 0
      ? `${atrasadosCount} tráfico${atrasadosCount === 1 ? '' : 's'} atrasado${atrasadosCount === 1 ? '' : 's'} · ${activosCount} activos`
      : `${activosCount} tráfico${activosCount === 1 ? '' : 's'} en proceso`
  } else if (roleTag === 'contabilidad') {
    const [facturasMonth, pagadasMonth, cxcRows] = await Promise.all([
      softCount(sb.from('econta_facturas').select('dfactura', { count: 'exact', head: true }).gte('dfechahora', monthStartIso)),
      softCount(sb.from('econta_facturas').select('dfactura', { count: 'exact', head: true }).eq('bfacturapagada', true).gte('dfechahora', monthStartIso)),
      softData<{ rcargo: number | null; rabono: number | null; etipocargoabono: string | null }>(
        sb.from('econta_cartera').select('rcargo, rabono, etipocargoabono').limit(5000)
      ),
    ])
    const cxcBalance = (cxcRows ?? []).reduce((sum, r) => {
      const cargo = Number(r.rcargo ?? 0)
      const abono = Number(r.rabono ?? 0)
      return sum + (cargo - abono)
    }, 0)
    heroKPIs = [
      { key: 'facturas',   label: 'Facturas este mes',  value: facturasMonth, href: '/banco-facturas' },
      { key: 'pagadas',    label: 'Pagadas este mes',   value: pagadasMonth,  href: '/banco-facturas?estado=pagada' },
      { key: 'cxc',        label: 'Cartera (MXN K)',    value: Math.round(cxcBalance / 1000).toLocaleString('es-MX'), href: '/cobranzas' },
      { key: 'activos',    label: 'Tráficos activos',   value: activosCount,  series: activosSeries, href: '/traficos' },
    ]
    summaryLine = `${facturasMonth - pagadasMonth} factura${facturasMonth - pagadasMonth === 1 ? '' : 's'} por cobrar este mes`
  } else {
    const [entradasSemana, entradasMes, sinUbicacionCount] = await Promise.all([
      softCount(sb.from('entradas').select('cve_entrada', { count: 'exact', head: true }).gte('fecha_llegada_mercancia', sevenDaysAgoIso)),
      softCount(sb.from('entradas').select('cve_entrada', { count: 'exact', head: true }).gte('fecha_llegada_mercancia', monthStartIso)),
      softCount(sb.from('entradas').select('cve_entrada', { count: 'exact', head: true }).is('ubicacion', null).gte('fecha_llegada_mercancia', sevenDaysAgoIso)),
    ])
    heroKPIs = [
      { key: 'entradasHoy',    label: 'Entradas hoy',       value: entradasHoyCount, series: entradasSeries, href: '/entradas' },
      { key: 'entradasSemana', label: 'Entradas 7 días',    value: entradasSemana,   href: '/bodega' },
      { key: 'sinUbicacion',   label: 'Sin ubicación',      value: sinUbicacionCount, urgent: sinUbicacionCount > 0, inverted: true, href: '/bodega?filtro=sin-ubicacion' },
      { key: 'activos',        label: 'Tráficos activos',   value: activosCount,     series: activosSeries,   href: '/traficos' },
    ]
    summaryLine = sinUbicacionCount > 0
      ? `${sinUbicacionCount} entrada${sinUbicacionCount === 1 ? '' : 's'} sin ubicación · ${entradasMes} este mes`
      : `${entradasSemana} recepción${entradasSemana === 1 ? '' : 'es'} esta semana`
  }

  const systemStatus: RoleCockpitData['systemStatus'] =
    atrasadosCount > 0 ? 'warning' : 'healthy'

  const recentTraficos = (recentTraficosRows ?? []).map((r) => ({
    id: r.id,
    trafico: r.trafico,
    cliente: null,
    estatus: r.estatus,
    pedimento: r.pedimento,
    updated_at: r.updated_at,
  }))

  return { heroKPIs, navCounts, summaryLine, systemStatus, recentTraficos }
}
