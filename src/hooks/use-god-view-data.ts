'use client'

import { useEffect, useState, useCallback } from 'react'

// ── Types ──

export interface HeartbeatData {
  created_at: string
  all_ok: boolean
  pm2_ok: boolean
  supabase_ok: boolean
  vercel_ok: boolean
  sync_ok: boolean
  sync_age_hours: number
  details: string
}

export interface SyncSource {
  source: string
  lastRun: string | null
  minutesAgo: number | null
  status: string
  recordsNew: number
  healthy: boolean
}

export interface SmartQueueItem {
  trafico: string
  company_id: string
  estatus: string
  days_active: number
  valor_usd: number
  has_pedimento: boolean
  doc_count: number
  priority: number
  reason: string
  descripcion: string
  proveedor: string
}

export interface OpsCenterData {
  exceptionsToday: number
  autoProcessedToday: number
  pendingClassifications: number
  accuracyCurrent: number
  correctionsThisWeek: number
  recentLearnings: { original: string; corrected: string; date: string }[]
  pendingEscalations: number
  activeClients7d: number
  totalClients: number
  emailsProcessedToday: number
  inactiveClients: { company_id: string; name: string; daysSinceActivity: number }[]
  clientsAtRisk: { company_id: string; name: string; daysSinceActivity: number }[]
  dailySavings: number
}

export interface CompanyRow {
  company_id: string
  name: string
  clave_cliente: string
  trafico_count: number
  valor_ytd: number
}

export interface PendienteRow {
  company_name: string
  company_id: string
  solicitudes_vencidas: number
  entradas_sin_trafico: number
}

export interface BridgeTime {
  id: number
  name: string
  nameEs: string
  commercial: number | null
  status: string
  updated: string | null
}

export interface IntelFeedItem {
  id: string
  type: string
  title: string
  body: string
  severity: 'critical' | 'warning' | 'info'
  action_url: string
  source: string
}

export interface GodViewData {
  // Section A: Sistema
  heartbeat: HeartbeatData | null
  syncSources: SyncSource[]
  syncAllHealthy: boolean

  // Section B: Cola de Trabajo
  smartQueue: SmartQueueItem[]
  smartQueueTotal: number
  pendingDrafts: number
  pendingEscalations: number

  // Section C: CRUZ Autónomo
  opsCenter: OpsCenterData | null
  agentDecisions24h: number
  agentAccuracy: number
  workflowCounts: Record<string, number>
  workflowBlocked: number

  // Section D: KPIs
  enProceso: number
  cruzadosHoy: number
  listosDespacho: number
  emailsHoy: number
  tipoCambio: number | null
  tipoCambioFecha: string | null
  ahorroTmec: number

  // Section E: Clientes
  companies: CompanyRow[]
  pendientes: PendienteRow[]

  // Section F: Frontera
  bridges: BridgeTime[]
  recommendedBridge: number | null
  intelFeed: IntelFeedItem[]

  // Meta
  loading: boolean
  sectionErrors: Record<string, string>
  reload: () => void
}

const EMPTY: GodViewData = {
  heartbeat: null,
  syncSources: [],
  syncAllHealthy: true,
  smartQueue: [],
  smartQueueTotal: 0,
  pendingDrafts: 0,
  pendingEscalations: 0,
  opsCenter: null,
  agentDecisions24h: 0,
  agentAccuracy: 0,
  workflowCounts: {},
  workflowBlocked: 0,
  enProceso: 0,
  cruzadosHoy: 0,
  listosDespacho: 0,
  emailsHoy: 0,
  tipoCambio: null,
  tipoCambioFecha: null,
  ahorroTmec: 0,
  companies: [],
  pendientes: [],
  bridges: [],
  recommendedBridge: null,
  intelFeed: [],
  loading: true,
  sectionErrors: {},
  reload: () => {},
}

async function safeFetch<T>(url: string, fallback: T): Promise<{ data: T; error?: string }> {
  try {
    const res = await fetch(url)
    if (!res.ok) return { data: fallback, error: `${res.status}` }
    const json = await res.json()
    return { data: json }
  } catch (err) {
    return { data: fallback, error: (err as Error).message }
  }
}

