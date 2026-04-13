/**
 * Reportes KPI aggregator — single source for both the PDF route and the
 * client-facing /reportes page strip. Adding/removing a KPI here cascades
 * to both surfaces; never duplicate this logic in a route again.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'

export interface ReportesKpis {
  totalTraficos: number
  totalValueUSD: number
  successRate: number
  avgCrossingDays: string | null
  tmecRate: number
  pedimentosAsignadosPct: number
  despachoRapidoPct: number
}

export async function computeReportesKpis(
  supabase: SupabaseClient,
  clientClave: string,
  companyId: string,
): Promise<ReportesKpis> {
  const prefix = `${clientClave}-%`

  const [totals, cruzados, crossing, factRes, traficosWithPed] = await Promise.all([
    supabase
      .from('traficos')
      .select('importe_total', { count: 'exact' })
      .ilike('trafico', prefix)
      .gte('fecha_llegada', PORTAL_DATE_FROM),
    supabase
      .from('traficos')
      .select('*', { count: 'exact', head: true })
      .ilike('trafico', prefix)
      .eq('estatus', 'Cruzado')
      .gte('fecha_llegada', PORTAL_DATE_FROM),
    supabase
      .from('traficos')
      .select('fecha_cruce, fecha_llegada')
      .ilike('trafico', prefix)
      .not('fecha_cruce', 'is', null)
      .not('fecha_llegada', 'is', null)
      .gte('fecha_llegada', PORTAL_DATE_FROM)
      .limit(500),
    supabase
      .from('aduanet_facturas')
      .select('igi, valor_usd', { count: 'exact' })
      .eq('clave_cliente', clientClave),
    supabase
      .from('traficos')
      .select('pedimento', { count: 'exact' })
      .eq('company_id', companyId)
      .gte('fecha_llegada', PORTAL_DATE_FROM)
      .not('pedimento', 'is', null)
      .limit(1),
  ])

  const totalCount = totals.count ?? 0
  const cruzadosCount = cruzados.count ?? 0
  const successRate = totalCount > 0 ? Math.round((cruzadosCount / totalCount) * 100) : 0

  const totalValue = (totals.data ?? []).reduce(
    (s: number, t: Record<string, unknown>) => s + (Number(t.importe_total) || 0), 0
  )

  const crossingRows = crossing.data ?? []
  const crossingDays = crossingRows.map((t: Record<string, unknown>) => {
    return (new Date(t.fecha_cruce as string).getTime() -
            new Date(t.fecha_llegada as string).getTime()) / 86400000
  })
  const avgCrossingDays = crossingDays.length > 0
    ? (crossingDays.reduce((a, b) => a + b, 0) / crossingDays.length).toFixed(1)
    : null

  // Despacho rápido = % of crossings completed in under 48h.
  const fastClears = crossingDays.filter(d => d >= 0 && d < 2).length
  const despachoRapidoPct = crossingDays.length > 0
    ? Math.round((fastClears / crossingDays.length) * 100)
    : 0

  const tmecWithIGI = (factRes.data ?? []).filter(
    (f: Record<string, unknown>) => f.igi !== null && Number(f.igi) > 0
  ).length
  const tmecRate = factRes.count
    ? Math.round((tmecWithIGI / factRes.count) * 100)
    : 0

  // Pedimentos asignados = % of traficos that have a pedimento number.
  const withPedCount = traficosWithPed.count ?? 0
  const pedimentosAsignadosPct = totalCount > 0
    ? Math.round((withPedCount / totalCount) * 100)
    : 0

  return {
    totalTraficos: totalCount,
    totalValueUSD: totalValue,
    successRate,
    avgCrossingDays,
    tmecRate,
    pedimentosAsignadosPct,
    despachoRapidoPct,
  }
}
