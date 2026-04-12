'use client'

import { useEffect, useCallback, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  BG_GRADIENT_START, BG_GRADIENT_END,
  GREEN, AMBER, RED,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from '@/lib/design-system'
import { HeroStrip } from './HeroStrip'
import { QuickActions } from './QuickActions'
import { ActiveTraficos } from './ActiveTraficos'
import { RightRail } from './RightRail'
import type { TraficoRow, DecisionRow, KPIs, SystemStatus } from './types'

interface Props {
  operatorName: string
  operatorId: string
  kpis: KPIs
  traficos: TraficoRow[]
  feed: DecisionRow[]
  personalAssigned: number
  personalDone: number
  colaCount: number
  systemStatus: SystemStatus
  summaryLine: string
}

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

export function InicioClient(props: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(() => {
    startTransition(() => router.refresh())
  }, [router])

  useEffect(() => {
    const sb = createBrowserSupabaseClient()
    const channel = sb.channel('inicio-realtime')

    const scheduleRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => refresh(), 1000)
    }

    channel
      .on('postgres_changes' as 'system', { event: 'INSERT', schema: 'public', table: 'operational_decisions' }, scheduleRefresh)
      .on('postgres_changes' as 'system', { event: 'UPDATE', schema: 'public', table: 'traficos' }, scheduleRefresh)
      .subscribe()

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      sb.removeChannel(channel)
    }
  }, [refresh])

  const dotColor = statusColor(props.systemStatus)

  return (
    <div
      className="aduana-dark"
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${BG_GRADIENT_START}, ${BG_GRADIENT_END})`,
        color: TEXT_PRIMARY,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div className="p-4 md:px-7 md:py-6" style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Greeting header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: dotColor, boxShadow: `0 0 8px ${dotColor}`, flexShrink: 0,
          }} />
          <div>
            <h1 style={{
              fontSize: 24, fontWeight: 800, color: TEXT_PRIMARY,
              margin: 0, letterSpacing: '-0.03em',
            }}>
              Buenas {partOfDay()}, {props.operatorName}
            </h1>
            <p style={{ fontSize: 14, color: TEXT_SECONDARY, marginTop: 2, marginBottom: 0, fontWeight: 500 }}>
              {props.summaryLine}
            </p>
            <LiveTimestamp />
          </div>
        </div>

        <QuickActions />

        <div className="inicio-main" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
          <style>{`
            @media (max-width: 1024px) {
              .inicio-main { grid-template-columns: 1fr !important; }
            }
          `}</style>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <HeroStrip kpis={props.kpis} />
            <ActiveTraficos
              rows={props.traficos}
              onRefresh={refresh}
            />
          </div>
          <RightRail
            colaCount={props.colaCount}
            feed={props.feed}
          />
        </div>
      </div>
    </div>
  )
}