export function useGodViewData(): GodViewData {
  const [data, setData] = useState<GodViewData>(EMPTY)

  const fetchAll = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true }))
    const errors: Record<string, string> = {}

    const [
      heartbeatRes,
      syncRes,
      queueRes,
      opsCenterRes,
      intelligenceRes,
      companiesRes,
      bridgesRes,
      intelFeedRes,
      tcRes,
      savingsRes,
      statusRes,
    ] = await Promise.all([
      safeFetch<{ heartbeat: HeartbeatData | null }>('/api/broker/data?section=heartbeat', { heartbeat: null }),
      safeFetch<{ sources: SyncSource[]; allHealthy: boolean }>('/api/sync-status', { sources: [], allHealthy: true }),
      safeFetch<{ queue: SmartQueueItem[]; total_active: number }>('/api/smart-queue', { queue: [], total_active: 0 }),
      safeFetch<OpsCenterData>('/api/broker/data?section=ops-center', null as unknown as OpsCenterData),
      safeFetch<{ intelligence: { total_today: number } }>('/api/broker/data?section=intelligence', { intelligence: { total_today: 0 } }),
      safeFetch<{ companies: CompanyRow[]; pendientes: PendienteRow[] }>('/api/broker/data', { companies: [], pendientes: [] }),
      safeFetch<{ bridges: BridgeTime[]; recommended: number | null }>('/api/bridge-times', { bridges: [], recommended: null }),
      safeFetch<IntelFeedItem[]>('/api/intelligence-feed', []),
      safeFetch<{ tc: number; fecha: string }>('/api/tipo-cambio', { tc: 0, fecha: '' }),
      safeFetch<{ savings: { tmec?: { savings_usd: number } }; total_estimated_usd?: number }>('/api/cost-savings', { savings: {} }),
      safeFetch<{ level: string; sentence: string; count: number }>('/api/status-sentence', { level: 'green', sentence: '', count: 0 }),
    ])

    // Track section errors
    if (heartbeatRes.error) errors.heartbeat = heartbeatRes.error
    if (syncRes.error) errors.sync = syncRes.error
    if (queueRes.error) errors.queue = queueRes.error
    if (opsCenterRes.error) errors.opsCenter = opsCenterRes.error
    if (companiesRes.error) errors.companies = companiesRes.error
    if (bridgesRes.error) errors.bridges = bridgesRes.error

    // Derive KPIs from status + queue
    const queueData = queueRes.data
    const ops = opsCenterRes.data
    const hb = heartbeatRes.data?.heartbeat ?? null
    const sync = syncRes.data
    const intel = intelligenceRes.data
    const co = companiesRes.data
    const br = bridgesRes.data
    const feed = Array.isArray(intelFeedRes.data) ? intelFeedRes.data : []
    const tc = tcRes.data
    const sv = savingsRes.data
    const st = statusRes.data

    // Count workflow events by stage (from opsCenter if available)
    // For now derive from queue data
    const workflowCounts: Record<string, number> = {}
    const workflowBlocked = 0

    // Compute en proceso / cruzados from smart queue total and status
    const enProceso = queueData.total_active || st.count || 0

    // Drafts and escalations from ops center
    const pendingDrafts = ops?.exceptionsToday ?? 0
    const pendingEscalations = ops?.pendingEscalations ?? 0

    // Agent metrics from ops center
    const agentDecisions24h = ops?.autoProcessedToday ?? 0
    const agentAccuracy = ops?.accuracyCurrent ?? 0

    // Savings
    const ahorroTmec = sv?.total_estimated_usd || sv?.savings?.tmec?.savings_usd || 0

    setData({
      heartbeat: hb,
      syncSources: sync.sources,
      syncAllHealthy: sync.allHealthy,
      smartQueue: queueData.queue.slice(0, 5),
      smartQueueTotal: queueData.total_active,
      pendingDrafts,
      pendingEscalations,
      opsCenter: ops,
      agentDecisions24h,
      agentAccuracy,
      workflowCounts,
      workflowBlocked,
      enProceso,
      cruzadosHoy: 0, // Derived from status-sentence if available
      listosDespacho: 0, // Would need pipeline_overview
      emailsHoy: intel?.intelligence?.total_today ?? 0,
      tipoCambio: tc.tc || null,
      tipoCambioFecha: tc.fecha || null,
      ahorroTmec: ahorroTmec,
      companies: co.companies ?? [],
      pendientes: co.pendientes ?? [],
      bridges: br.bridges ?? [],
      recommendedBridge: br.recommended,
      intelFeed: feed.slice(0, 3),
      loading: false,
      sectionErrors: errors,
      reload: fetchAll,
    })
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 60000)
    return () => clearInterval(interval)
  }, [fetchAll])

  return { ...data, reload: fetchAll }
}
