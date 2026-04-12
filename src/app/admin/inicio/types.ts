export type HealthStatus = 'red' | 'yellow' | 'green'

export interface ClientHealth {
  company_id: string
  name: string
  status: HealthStatus
  traficos: number
  value_usd: number
  last_activity: string | null
  summary: string
}

export interface PulsePoint {
  day: string
  events: number
  decisions: number
}

export interface TeamActivity {
  operator_id: string
  name: string
  actions: number
}

export interface InicioData {
  hero: {
    clientes_activos: number
    traficos_motion: number
    pedimentos_semana: number
    valor_transito_usd: number
    en_riesgo: number
    dias_sin_rojo: number
  }
  pulse: {
    last24h_events: number
    last24h_decisions: number
    last24h_cost_usd: number
    sparkline: PulsePoint[]
  }
  clientHealth: ClientHealth[]
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
