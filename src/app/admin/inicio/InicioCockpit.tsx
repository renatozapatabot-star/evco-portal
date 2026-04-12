'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as createBrowserSupabase } from '@/lib/supabase/client'
import {
  BG_GRADIENT_START, BG_GRADIENT_END,
  GREEN, AMBER, RED, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from '@/lib/design-system'
import { HeroStrip } from './HeroStrip'
import { ClientHealthGrid } from './ClientHealthGrid'
import { RightRail } from './RightRail'
import { RoleKPIBanner } from '@/components/RoleKPIBanner'
import type { InicioData, SystemStatus } from './types'

const MIN_WEEKLY_DECISIONS_FOR_CELEBRATION = 10

function statusColor(s: SystemStatus): string {
  if (s === 'critical') return RED
  if (s === 'warning') return AMBER
  return GREEN
}

function partOfDay(): string {
  const h = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false }))
  if (h < 12) return 'días'
  if (h < 19) return 'tardes'
  return 'noches'
}

function LiveTimestamp() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  if (!now) return null
  const dateStr = now.toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Chicago',
  })
  const timeStr = now.toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Chicago',
  })
  return (
    <div style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>
      {dateStr} · {timeStr} · Datos en vivo
    </div>
  )
}

export function InicioCockpit({ data }: { data: InicioData }) {
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const sb = createBrowserSupabase()
    const refresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => router.refresh(), 1000)
    }
    const channel = sb
      .channel('admin-inicio')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'traficos' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operational_decisions' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_events' }, refresh)
      .subscribe()
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      sb.removeChannel(channel)
    }
  }, [router])

  const dotColor = statusColor(data.greeting.systemStatus)

  return (
    <div
      className="aguila-dark"
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${BG_GRADIENT_START} 0%, ${BG_GRADIENT_END} 100%)`,
        padding: '24px 16px',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Greeting header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: dotColor, boxShadow: `0 0 8px ${dotColor}`, flexShrink: 0,
          }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{
                fontSize: 24, fontWeight: 800, color: TEXT_PRIMARY,
                margin: 0, letterSpacing: '-0.03em',
              }}>
                Buenas {partOfDay()}, {data.greeting.name}
              </h1>
              <span style={{
                fontFamily: 'var(--font-jetbrains-mono), monospace',
                fontSize: 10, color: TEXT_MUTED,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                PATENTE 3596
              </span>
            </div>
            <p style={{ fontSize: 14, color: TEXT_SECONDARY, marginTop: 2, marginBottom: 0, fontWeight: 500 }}>
              {data.greeting.summaryLine}
            </p>
            <LiveTimestamp />
          </div>
        </div>

        <div className="inicio-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <HeroStrip hero={data.hero} />
            {data.autonomy.thisWeekDecisions >= MIN_WEEKLY_DECISIONS_FOR_CELEBRATION && (
              <RoleKPIBanner
                role="admin"
                name={data.greeting.name}
                thisWeek={data.autonomy.thisWeekDecisions}
                lastWeek={data.autonomy.lastWeekDecisions}
                metricLabel="Autonomía · decisiones esta semana"
                celebrationTemplate={({ name, thisWeek, pct }) =>
                  `Sistema sólido, ${name} — ${thisWeek} decisiones autónomas esta semana, +${pct}% vs. semana pasada.`
                }
              />
            )}
            <ClientHealthGrid clients={data.clientHealth} />
          </div>
          <RightRail rail={data.rightRail} />
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          :global(.inicio-main-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
