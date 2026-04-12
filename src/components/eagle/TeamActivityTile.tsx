'use client'

import { useEffect, useState } from 'react'
import { ACCENT_SILVER_DIM, TEXT_MUTED, TEXT_PRIMARY } from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'
import { TileShell, MONO } from './tile-shell'
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

  return (
    <TileShell title="Actividad del equipo" subtitle={`${items.length}`}>
      {items.length === 0 ? (
        <div style={{ color: TEXT_MUTED, fontSize: 13 }}>Sin actividad reciente.</div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: 220,
            overflowY: 'auto',
            paddingRight: 4,
          }}
        >
          {items.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                paddingBottom: 6,
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, color: TEXT_PRIMARY, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {verbFor(a.workflow, a.event_type)}
                </div>
                {a.trigger_id ? (
                  <div style={{ fontSize: 11, color: ACCENT_SILVER_DIM, fontFamily: MONO }}>
                    {a.trigger_id}
                  </div>
                ) : null}
              </div>
              <div style={{ fontSize: 10, color: TEXT_MUTED, fontFamily: MONO, whiteSpace: 'nowrap' }}>
                {fmtDateTime(a.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </TileShell>
  )
}
