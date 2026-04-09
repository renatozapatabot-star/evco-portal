'use client'

import type { OperatorData } from './shared/fetchCockpitData'
import { NextUpHero } from './operator/NextUpHero'
import { MyDayPanel } from './operator/MyDayPanel'
import { BlockedPanel } from './operator/BlockedPanel'
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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{
          fontSize: 18, fontWeight: 600, color: '#E6EDF3', margin: 0,
        }}>
          {greeting}, {operatorName || 'Operador'}
        </h1>
        <p style={{ fontSize: 13, color: '#6E7681', margin: '4px 0 0' }}>
          Tu panel de trabajo — CRUZ
        </p>
      </div>

      {/* Single column, hero first */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 700 }}>
        <NextUpHero nextUp={data.nextUp} operatorId={operatorId} />
        <MyDayPanel
          myDay={data.myDay}
          teamStats={data.teamStats}
          unassignedCount={data.unassignedCount}
          operatorId={operatorId}
        />
        <BlockedPanel blocked={data.blocked} operatorId={operatorId} />
      </div>
    </div>
  )
}
