export type HealthStatus = 'red' | 'yellow' | 'green'
export type SystemStatus = 'healthy' | 'warning' | 'critical'

export interface ClientHealth {
  company_id: string
  name: string
  status: HealthStatus
  traficos: number
  value_usd: number
  last_activity: string | null
  summary: string
}

export interface TeamActivity {
  operator_id: string
  name: string
  actions: number
}

export interface InicioData {
  greeting: {
    name: string
    systemStatus: SystemStatus
    summaryLine: string
  }
  hero: {
    clientes_activos: number
    traficos_motion: number
    pedimentos_semana: number
    valor_transito_usd: number
    en_riesgo: number
    dias_sin_rojo: number
  }
  clientHealth: ClientHealth[]
  autonomy: {
    thisWeekDecisions: number
    lastWeekDecisions: number
  }
  rightRail: {
    decisionesPendientes: number
    team: TeamActivity[]
    system: {
      todaySpendUsd: number
      workflowFailed: number
      workflowPending: number
    }
  }
  generated_at: string
}
