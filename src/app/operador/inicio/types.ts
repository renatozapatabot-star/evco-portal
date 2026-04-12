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
  activos: number
  pendientes: number
  atrasados: number
}

export interface ActionResult {
  success: boolean
  error?: string
}
