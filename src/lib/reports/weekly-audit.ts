/**
 * ZAPATA AI · Multi-Client Weekly Audit — data assembly.
 *
 * Pulls the minimum data needed for a weekly branded PDF audit per client.
 * One company per call; admin/broker iterates over companies for a
 * cross-tenant weekly run. Designed to be cheap: capped queries, no joins.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export interface WeeklyAuditCompany {
  company_id: string
  name: string
  rfc: string | null
  clave_cliente: string | null
  patente: string | null
  aduana: string | null
}

export interface WeeklyAuditTrafico {
  trafico: string | null
  pedimento: string | null
  estatus: string | null
  descripcion_mercancia: string | null
  fecha_llegada: string | null
  tipo_operacion: string | null
  dias_activos: number | null
}

export interface WeeklyAuditPedimento {
  pedimento: string | null
  referencia: string | null
  proveedor: string | null
  valor_total: number | null
  fecha: string | null
}

export interface WeeklyAuditData {
  company: WeeklyAuditCompany | null
  isoWeek: string
  periodFrom: string
  periodTo: string
  traficosTotal: number
  traficosByStatus: Array<{ estatus: string; count: number }>
  traficosRows: WeeklyAuditTrafico[]
  pedimentosRows: WeeklyAuditPedimento[]
  financial: {
    facturasTotalUsd: number
    facturasCount: number
  }
  classifications: Array<{ fraccion: string; count: number }>
  documents: {
    totalExpedientes: number
    withOca: number
    withUsmca: number
  }
  generatedAt: string
}

/** Returns ISO-8601 week (`YYYY-W##`) for an ISO-weekday date. */
export function isoWeekLabel(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/** Parse `YYYY-W##` to {start, end} Dates (Mon 00:00 UTC → Sun 23:59:59 UTC). */
export function isoWeekRange(label: string): { start: Date; end: Date } {
  const match = label.match(/^(\d{4})-W(\d{2})$/)
  if (!match) throw new Error(`Invalid ISO week label: ${label}`)
  const year = Number(match[1])
  const week = Number(match[2])
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Dow = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1))
  const start = new Date(week1Monday)
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 7)
  end.setUTCMilliseconds(-1)
  return { start, end }
}

export async function loadWeeklyAudit(
  sb: SupabaseClient,
  companyId: string,
  isoWeek: string,
): Promise<WeeklyAuditData> {
  const { start, end } = isoWeekRange(isoWeek)
  const periodFrom = start.toISOString()
  const periodTo = end.toISOString()

  const { data: company } = await sb
    .from('companies')
    .select('company_id, name, rfc, clave_cliente, patente, aduana')
    .eq('company_id', companyId)
    .single<WeeklyAuditCompany>()

  const claveCliente = company?.clave_cliente ?? null

  const [traficosResult, pedimentosResult, ocaResult, usmcaResult, expedientesResult] = await Promise.all([
    sb.from('traficos')
      .select('trafico, pedimento, estatus, descripcion_mercancia, fecha_llegada, tipo_operacion, dias_activos')
      .eq('company_id', companyId)
      .gte('fecha_llegada', start.toISOString().slice(0, 10))
      .lte('fecha_llegada', end.toISOString().slice(0, 10))
      .order('fecha_llegada', { ascending: false })
      .limit(200),

    claveCliente
      ? sb.from('aduanet_facturas')
          .select('pedimento, referencia, proveedor, valor_total, fecha')
          .eq('clave_cliente', claveCliente)
          .gte('fecha', start.toISOString().slice(0, 10))
          .lte('fecha', end.toISOString().slice(0, 10))
          .order('fecha', { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] as WeeklyAuditPedimento[] }),

    sb.from('oca_database')
      .select('fraccion_recomendada', { count: 'exact', head: false })
      .eq('company_id', companyId)
      .eq('status', 'approved')
      .gte('approved_at', periodFrom)
      .lte('approved_at', periodTo),

    sb.from('usmca_certificates')
      .select('hs_code', { count: 'exact', head: false })
      .eq('company_id', companyId)
      .eq('status', 'approved')
      .gte('approved_at', periodFrom)
      .lte('approved_at', periodTo),

    sb.from('expediente_documentos')
      .select('trafico_id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('uploaded_at', periodFrom)
      .lte('uploaded_at', periodTo),
  ])

  const traficosRows = (traficosResult.data ?? []) as WeeklyAuditTrafico[]
  const pedimentosRows = (pedimentosResult.data ?? []) as WeeklyAuditPedimento[]

  const statusCounts = new Map<string, number>()
  for (const t of traficosRows) {
    const key = (t.estatus ?? 'sin estatus').toLowerCase()
    statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1)
  }

  const facturasTotalUsd = pedimentosRows.reduce((sum, r) => sum + (Number(r.valor_total) || 0), 0)

  const fraccionCounts = new Map<string, number>()
  const ocaData = (ocaResult.data ?? []) as Array<{ fraccion_recomendada: string | null }>
  for (const o of ocaData) {
    if (!o.fraccion_recomendada) continue
    fraccionCounts.set(o.fraccion_recomendada, (fraccionCounts.get(o.fraccion_recomendada) ?? 0) + 1)
  }

  const usmcaCount = (usmcaResult.data as Array<{ hs_code: string | null }> | null)?.length ?? 0

  return {
    company,
    isoWeek,
    periodFrom: start.toISOString().slice(0, 10),
    periodTo: end.toISOString().slice(0, 10),
    traficosTotal: traficosRows.length,
    traficosByStatus: Array.from(statusCounts.entries())
      .map(([estatus, count]) => ({ estatus, count }))
      .sort((a, b) => b.count - a.count),
    traficosRows,
    pedimentosRows,
    financial: {
      facturasTotalUsd: Math.round(facturasTotalUsd * 100) / 100,
      facturasCount: pedimentosRows.length,
    },
    classifications: Array.from(fraccionCounts.entries())
      .map(([fraccion, count]) => ({ fraccion, count }))
      .sort((a, b) => b.count - a.count),
    documents: {
      totalExpedientes: expedientesResult.count ?? 0,
      withOca: ocaData.length,
      withUsmca: usmcaCount,
    },
    generatedAt: new Date().toISOString(),
  }
}
