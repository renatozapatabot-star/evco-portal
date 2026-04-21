// Shared types for Admin and Operator cockpits

export interface TeamMember {
  id: string
  full_name: string
  role: string
  isOnline: boolean
  actionsToday: number
}

export interface ActivityEvent {
  id: string
  operator_id: string
  operator_name: string
  action_type: string
  target_id: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

export interface PendingDraft {
  id: string
  trafico_id: string | null
  company_id: string
  company_name: string
  draft_data: Record<string, unknown>
  created_at: string
  status: string
}

export interface PipelineStage {
  estatus: string
  count: number
}

export interface WorkflowStats {
  workflow: string
  total: number
  completed: number
  failed: number
}

export interface CompanyHealth {
  company_id: string
  name: string
  clave_cliente: string | null
  traficos_count: number
  health_score: number
  last_sync: string | null
  alerts: number
}

export interface SyncCoverage {
  company_id: string
  name: string
  total: number
  withFraccion: number
  withDescripcion: number
}

export interface StuckTrafico {
  id: string
  trafico: string
  company_id: string
  descripcion_mercancia: string | null
  importe_total: number | null
  assigned_to_operator_id: string | null
  created_at: string
  semaforo: string | null
}

export interface LeaderboardEntry {
  id: string
  full_name: string
  role: string
  email: string | null
  totalActions: number
  classifications: number
  assignments: number
  lastActiveAt: string | null
}
