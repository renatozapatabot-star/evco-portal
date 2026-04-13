'use client'

import { useEffect, useState } from 'react'
import { TileShell } from './tile-shell'
import { TimelineFeed, type TimelineItem } from '@/components/aguila'
import type { ActivityItem } from '@/app/api/eagle/overview/route'

const REFRESH_MS = 30_000

function verbFor(workflow: string, event_type: string): string {
  const et = event_type.replace(/_/g, ' ')
  return `${workflow} · ${et}`
}

export function TeamActivityTile({ initial }: { initial: ActivityItem[] }) {
  const [items, setItems] = useState<ActivityItem[]>(initial)

  useEffect(() => {
    let cancelled = false
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/eagle/overview', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled && json?.data?.recentActivity) {
          setItems(json.data.recentActivity as ActivityItem[])
        }
      } catch {
        // soft fail — next tick tries again
      }
    }, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const timelineItems: TimelineItem[] = items.slice(0, 8).map((a) => ({
    id: String(a.id),
    title: verbFor(a.workflow, a.event_type),
    subtitle: a.trigger_id ?? undefined,
    timestamp: a.created_at,
  }))

  return (
    <TileShell title="Actividad del equipo" subtitle={`${items.length}`}>
      <div style={{ maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
        <TimelineFeed items={timelineItems} max={8} emptyLabel="Sin actividad reciente." />
      </div>
    </TileShell>
  )
}
