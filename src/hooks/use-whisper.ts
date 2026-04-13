'use client'

import { useEffect, useState } from 'react'
import { getCompanyIdCookie, getClientClaveCookie } from '@/lib/client-config'

type PageName = 'traficos' | 'financiero' | 'proveedores' | 'pedimentos' | 'documentos' | 'entradas'

/**
 * Computes a contextual insight for the current page.
 * Returns null if no insight is relevant or if cooldown applies.
 * Only positive/neutral insights — bad news goes to alerts.
 */
export function useWhisper(page: PageName): string | null {
  const [insight, setInsight] = useState<string | null>(null)

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    const clave = getClientClaveCookie()
    if (!companyId) return

    async function compute() {
      try {
        const res = await fetch(`/api/data?table=traficos&company_id=${companyId}&limit=5000&gte_field=fecha_llegada&gte_value=2024-01-01`)
        const data = await res.json()
        const traficos = data.data ?? []
        if (traficos.length < 10) return // Not enough data

        const now = new Date()
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const lastMonth = now.getMonth() === 0
          ? `${now.getFullYear() - 1}-12`
          : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`

        switch (page) {
          case 'traficos': {
            // Find fastest supplier this month
            const thisMonthTrafs = traficos.filter((t: { fecha_llegada: string | null; fecha_cruce: string | null; proveedores: string | null }) =>
              t.fecha_llegada?.startsWith(thisMonth) && t.fecha_cruce && t.proveedores
            )
            if (thisMonthTrafs.length > 0) {
              const byProv: Record<string, number[]> = {}
              for (const t of thisMonthTrafs) {
                const days = Math.round((new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000)
                const prov = (t.proveedores || '').split(',')[0].trim()
                if (prov && days >= 0) { if (!byProv[prov]) byProv[prov] = []; byProv[prov].push(days) }
              }
              const ranked = Object.entries(byProv)
                .map(([name, days]) => ({ name, avg: days.reduce((s, d) => s + d, 0) / days.length }))
                .filter(p => byProv[p.name].length >= 2)
                .sort((a, b) => a.avg - b.avg)
              if (ranked.length > 0) {
                setInsight(`Su proveedor más rápido este mes: ${ranked[0].name} (${ranked[0].avg.toFixed(1)} días promedio)`)
              }
            }
            break
          }
          case 'financiero': {
            // Compare this month vs last month efficiency
            const thisM = traficos.filter((t: { fecha_llegada: string | null }) => t.fecha_llegada?.startsWith(thisMonth))
            const lastM = traficos.filter((t: { fecha_llegada: string | null }) => t.fecha_llegada?.startsWith(lastMonth))
            if (thisM.length > 0 && lastM.length > 0) {
              const thisAvg = thisM.reduce((s: number, t: { importe_total: number | null }) => s + (Number(t.importe_total) || 0), 0) / thisM.length
              const lastAvg = lastM.reduce((s: number, t: { importe_total: number | null }) => s + (Number(t.importe_total) || 0), 0) / lastM.length
              if (thisAvg < lastAvg) {
                const pct = Math.round(((lastAvg - thisAvg) / lastAvg) * 100)
                if (pct > 5) setInsight(`Este mes: ${pct}% más eficiente en valor promedio vs mes anterior`)
              }
            }
            break
          }
          case 'proveedores': {
            // Find supplier with biggest improvement
            const res2 = await fetch(`/api/data?table=supplier_network&limit=20`).then(r => r.json())
            const suppliers = res2.data ?? []
            const improved = suppliers.filter((s: { reliability_score: number | null }) =>
              s.reliability_score && s.reliability_score > 90
            )
            if (improved.length > 0) {
              setInsight(`${improved.length} de sus proveedores tienen score de confiabilidad > 90%`)
            }
            break
          }
          case 'pedimentos': {
            // T-MEC qualification rate
            const tmec = traficos.filter((t: { regimen: string | null }) => {
              const r = (t.regimen || '').toUpperCase()
              return r === 'ITE' || r === 'ITR' || r === 'IMD'
            })
            const pct = Math.round((tmec.length / traficos.length) * 100)
            if (pct > 30) setInsight(`${pct}% de sus operaciones califican para T-MEC — tasa preferencial aplicada`)
            break
          }
          case 'documentos': {
            setInsight('Tip: suba documentos desde su teléfono con el botón de cámara en cada embarque')
            break
          }
          case 'entradas': {
            const linked = traficos.filter((t: { estatus: string | null }) => {
              const s = (t.estatus || '').toLowerCase()
              return s.includes('cruz')
            })
            const rate = Math.round((linked.length / traficos.length) * 100)
            if (rate > 80) setInsight(`${rate}% de sus embarques se completaron exitosamente`)
            break
          }
        }
      } catch (e) { console.error('[use-whisper] insight compute:', (e as Error).message) }
    }

    compute()
  }, [page])

  return insight
}
