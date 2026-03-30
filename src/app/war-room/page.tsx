'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CLIENT_CLAVE, COMPANY_ID } from '@/lib/client-config'
import { GOLD } from '@/lib/design-system'
import { fmtDateTimeLocal } from '@/lib/format-utils'

export default function WarRoom() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const [trafRes, bridgeRes, compRes, riskRes] = await Promise.all([
        fetch(`/api/data?table=traficos&company_id=${COMPANY_ID}&limit=2000`).then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/data?table=bridge_intelligence&limit=50&order_by=updated_at&order_dir=desc').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/data?table=compliance_predictions&limit=50').then(r => r.json()).catch(() => ({ data: [] })),
        fetch('/api/data?table=pedimento_risk_scores&limit=50&order_by=overall_score&order_dir=desc').then(r => r.json()).catch(() => ({ data: [] })),
      ])
      const traficos = trafRes.data || []
      const enProceso = traficos.filter((t: any) => !(t.estatus || '').toLowerCase().includes('cruz'))
      const cruzadosHoy = traficos.filter((t: any) => (t.estatus || '').toLowerCase().includes('cruz') && t.fecha_cruce && new Date(t.fecha_cruce).toDateString() === new Date().toDateString()).length
      const bridges = bridgeRes.data || []
      const bridgeMap: Record<string, number[]> = {}
      bridges.forEach((b: any) => { if (!bridgeMap[b.bridge_name]) bridgeMap[b.bridge_name] = []; bridgeMap[b.bridge_name].push(b.crossing_hours) })
      const bridgeSummary = Object.entries(bridgeMap).map(([n, h]) => ({ name: n, avg: h.reduce((a, b) => a + b, 0) / h.length })).sort((a, b) => a.avg - b.avg)
      const comp = (compRes.data || []).filter((c: any) => !c.resolved)
      const critical = comp.filter((c: any) => c.severity === 'critical').length
      const risks = (riskRes.data || []).filter((r: any) => (r.overall_score || 0) >= 50)
      const noPedimento = enProceso.filter((t: any) => !t.pedimento).length
      const mveCount = enProceso.filter((t: any) => !t.mve_folio).length
      setData({ enProceso, cruzadosHoy, bridgeSummary, critical, risks, noPedimento, mveCount, total: traficos.length })
    }
    load()
    const i = setInterval(load, 30000)
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') router.back() }
    window.addEventListener('keydown', esc)
    return () => { clearInterval(i); window.removeEventListener('keydown', esc) }
  }, [router])

  const urgentes = data?.enProceso?.filter((t: any) => {
    if (!t.fecha_llegada) return false
    return (Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000 > 7
  }).length || 0
  const ambient = urgentes > 5 ? 'rgba(220,38,38,0.05)' : 'rgba(22,163,74,0.03)'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: `${ambient}`, backgroundColor: '#0A0A0A', fontFamily: 'var(--font-geist-sans)', color: '#E8E6E0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1A1A1A' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: urgentes > 5 ? '#DC2626' : '#16A34A', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>WAR ROOM — CRUZ</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: '#666', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtDateTimeLocal(new Date()).split(' · ')[1] || fmtDateTimeLocal(new Date())}</span>
          <button onClick={() => router.back()} style={{ background: '#1A1A1A', border: '1px solid #333', borderRadius: 6, color: '#999', padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}>ESC</button>
        </div>
      </div>

      {/* 4 Quadrants */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 1, background: '#1A1A1A' }}>
        {/* Q1: Active Tráficos */}
        <div style={{ background: 'var(--bg-dark)', padding: 20, overflow: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Tráficos Activos
            <span style={{ float: 'right', color: GOLD }}>{data?.enProceso?.length || 0}</span>
          </div>
          {data?.enProceso?.slice(0, 15).map((t: any) => {
            const days = t.fecha_llegada ? Math.floor((Date.now() - new Date(t.fecha_llegada).getTime()) / 86400000) : 0
            const color = days > 14 ? '#DC2626' : days > 7 ? '#D97706' : '#16A34A'
            return (
              <div key={t.trafico} style={{ padding: '6px 0', borderBottom: '1px solid #1A1A1A', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 600 }}>{t.trafico}</span>
                <span style={{ color, fontWeight: 700 }}>{days}d</span>
              </div>
            )
          })}
        </div>

        {/* Q2: Bridges */}
        <div style={{ background: 'var(--bg-dark)', padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Puentes en Vivo
          </div>
          {(data?.bridgeSummary || []).map((b: any, i: number) => {
            const pct = Math.min(100, (b.avg / 3) * 100)
            return (
              <div key={b.name} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{b.name}{i === 0 ? ' ✅' : ''}</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono)', color: GOLD }}>{Math.round(b.avg * 60)}min</span>
                </div>
                <div style={{ height: 6, background: '#1A1A1A', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: pct > 66 ? '#DC2626' : pct > 33 ? '#D97706' : '#16A34A' }} />
                </div>
              </div>
            )
          })}
          {(data?.bridgeSummary || []).length === 0 && <div style={{ color: '#666', fontSize: 13 }}>Sin datos de puentes</div>}
        </div>

        {/* Q3: Action Items */}
        <div style={{ background: 'var(--bg-dark)', padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Acción Inmediata
          </div>
          {[
            { icon: '🚨', label: 'MVE pendientes', value: data?.mveCount || 0, color: '#DC2626' },
            { icon: '📄', label: 'Sin pedimento', value: data?.noPedimento || 0, color: '#D97706' },
            { icon: '⚠️', label: 'Alertas críticas', value: data?.critical || 0, color: '#DC2626' },
            { icon: '🔴', label: 'Riesgo alto', value: data?.risks?.length || 0, color: '#D97706' },
          ].map(item => (
            <div key={item.label} style={{ padding: '10px 0', borderBottom: '1px solid #1A1A1A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14 }}>{item.icon} {item.label}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: item.value > 0 ? item.color : '#16A34A', fontFamily: 'var(--font-jetbrains-mono)' }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Q4: Intelligence */}
        <div style={{ background: 'var(--bg-dark)', padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Inteligencia
          </div>
          {[
            { label: 'Cruzados hoy', value: data?.cruzadosHoy || 0 },
            { label: 'Urgentes (+7d)', value: urgentes },
            { label: 'Total cartera', value: data?.total || 0 },
          ].map(item => (
            <div key={item.label} style={{ padding: '10px 0', borderBottom: '1px solid #1A1A1A', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, color: '#9C9690' }}>{item.label}</span>
              <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-jetbrains-mono)' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
