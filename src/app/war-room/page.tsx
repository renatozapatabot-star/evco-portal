'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getClientClaveCookie, getCompanyIdCookie } from '@/lib/client-config'
import { GOLD } from '@/lib/design-system'
import { fmtDateTimeLocal } from '@/lib/format-utils'
import { useStatusSentence } from '@/hooks/use-status-sentence'

export default function WarRoom() {
  const router = useRouter()
  const statusSentence = useStatusSentence()
  const [data, setData] = useState<{ enProceso: { trafico: string; fecha_llegada?: string | null }[]; cruzadosHoy: number; bridgeSummary: { name: string; avg: number }[]; critical: number; risks: { overall_score?: number }[]; noPedimento: number; mveCount: number; total: number } | null>(null)

  useEffect(() => {
    const load = async () => {
      const companyId = getCompanyIdCookie()
      const [trafRes, bridgeRes, compRes, riskRes] = await Promise.all([
        fetch(`/api/data?table=traficos&company_id=${companyId}&limit=2000`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/data?table=bridge_intelligence&limit=50&order_by=updated_at&order_dir=desc').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/data?table=compliance_predictions&limit=50').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/data?table=pedimento_risk_scores&limit=50&order_by=overall_score&order_dir=desc').then(r => r.json()).catch(() => ({ data: [] })),
      ])
      const traficos = trafRes.data || []
      const enProceso = traficos.filter((t: { estatus?: string | null }) => !(t.estatus || '').toLowerCase().includes('cruz'))
      const cruzadosHoy = traficos.filter((t: { estatus?: string | null; fecha_cruce?: string | null }) => (t.estatus || '').toLowerCase().includes('cruz') && t.fecha_cruce && new Date(t.fecha_cruce).toDateString() === new Date().toDateString()).length
      const bridges = bridgeRes.data || []
      const bridgeMap: Record<string, number[]> = {}
      bridges.forEach((b: { bridge_name: string; crossing_hours: number }) => { if (!bridgeMap[b.bridge_name]) bridgeMap[b.bridge_name] = []; bridgeMap[b.bridge_name].push(b.crossing_hours) })
      const bridgeSummary = Object.entries(bridgeMap).map(([n, h]) => ({ name: n, avg: h.reduce((a, b) => a + b, 0) / h.length })).sort((a, b) => a.avg - b.avg)
      const comp = (compRes.data || []).filter((c: { resolved?: boolean }) => !c.resolved)
      const critical = comp.filter((c: { severity?: string }) => c.severity === 'critical').length
      const risks = (riskRes.data || []).filter((r: { overall_score?: number }) => (r.overall_score || 0) >= 50)
      const noPedimento = enProceso.filter((t: { pedimento?: string | null }) => !t.pedimento).length
      const mveCount = enProceso.filter((t: { mve_folio?: string | null }) => !t.mve_folio).length
      setData({ enProceso, cruzadosHoy, bridgeSummary, critical, risks, noPedimento, mveCount, total: traficos.length })
    }
    load()
    const i = setInterval(load, 30000)
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') router.back() }
    window.addEventListener('keydown', esc)
    return () => { clearInterval(i); window.removeEventListener('keydown', esc) }
  }, [router])

  const urgentes = statusSentence.urgentes
  const ambient = urgentes > 5 ? 'rgba(220,38,38,0.05)' : 'rgba(22,163,74,0.03)'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: `${ambient}`, backgroundColor: 'var(--bg-main)', fontFamily: 'var(--font-geist-sans)', color: 'var(--text-primary)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: urgentes > 5 ? 'var(--danger-500)' : 'var(--success)', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>WAR ROOM — CRUZ</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtDateTimeLocal(new Date()).split(' · ')[1] || fmtDateTimeLocal(new Date())}</span>
          <button onClick={() => router.back()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>ESC</button>
        </div>
      </div>

      {/* 4 Quadrants */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 1, background: 'var(--border)' }}>
        {/* Q1: Active Tráficos */}
        <div style={{ background: 'var(--bg-card)', padding: 20, overflow: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Tráficos Activos
            <span style={{ float: 'right', color: GOLD }}>{data?.enProceso?.length || 0}</span>
          </div>
          {data?.enProceso?.slice(0, 15).map((t: { trafico: string; fecha_llegada?: string | null }) => {
            const days = t.fecha_llegada ? Math.floor((Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000) : 0
            const color = days > 14 ? 'var(--danger-500)' : days > 7 ? 'var(--warning-500, #D97706)' : 'var(--success)'
            return (
              <div key={t.trafico} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 600 }}>{t.trafico}</span>
                <span style={{ color, fontWeight: 700 }}>{days}d</span>
              </div>
            )
          })}
        </div>

        {/* Q2: Bridges */}
        <div style={{ background: 'var(--bg-card)', padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Puentes en Vivo
          </div>
          {(data?.bridgeSummary || []).map((b: { name: string; avg: number }, i: number) => {
            const pct = Math.min(100, (b.avg / 3) * 100)
            return (
              <div key={b.name} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{b.name}{i === 0 ? ' ✅' : ''}</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono)', color: GOLD }}>{Math.round(b.avg * 60)}min</span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: pct > 66 ? 'var(--danger-500)' : pct > 33 ? 'var(--warning-500, #D97706)' : 'var(--success)' }} />
                </div>
              </div>
            )
          })}
          {(data?.bridgeSummary || []).length === 0 && <div style={{ padding: 24, textAlign: 'center' }}><div style={{ fontSize: 24, marginBottom: 4 }}>🌉</div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sin datos de puentes disponibles</div></div>}
        </div>

        {/* Q3: Action Items */}
        <div style={{ background: 'var(--bg-card)', padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Acción Inmediata
          </div>
          {[
            { icon: '🚨', label: 'MVE pendientes', value: data?.mveCount || 0, color: 'var(--danger-500)' },
            { icon: '📄', label: 'Sin pedimento', value: data?.noPedimento || 0, color: 'var(--warning)' },
            { icon: '⚠️', label: 'Alertas críticas', value: data?.critical || 0, color: 'var(--danger-500)' },
            { icon: '🔴', label: 'Riesgo alto', value: data?.risks?.length || 0, color: 'var(--warning)' },
          ].map(item => (
            <div key={item.label} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14 }}>{item.icon} {item.label}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: item.value > 0 ? item.color : 'var(--success)', fontFamily: 'var(--font-jetbrains-mono)' }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Q4: Intelligence */}
        <div style={{ background: 'var(--bg-card)', padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Inteligencia
          </div>
          {[
            { label: 'Cruzados hoy', value: data?.cruzadosHoy || 0 },
            { label: 'Urgentes (+7d)', value: urgentes },
            { label: 'Total cartera', value: data?.total || 0 },
          ].map(item => (
            <div key={item.label} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{item.label}</span>
              <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-jetbrains-mono)' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
