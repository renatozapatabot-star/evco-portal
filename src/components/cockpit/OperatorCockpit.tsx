'use client'

import type { OperatorData } from './shared/fetchCockpitData'
import { NextUpHero } from './operator/NextUpHero'
import { MyDayPanel } from './operator/MyDayPanel'
import { BlockedPanel } from './operator/BlockedPanel'
import { DocumentChaser } from './operator/DocumentChaser'
import { OperatorSearch } from './operator/OperatorSearch'
import { PerformanceStrip } from './operator/PerformanceStrip'
import { EntradasCard } from './operator/EntradasCard'
import { ClassificationsCard } from './operator/ClassificationsCard'
import { BridgeCard } from './operator/BridgeCard'
import { ExchangeRateCard } from './operator/ExchangeRateCard'
import { NewsBanner, buildOperatorItems } from './shared/NewsBanner'

interface Props {
  data: OperatorData
  operatorName: string
  operatorId: string
}

export function OperatorCockpit({ data, operatorName, operatorId }: Props) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  const bannerItems = buildOperatorItems({
    assigned: data.myDay.assigned,
    completed: data.myDay.completed,
    inProgress: data.myDay.inProgress,
    blockedCount: data.blocked.length,
    unassignedCount: data.unassignedCount,
  })

  return (
    <div>
      {/* News Banner */}
      <NewsBanner items={bannerItems} />

      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <h1 style={{
          fontSize: 18, fontWeight: 600, color: '#E6EDF3', margin: 0,
        }}>
          {greeting}, {operatorName || 'Operador'}
        </h1>
        <p style={{ fontSize: 13, color: '#6E7681', margin: '4px 0 0' }}>
          Tu panel de trabajo — CRUZ
        </p>
      </div>

      {/* Performance strip */}
      <PerformanceStrip
        completedToday={data.performance.completedToday}
        completedThisWeek={data.performance.completedThisWeek}
        completedThisMonth={data.performance.completedThisMonth}
      />

      {/* Universal search */}
      <OperatorSearch />

      {/* Cards grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 800 }}>
        {/* MI TURNO — the single most important next action */}
        <NextUpHero data={data} operatorName={operatorName} />

        {/* Document Chaser — copy-paste WhatsApp messages for missing docs */}
        <DocumentChaser blocked={data.blocked} operatorName={operatorName} />

        {/* Row: Classifications + Entradas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          <ClassificationsCard />
          <EntradasCard />
        </div>

        {/* My Day + Team stats */}
        <MyDayPanel
          myDay={data.myDay}
          teamStats={data.teamStats}
          unassignedCount={data.unassignedCount}
          operatorId={operatorId}
        />

        {/* Row: Bridges + Exchange Rate */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          <BridgeCard />
          <ExchangeRateCard />
        </div>

        {/* Blocked traficos */}
        <BlockedPanel blocked={data.blocked} operatorId={operatorId} />
      </div>
    </div>
  )
}
