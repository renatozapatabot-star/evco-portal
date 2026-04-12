'use client'

import { useState, useEffect, useCallback, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { BG_GRADIENT_START, BG_GRADIENT_END, TEXT_PRIMARY, TEXT_MUTED, GOLD_GRADIENT } from '@/lib/design-system'
import { fmtDate } from '@/lib/format-utils'
import { HeroStrip } from './HeroStrip'
import { QuickActions } from './QuickActions'
import { ActiveTraficos } from './ActiveTraficos'
import { RightRail } from './RightRail'
import type { TraficoRow, DecisionRow, KPIs } from './types'

interface Props {
  operatorName: string
  operatorId: string
  kpis: KPIs
  traficos: TraficoRow[]
  feed: DecisionRow[]
  personalAssigned: number
  personalDone: number
  colaCount: number
}

export function InicioClient(props: Props) {
  const router = useRouter()
  const [filterKey, setFilterKey] = useState<keyof KPIs | null>(null)
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
      <div className="p-4 md:px-7 md:py-6">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 36, height: 36, background: GOLD_GRADIENT,
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: '#0D0D0C', fontFamily: 'Georgia, serif',
          }}>Z</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Buenos días, {props.operatorName}
            </h1>
            <p style={{ color: TEXT_MUTED, fontSize: 12, margin: '4px 0 0 0' }}>
              Inicio · <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(new Date())}</span>
            </p>
          </div>
        </div>

        <QuickActions />

        <HeroStrip
          kpis={props.kpis}
          active={filterKey}
          onFilter={setFilterKey}
        />

        <div className="inicio-main" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 16 }}>
          <style>{`
            @media (max-width: 1024px) {
              .inicio-main { grid-template-columns: 1fr !important; }
            }
          `}</style>
          <ActiveTraficos
            rows={props.traficos}
            filterKey={filterKey}
            onRefresh={refresh}
          />
          <RightRail
            personalAssigned={props.personalAssigned}
            personalDone={props.personalDone}
            colaCount={props.colaCount}
            feed={props.feed}
          />
        </div>
      </div>
    </div>
  )
}
