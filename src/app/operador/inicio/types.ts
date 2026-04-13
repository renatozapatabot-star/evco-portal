export type SystemStatus = 'healthy' | 'warning' | 'critical'

export interface TraficoRow {
  trafico: string
  company_id: string | null
  estatus: string | null
  descripcion_mercancia: string | null
  pedimento: string | null
  fecha_llegada: string | null
  updated_at: string | null
  assigned_to_operator_id: string | null
  proveedores: string | null
}

export interface DecisionRow {
  id: number
  trafico: string | null
  company_id: string | null
  decision_type: string
  decision: string
  created_at: string
  data_points_used: Record<string, unknown> | null
}

export interface KPIs {
  entradasHoy: number
  /** Operator's own personal assignments (activos del operador). */
  activos: number
  /** Ops-wide active count (tráficos en proceso en toda la empresa). */
  activosAllCount?: number
  pendientes: number
  atrasados: number
  /** Last 14 daily counts per KPI — last 7 feed the sparkline, prior 7 feed the delta. */
  entradasSeries: number[]
  activosSeries: number[]
  pendientesSeries: number[]
  atrasadosSeries: number[]
  /** Prior-7-day totals for delta comparison. */
  entradasPrev7: number
  activosPrev7: number
  pendientesPrev7: number
  atrasadosPrev7: number
  /** Current-7-day totals (paired with *Prev7 for delta math). */
  entradasCurr7: number
  activosCurr7: number
  pendientesCurr7: number
  atrasadosCurr7: number
}

export interface ActionResult {
  success: boolean
  error?: string
}
