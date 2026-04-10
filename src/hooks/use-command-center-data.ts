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
  inventarioPeso: number
  pedimentosThisMonth: number
  expedientesTotal: number
  facturacionMes: number
  cruzadosEsteMes: number
  // Real-time intelligence
  bridgeWaitMinutes: number | null
  exchangeRate: number | null
  exchangeRateDate: string | null
  lastCrossing: { trafico: string; fecha: string; id?: string } | null
  docsPendientes: number
  // Bento grid data
  sparklines: { traficos: number[]; entradas: number[]; cruzados: number[]; facturacion: number[] }
  trends: { thisWeekCruces: number; lastWeekCruces: number }
  activeTraficosList: { trafico: string; pedimento: string | null; estatus: string; daysOld: number }[]
  // Data density fallbacks (never show empty)
  totalTraficos: number
  totalCruzados: number
  facturacionYTD: number
  newThisWeek: number
  daysSinceRojo: number
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
  inventarioPeso: 0,
  pedimentosThisMonth: 0,
  expedientesTotal: 0,
  facturacionMes: 0,
  cruzadosEsteMes: 0,
  bridgeWaitMinutes: null,
  exchangeRate: null,
  exchangeRateDate: null,
  lastCrossing: null,
  docsPendientes: 0,
  sparklines: { traficos: [], entradas: [], cruzados: [], facturacion: [] },
  trends: { thisWeekCruces: 0, lastWeekCruces: 0 },
  activeTraficosList: [],
  totalTraficos: 0,
  totalCruzados: 0,
  facturacionYTD: 0,
  newThisWeek: 0,
  daysSinceRojo: 0,
}

