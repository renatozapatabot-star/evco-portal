'use client'

import { useEffect, useState, useCallback } from 'react'
import { getCompanyIdCookie } from '@/lib/client-config'
import { useSessionCache } from '@/hooks/use-session-cache'
import { useStatusSentence } from '@/hooks/use-status-sentence'
import { calculateTmecSavings } from '@/lib/tmec-savings'

interface TraficoRow {
  trafico: string
  estatus: string
  fecha_llegada: string | null
  fecha_cruce: string | null
  pedimento: string | null
  importe_total: number | null
  updated_at: string | null
  [k: string]: unknown
}

interface EntradaPending {
  id: number
  cve_entrada: string
  created_at?: string | null
  fecha_llegada_mercancia?: string | null
  descripcion_mercancia?: string | null
  trafico?: string | null
}

export interface CommandCenterData {
  traficos: TraficoRow[]
  pendingEntradas: EntradaPending[]
  enProceso: number
  urgentes: number
  cruzadosHoy: number
  total: number
  tmecSavings: number
  inventarioBultos: number
}

interface UseCommandCenterReturn {
  data: CommandCenterData
  loading: boolean
  error: string | null
  refreshing: boolean
  reload: () => void
}

const EMPTY: CommandCenterData = {
  traficos: [],
  pendingEntradas: [],
  enProceso: 0,
  urgentes: 0,
  cruzadosHoy: 0,
  total: 0,
  tmecSavings: 0,
  inventarioBultos: 0,
}

export function useCommandCenterData(): UseCommandCenterReturn {
  const { getCached, setCache, refreshing, startRefresh, endRefresh } = useSessionCache()
  const status = useStatusSentence()

  const [data, setData] = useState<CommandCenterData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(() => {
    const companyId = getCompanyIdCookie()

    // Try cache first
    const cached = getCached<{ traficos: TraficoRow[]; entradas: EntradaPending[] }>('command-center')
    if (cached) {
      const enProceso = cached.traficos.filter(t => (t.estatus || '').toLowerCase() === 'en proceso').length
      const tmec = calculateTmecSavings(cached.traficos)
      const bultos = cached.entradas.reduce((sum, e) => sum + (Number((e as unknown as Record<string, unknown>).cantidad_bultos) || 0), 0)
      setData({
        traficos: cached.traficos,
        pendingEntradas: cached.entradas,
        enProceso,
        urgentes: status.urgentes,
        cruzadosHoy: status.cruzadosHoy,
        total: status.total,
        tmecSavings: tmec.totalSavings,
        inventarioBultos: bultos,
      })
      setLoading(false)
      startRefresh()
    } else {
      setLoading(true)
    }
    setError(null)

    const trafParams = new URLSearchParams({
      table: 'traficos',
      limit: '5000',
      company_id: companyId || '',
      gte_field: 'fecha_llegada',
      gte_value: '2024-01-01',
      order_by: 'fecha_llegada',
      order_dir: 'desc',
    })

    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
    const entParams = new URLSearchParams({
      table: 'entradas',
      limit: '50',
      company_id: companyId || '',
      gte_field: 'fecha_llegada_mercancia',
      gte_value: ninetyDaysAgo,
      order_by: 'fecha_llegada_mercancia',
      order_dir: 'desc',
    })

    Promise.all([
      fetch(`/api/data?${trafParams}`).then(r => r.json()),
      fetch(`/api/data?${entParams}`).then(r => r.json()),
    ])
      .then(([trafData, entData]) => {
        const allT: TraficoRow[] = trafData.data ?? []
        const allEnts: Record<string, unknown>[] = entData.data ?? []
        const ents: EntradaPending[] = allEnts
          .filter((e) => !e.trafico)
          .slice(0, 20) as unknown as EntradaPending[]

        const enProceso = allT.filter(t => (t.estatus || '').toLowerCase() === 'en proceso').length
        const tmec = calculateTmecSavings(allT)
        const bultos = allEnts
          .filter(e => !e.trafico)
          .reduce((sum, e) => sum + (Number(e.cantidad_bultos) || 0), 0)

        setData({
          traficos: allT,
          pendingEntradas: ents,
          enProceso,
          urgentes: status.urgentes,
          cruzadosHoy: status.cruzadosHoy,
          total: status.total,
          tmecSavings: tmec.totalSavings,
          inventarioBultos: bultos,
        })
        setCache('command-center', { traficos: allT, entradas: ents })
      })
      .catch(() => setError('No se pudo cargar el dashboard. Reintentar.'))
      .finally(() => {
        setLoading(false)
        endRefresh()
        if (typeof window !== 'undefined') {
          localStorage.setItem('cruz-last-visit', new Date().toISOString())
        }
      })
  }, [getCached, setCache, startRefresh, endRefresh, status.urgentes, status.cruzadosHoy, status.total])

  useEffect(() => { fetchData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refreshing, reload: fetchData }
}
