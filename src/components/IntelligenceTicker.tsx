'use client'

import { useEffect, useState } from 'react'
import { getClientClaveCookie, getCompanyIdCookie } from '@/lib/client-config'
import { GOLD } from '@/lib/design-system'

interface TickerItem { text: string; href: string }

export function IntelligenceTicker() {
  const [items, setItems] = useState<TickerItem[]>([])

  useEffect(() => {
    async function load() {
      try {
        const companyId = getCompanyIdCookie()
        const [statusRes, bridgeRes] = await Promise.all([
          fetch(`/api/data?table=traficos&company_id=${companyId}&limit=1000`).then(r => r.json()).catch(() => ({ data: [] })),
          fetch('/api/data?table=bridge_intelligence&limit=20&order_by=updated_at&order_dir=desc').then(r => r.json()).catch(() => ({ data: [] })),
        ])

        const traficos = statusRes.data || []
        const bridges = bridgeRes.data || []
        const enProceso = traficos.filter((t: { estatus?: string | null }) => !(t.estatus || '').toLowerCase().includes('cruz')).length
        const cruzadosHoy = traficos.filter((t: { estatus?: string | null; fecha_cruce?: string | null }) => {
          if (!(t.estatus || '').toLowerCase().includes('cruz')) return false
          if (!t.fecha_cruce) return false
          return new Date(t.fecha_cruce).toDateString() === new Date().toDateString()
        }).length
        const valor = traficos.reduce((s: number, t: { importe_total?: number | string | null }) => s + (Number(t.importe_total) || 0), 0)
        const daysToMVE = Math.ceil((new Date('2026-03-31').getTime() - Date.now()) / 86400000)
        const mveCount = traficos.filter((t: { estatus?: string | null; mve_folio?: string | null }) => !(t.estatus || '').toLowerCase().includes('cruz') && !t.mve_folio).length

        // Best bridge
        const bridgeMap: Record<string, number[]> = {}
        bridges.forEach((b: { bridge_name: string; crossing_hours: number }) => {
          if (!bridgeMap[b.bridge_name]) bridgeMap[b.bridge_name] = []
          bridgeMap[b.bridge_name].push(b.crossing_hours)
        })
        const bridgeItems = Object.entries(bridgeMap)
          .map(([name, hours]) => ({ name, avg: hours.reduce((a, b) => a + b, 0) / hours.length }))
          .sort((a, b) => a.avg - b.avg)

        const ticker: TickerItem[] = []

        if (bridgeItems.length > 0) {
          ticker.push({ text: `🌉 ${bridgeItems[0].name} — ${Math.round(bridgeItems[0].avg * 60)}min espera · RECOMENDADO`, href: '/soia' })
        }
        ticker.push({ text: `🚚 ${enProceso} tráficos activos`, href: '/traficos' })
        if (cruzadosHoy > 0) ticker.push({ text: `✅ ${cruzadosHoy} cruzados hoy`, href: '/traficos' })
        ticker.push({ text: `💰 Valor en proceso: $${valor >= 1e6 ? (valor / 1e6).toFixed(1) + 'M' : Math.round(valor / 1000) + 'K'} USD`, href: '/cuentas' })
        if (daysToMVE > 0 && daysToMVE <= 30) {
          ticker.push({ text: `⏰ MVE E2: ${daysToMVE} días · ${mveCount} pendientes`, href: '/mve' })
        }
        ticker.push({ text: `📊 Aduana 240 Nuevo Laredo · Patente 3596`, href: '/admin' })

        setItems(ticker)
      } catch (e) { console.error('[intelligence-ticker] load failed:', (e as Error).message) }
    }
    load()
    const interval = setInterval(load, 10_800_000) // 3 hours
    return () => clearInterval(interval)
  }, [])

  if (!items.length) return null

  // Duplicate items for seamless loop
  const doubled = [...items, ...items]

  return (
    <div className="intelligence-ticker" style={{
      height: 32, background: '#05070B', overflow: 'hidden',
      display: 'flex', alignItems: 'center', position: 'relative',
      borderBottom: '1px solid rgba(192,197,206,0.15)',
      zIndex: 100
    }}>
      <div className="ticker-track" style={{
        display: 'flex', whiteSpace: 'nowrap',
        animation: 'ticker-scroll 60s linear infinite'
      }}>
        {doubled.map((item, i) => (
          <a key={i} href={item.href} style={{
            padding: '0 24px', fontSize: 12, fontWeight: 500,
            color: GOLD, textDecoration: 'none',
            fontFamily: 'var(--font-jetbrains-mono)',
            letterSpacing: '0.02em'
          }}>
            {item.text}
            <span style={{ margin: '0 16px', opacity: 0.3 }}>·</span>
          </a>
        ))}
      </div>
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>
    </div>
  )
}