function computeDerivedMetrics(allT: TraficoRow[]) {
  const thisMonth = new Date().toISOString().slice(0, 7)
  const pedimentosThisMonth = new Set(
    allT.filter(t => t.pedimento && (t.fecha_cruce || t.updated_at || '').slice(0, 7) === thisMonth)
      .map(t => t.pedimento)
  ).size
  const expedientesTotal = allT.filter(t => t.pedimento).length
  const facturacionMes = allT
    .filter(t => (t.fecha_cruce || t.updated_at || '').slice(0, 7) === thisMonth)
    .reduce((sum, t) => sum + (t.importe_total || 0), 0)
  const cruzadosEsteMes = allT.filter(t =>
    (t.estatus || '').toLowerCase().includes('cruz') &&
    (t.fecha_cruce || '').slice(0, 7) === thisMonth
  ).length

  // Last crossing — most recent trafico that crossed
  const crossed = allT
    .filter(t => (t.estatus || '').toLowerCase().includes('cruz') && t.fecha_cruce)
    .sort((a, b) => (b.fecha_cruce || '').localeCompare(a.fecha_cruce || ''))
  const lastCrossing = crossed.length > 0
    ? { trafico: crossed[0].trafico, fecha: crossed[0].fecha_cruce!, id: String(crossed[0].id ?? '') }
    : null

  // Docs pendientes — active traficos (en proceso) that don't have a pedimento yet
  const docsPendientes = allT.filter(t =>
    (t.estatus || '').toLowerCase() === 'en proceso' && !t.pedimento
  ).length

  // 7-day sparkline data — group by day (entradas filled externally)
  const today = new Date()
  const spark = { traficos: [] as number[], entradas: [0,0,0,0,0,0,0], cruzados: [] as number[], facturacion: [] as number[] }
  for (let d = 6; d >= 0; d--) {
    const day = new Date(today)
    day.setDate(day.getDate() - d)
    const dayStr = day.toISOString().slice(0, 10)
    spark.traficos.push(allT.filter(t => (t.fecha_llegada || '').slice(0, 10) === dayStr).length)
    spark.cruzados.push(allT.filter(t => (t.fecha_cruce || '').slice(0, 10) === dayStr).length)
    spark.facturacion.push(allT.filter(t => (t.fecha_cruce || t.updated_at || '').slice(0, 10) === dayStr).reduce((s, t) => s + (t.importe_total || 0), 0))
  }

  // Previous week totals for trend arrows
  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(thisWeekStart.getDate() - 7)
  const lastWeekStart = new Date(today)
  lastWeekStart.setDate(lastWeekStart.getDate() - 14)
  const twStr = thisWeekStart.toISOString().slice(0, 10)
  const lwStr = lastWeekStart.toISOString().slice(0, 10)
  const thisWeekCruces = allT.filter(t => (t.fecha_cruce || '') >= twStr).length
  const lastWeekCruces = allT.filter(t => (t.fecha_cruce || '') >= lwStr && (t.fecha_cruce || '') < twStr).length

  // Critical items for info scent
  const activeTraficosList = allT
    .filter(t => (t.estatus || '').toLowerCase() === 'en proceso')
    .sort((a, b) => (a.fecha_llegada || '').localeCompare(b.fecha_llegada || ''))
    .slice(0, 3)
    .map(t => ({
      trafico: t.trafico,
      pedimento: t.pedimento,
      estatus: t.estatus,
      daysOld: t.fecha_llegada ? Math.floor((Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000) : 0,
    }))

  // Days since last semáforo rojo — the customs safety board
  const rojoCrossings = allT
    .filter(t => (t.semaforo as string || '').toLowerCase() === 'rojo' && t.fecha_cruce)
    .sort((a, b) => (b.fecha_cruce || '').localeCompare(a.fecha_cruce || ''))
  let daysSinceRojo = 0
  if (rojoCrossings.length > 0) {
    daysSinceRojo = Math.floor((Date.now() - new Date(rojoCrossings[0].fecha_cruce!).getTime()) / 86400000)
  } else if (crossed.length > 0) {
    // No rojo ever — streak since oldest crossing
    const oldest = crossed[crossed.length - 1]
    daysSinceRojo = Math.floor((Date.now() - new Date(oldest.fecha_cruce!).getTime()) / 86400000)
  }

  // Data density fallbacks — always have numbers even during quiet periods
  const totalTraficos = allT.length
  const totalCruzados = crossed.length
  const ytdStart = new Date().getFullYear() + '-01-01'
  const facturacionYTD = allT
    .filter(t => (t.fecha_cruce || t.updated_at || '') >= ytdStart)
    .reduce((sum, t) => sum + (t.importe_total || 0), 0)

  return {
    pedimentosThisMonth, expedientesTotal, facturacionMes, cruzadosEsteMes, lastCrossing, docsPendientes,
    sparklines: spark,
    trends: { thisWeekCruces, lastWeekCruces },
    activeTraficosList,
    totalTraficos, totalCruzados, facturacionYTD,
    newThisWeek: spark.traficos.reduce((a, b) => a + b, 0),
    daysSinceRojo,
  }
}

async function fetchIntelligence(): Promise<{ bridgeWaitMinutes: number | null; exchangeRate: number | null; exchangeRateDate: string | null }> {
  try {
    const [bridgeRes, tcRes] = await Promise.all([
      fetch('/api/bridge-times').then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/tipo-cambio').then(r => r.ok ? r.json() : null).catch(() => null),
    ])
    const wtb = bridgeRes?.bridges?.find((b: { name: string }) => b.name?.includes('World Trade'))
    return {
      bridgeWaitMinutes: wtb?.commercial ?? bridgeRes?.fastest?.commercial ?? null,
      exchangeRate: tcRes?.tc ?? null,
      exchangeRateDate: tcRes?.fecha ?? null,
    }
  } catch {
    return { bridgeWaitMinutes: null, exchangeRate: null, exchangeRateDate: null }
  }
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
      const peso = cached.entradas.reduce((sum, e) => sum + (Number((e as unknown as Record<string, unknown>).peso_bruto) || 0), 0)
      const derived = computeDerivedMetrics(cached.traficos)
      setData({
        traficos: cached.traficos,
        pendingEntradas: cached.entradas,
        enProceso,
        urgentes: status.urgentes,
        cruzadosHoy: status.cruzadosHoy,
        total: status.total,
        tmecSavings: tmec.totalSavings,
        inventarioBultos: bultos,
        inventarioPeso: peso / 1000,
        ...derived,
        bridgeWaitMinutes: null,
        exchangeRate: null,
        exchangeRateDate: null,
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
      fetchIntelligence(),
    ])
      .then(([trafData, entData, intel]) => {
        const allT: TraficoRow[] = trafData.data ?? []
        const allEnts: Record<string, unknown>[] = entData.data ?? []
        const ents: EntradaPending[] = allEnts
          .filter((e) => !e.trafico)
          .slice(0, 20) as unknown as EntradaPending[]

        const enProceso = allT.filter(t => (t.estatus || '').toLowerCase() === 'en proceso').length
        const tmec = calculateTmecSavings(allT)
        const unassigned = allEnts.filter(e => !e.trafico)
        const bultos = unassigned.reduce((sum, e) => sum + (Number(e.cantidad_bultos) || 0), 0)
        const peso = unassigned.reduce((sum, e) => sum + (Number(e.peso_bruto) || 0), 0)

        const derived = computeDerivedMetrics(allT)
        setData({
          traficos: allT,
          pendingEntradas: ents,
          enProceso,
          urgentes: status.urgentes,
          cruzadosHoy: status.cruzadosHoy,
          total: status.total,
          tmecSavings: tmec.totalSavings,
          inventarioBultos: bultos,
          inventarioPeso: peso / 1000,
          ...derived,
          ...intel,
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
