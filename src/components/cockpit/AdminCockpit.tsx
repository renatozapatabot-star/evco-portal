'use client'

import type { AdminData } from './shared/fetchCockpitData'
import { CruzAutonomoPanel } from './admin/CruzAutonomoPanel'
import { NeedsJudgmentPanel } from './admin/NeedsJudgmentPanel'
import { SmartQueuePanel } from './admin/SmartQueuePanel'
import { TeamPanel } from './admin/TeamPanel'
import { TeamLivePanel } from './admin/TeamLivePanel'
import { ClientsTablePanel } from './admin/ClientsTablePanel'
import { RightRail } from './admin/RightRail'
import { NewsBanner, buildAdminItems } from './shared/NewsBanner'
import { Trend, computeDelta } from './shared/Trend'

interface Props {
  data: AdminData
  operatorName: string
}

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export function AdminCockpit({ data, operatorName }: Props) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const biz = data.businessSummary

  const overdue = data.escalations.filter(e => {
    const ageH = (Date.now() - new Date(e.created_at).getTime()) / 3600000
    return ageH > 24
  })

  const bannerItems = buildAdminItems({
    totalTraficos: biz.totalTraficos,
    activeTraficos: biz.activeTraficos,
    cruzadosThisMonth: biz.cruzadosThisMonth,
    cruzadosLastMonth: biz.cruzadosLastMonth,
    valorYtdUsd: biz.valorYtdUsd,
    activeClients: biz.activeClients,
    escalationCount: data.escalations.length,
    overdueCount: overdue.length,
    decisionsTotal30d: data.agentDecisions30d.total,
    accuracy30d: data.agentDecisions30d.accuracy,
  })

  // Business health level
  const healthLevel: 'green' | 'amber' | 'red' =
    data.escalations.length > 5 ? 'red'
    : data.escalations.length > 0 || (biz.oldestActiveAgeDays ?? 0) > 30 ? 'amber'
    : 'green'

  const healthColors = {
    green: { border: 'rgba(22,163,74,0.5)', dot: '#16A34A' },
    amber: { border: 'rgba(217,119,6,0.6)', dot: '#D97706' },
    red:   { border: 'rgba(220,38,38,0.7)', dot: '#DC2626' },
  }

  const healthSentence =
    healthLevel === 'green'
      ? `Patente 3596 al corriente. ${biz.activeTraficos} tráficos activos, ${biz.last30Days} en los últimos 30 días.`
    : healthLevel === 'amber'
      ? `${data.escalations.length} pendiente${data.escalations.length !== 1 ? 's' : ''} por atender. ${biz.activeTraficos} tráficos activos.`
    : `${data.escalations.length} escalaciones requieren atención inmediata.`

  // Month comparison
  const monthTrend = biz.cruzadosLastMonth > 0
    ? Math.round(((biz.cruzadosThisMonth - biz.cruzadosLastMonth) / biz.cruzadosLastMonth) * 100)
    : 0
  const trendArrow = monthTrend > 0 ? '↑' : monthTrend < 0 ? '↓' : '→'
  const trendColor = monthTrend > 0 ? '#16A34A' : monthTrend < 0 ? '#DC2626' : '#8B949E'

  return (
    <div>
      {/* News Banner */}
      <NewsBanner items={bannerItems} />

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontSize: 18, fontWeight: 600, color: '#E6EDF3', margin: 0,
        }}>
          {greeting}, {operatorName || 'Administrador'}
        </h1>
        <p style={{ fontSize: 13, color: '#6E7681', margin: '4px 0 0' }}>
          Patente 3596 · Aduana 240 Nuevo Laredo
        </p>
      </div>

      {/* Main layout: column + right rail */}
      <div style={{
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
      }}>
        {/* Main column */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {/* HERO: Business Health */}
          <div style={{
            background: '#222222', borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.08)',
            borderTop: `3px solid ${healthColors[healthLevel].border}`,
            padding: 20,
          }}>
            {/* Status line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: healthColors[healthLevel].dot, display: 'inline-block',
              }} />
              <span style={{ fontSize: 14, color: '#E6EDF3', fontWeight: 500 }}>
                {healthSentence}
              </span>
            </div>

            {/* KPI strip */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <div className="font-mono" style={{ fontSize: 24, fontWeight: 800, color: '#E6EDF3' }}>
                  {biz.totalTraficos.toLocaleString('es-MX')}
                </div>
                <div style={{ fontSize: 11, color: '#8B949E' }}>tráficos totales</div>
              </div>
              <div>
                <div className="font-mono" style={{ fontSize: 24, fontWeight: 800, color: '#C9A84C' }}>
                  {biz.activeTraficos}
                </div>
                <div style={{ fontSize: 11, color: '#8B949E' }}>en proceso</div>
              </div>
              <div>
                <div className="font-mono" style={{ fontSize: 24, fontWeight: 800, color: '#E6EDF3' }}>
                  {biz.cruzadosThisMonth}
                  <span style={{ fontSize: 14, fontWeight: 600, color: trendColor, marginLeft: 6 }}>
                    {trendArrow}{Math.abs(monthTrend)}%
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#8B949E' }}>cruzados este mes</div>
              </div>
              <div>
                <div className="font-mono" style={{ fontSize: 24, fontWeight: 800, color: '#E6EDF3' }}>
                  {fmtUSD(biz.valorYtdUsd)} <span style={{ fontSize: 12, fontWeight: 400, color: '#8B949E' }}>USD</span>
                </div>
                <div style={{ fontSize: 11, color: '#8B949E' }}>valor YTD</div>
              </div>
              <div>
                <div className="font-mono" style={{ fontSize: 24, fontWeight: 800, color: '#E6EDF3' }}>
                  {biz.activeClients}
                </div>
                <div style={{ fontSize: 11, color: '#8B949E' }}>clientes activos</div>
              </div>
              {biz.oldestActiveAgeDays !== null && biz.oldestActiveAgeDays > 0 && (
                <div>
                  <div className="font-mono" style={{
                    fontSize: 24, fontWeight: 800,
                    color: biz.oldestActiveAgeDays > 30 ? '#DC2626' : biz.oldestActiveAgeDays > 14 ? '#D97706' : '#E6EDF3',
                  }}>
                    {biz.oldestActiveAgeDays}d
                  </div>
                  <div style={{ fontSize: 11, color: '#8B949E' }}>más antiguo activo</div>
                </div>
              )}
            </div>
          </div>

          <CruzAutonomoPanel
            decisions={data.agentDecisions24h}
            decisions30d={data.agentDecisions30d}
            decisionsAllTime={data.agentDecisionsAllTime}
            workflow={data.workflowEvents24h}
            workflow30d={data.workflowEvents30d}
            actions={data.operatorActions24h}
            actions30d={data.operatorActions30d}
          />
          <NeedsJudgmentPanel escalations={data.escalations} />
          <SmartQueuePanel queue={data.smartQueue} />
          <TeamPanel team={data.teamStats} unassigned={data.unassignedCount} />
          <TeamLivePanel />
          <ClientsTablePanel companies={data.companies} />
        </div>

        {/* Right rail — hidden on mobile, 320px on desktop */}
        <div style={{
          width: 320,
          flexShrink: 0,
          display: 'none',
        }} className="admin-right-rail">
          <RightRail />
        </div>
      </div>

      {/* Mobile: right rail stacks below */}
      <div style={{ marginTop: 12 }} className="admin-right-rail-mobile">
        <RightRail />
      </div>

      <style>{`
        @media (min-width: 768px) {
          .admin-right-rail { display: block !important; }
          .admin-right-rail-mobile { display: none !important; }
        }
        @media (max-width: 767px) {
          .admin-right-rail { display: none !important; }
          .admin-right-rail-mobile { display: block !important; }
        }
      `}</style>
    </div>
  )
}
