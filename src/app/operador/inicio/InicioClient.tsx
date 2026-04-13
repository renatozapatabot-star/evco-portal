'use client'

import { useEffect, useCallback, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Truck, AlertTriangle, FileText, Upload, FileSpreadsheet, Radio, Shield, BarChart3 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  COCKPIT_CANVAS,
  GREEN, AMBER, RED,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED,
} from '@/lib/design-system'
import { HeroStrip } from './HeroStrip'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import { CockpitBackdrop } from '@/components/cockpit/shared/CockpitBackdrop'
import { QuickActions } from './QuickActions'
import { ActiveTraficos } from './ActiveTraficos'
import { RightRail } from './RightRail'
import { NavCardGrid, type NavCardGridItem, type NavTile } from '@/components/NavCardGrid'
import { RoleKPIBanner } from '@/components/RoleKPIBanner'
import type { TraficoRow, DecisionRow, KPIs, SystemStatus } from './types'

interface OperatorTile extends NavTile {
  badgeKey?: 'personalActive' | 'excepcionesCount' | 'pedimentosPendientes'
}

// V1 cockpit tiles (Phase 4 cull) — cards only route to V1-approved surfaces.
const OPERATOR_TILES: OperatorTile[] = [
  { href: '/traficos?mio=1',              label: 'Mis tráficos',          icon: Truck as LucideIcon,          description: 'En proceso asignados',        badgeKey: 'personalActive' },
  { href: '/operador/cola',               label: 'Cola de excepciones',   icon: AlertTriangle as LucideIcon,  description: 'Pendientes de resolver',      badgeKey: 'excepcionesCount' },
  { href: '/pedimentos?estatus=borrador', label: 'Pedimentos pendientes', icon: FileText as LucideIcon,       description: 'Borradores y revisión',       badgeKey: 'pedimentosPendientes' },
  { href: '/operador/subir',              label: 'Subir documentos',      icon: Upload as LucideIcon,         description: 'Arrastra PDFs / fotos' },
  { href: '/banco-facturas',              label: 'Banco de facturas',     icon: FileSpreadsheet as LucideIcon, description: 'Facturas indexadas y búsqueda' },
  { href: '/corredor',                    label: 'Corredor',              icon: Radio as LucideIcon,          description: 'Estado del corredor en vivo' },
  { href: '/mve/alerts',                  label: 'MVE',                   icon: Shield as LucideIcon,         description: 'Alertas de compliance' },
  { href: '/reportes',                    label: 'Reportes',              icon: BarChart3 as LucideIcon,      description: 'Análisis y estadísticas' },
]

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
  personalCompletedThisWeek: number
  personalCompletedLastWeek: number
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
      className="aguila-dark"
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: COCKPIT_CANVAS,
        color: TEXT_PRIMARY,
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
      }}
    >
      <CockpitBackdrop />
      <div className="p-4 md:px-7 md:py-6" style={{ position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto' }}>
        {/* AGUILA brand trio */}
        <CockpitBrandHeader subtitle={`Operador · ${props.operatorName}`} />

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
            <RoleKPIBanner
              role="operator"
              name={props.operatorName}
              thisWeek={props.personalCompletedThisWeek}
              lastWeek={props.personalCompletedLastWeek}
              metricLabel="Tráficos cruzados · últimos 7 días"
              celebrationTemplate={({ name, thisWeek, pct }) =>
                `${name}, cerraste ${thisWeek} tráfico${thisWeek === 1 ? '' : 's'} esta semana (+${pct}% vs semana pasada). AGUILA te lo reconoce.`
              }
            />
            <NavCardGrid items={OPERATOR_TILES.map((tile): NavCardGridItem => {
              const badges: Record<string, number> = {
                personalActive: props.personalAssigned,
                excepcionesCount: props.colaCount,
                pedimentosPendientes: props.kpis.pendientes,
              }
              const count = tile.badgeKey ? (badges[tile.badgeKey] ?? null) : null
              return {
                tile: {
                  href: tile.href,
                  label: tile.label,
                  icon: tile.icon,
                  description: tile.description,
                },
                count,
              }
            })} />
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
