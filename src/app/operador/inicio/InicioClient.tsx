'use client'

import { useEffect, useCallback, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Activity } from 'lucide-react'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_MUTED, TEXT_SECONDARY, ACCENT_SILVER, GOLD, AMBER,
} from '@/lib/design-system'
import {
  CockpitInicio,
  SeverityRibbon, severityFromCount,
  type CockpitHeroKPI,
  type TimelineItem,
} from '@/components/aguila'
import { ActiveTraficos } from './ActiveTraficos'
import { RoleKPIBanner } from '@/components/RoleKPIBanner'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'
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
  personalCompletedThisWeek: number
  personalCompletedLastWeek: number
  navCounts: NavCounts
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

  // Hero KPIs — 4 tiles, operator tone.
  const heroKPIs: CockpitHeroKPI[] = [
    {
      key: 'entradas',
      label: 'Entradas hoy',
      value: props.kpis.entradasHoy,
      series: props.kpis.entradasSeries,
      current: props.kpis.entradasCurr7,
      previous: props.kpis.entradasPrev7,
      href: '/operador/entradas?range=hoy',
      tone: 'silver',
    },
    {
      key: 'activos',
      label: 'Tráficos activos',
      value: props.kpis.activos,
      series: props.kpis.activosSeries,
      current: props.kpis.activosCurr7,
      previous: props.kpis.activosPrev7,
      href: '/traficos?estatus=En+Proceso',
      tone: 'silver',
    },
    {
      key: 'pendientes',
      label: 'Pedimentos pendientes',
      value: props.kpis.pendientes,
      series: props.kpis.pendientesSeries,
      current: props.kpis.pendientesCurr7,
      previous: props.kpis.pendientesPrev7,
      href: '/pedimentos?estatus=borrador',
      tone: 'silver',
      inverted: true,
    },
    {
      key: 'atrasados',
      label: 'Atrasados >7d',
      value: props.kpis.atrasados,
      series: props.kpis.atrasadosSeries,
      current: props.kpis.atrasadosCurr7,
      previous: props.kpis.atrasadosPrev7,
      href: '/traficos?atrasados=7d',
      tone: 'silver',
      urgent: props.kpis.atrasados > 0,
      inverted: true,
    },
  ]

  // Actividad reciente — ops-wide decisions (not filtered by operator).
  const actividad: TimelineItem[] = props.feed.slice(0, 8).map((f) => ({
    id: String(f.id),
    title: f.trafico || '—',
    subtitle: f.decision ? truncate(f.decision, 72) : undefined,
    timestamp: f.created_at,
    href: f.trafico ? `/traficos/${encodeURIComponent(f.trafico)}` : undefined,
    accessory: <DecisionPill label={f.decision_type} />,
  }))

  // Estado de operaciones — operator-specific: celebration banner + cola excepciones + active tráficos
  const estadoSections = (
    <>
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
      <ColaCard colaCount={props.colaCount} />
      <ActiveTraficos rows={props.traficos} onRefresh={refresh} />
    </>
  )

  return (
    <CockpitInicio
      role="operator"
      name={props.operatorName}
      heroKPIs={heroKPIs}
      navCounts={props.navCounts}
      estadoSections={estadoSections}
      actividad={actividad}
      actividadEmptyLabel="Aún no hay actividad registrada hoy."
      systemStatus={props.systemStatus}
      summaryLine={props.summaryLine}
    />
  )
}

function ColaCard({ colaCount }: { colaCount: number }) {
  const severity = severityFromCount(colaCount, { warn: 1, crit: 6 })
  return (
    <section style={{
      position: 'relative',
      overflow: 'hidden',
      background: BG_CARD,
      backdropFilter: `blur(${GLASS_BLUR})`,
      WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
      border: `1px solid ${BORDER}`,
      borderRadius: 'var(--aguila-radius-card, 20px)',
      boxShadow: GLASS_SHADOW,
      padding: '20px 20px 20px 23px',
    }}>
      {colaCount > 0 && <SeverityRibbon tone={severity} />}
      <div style={{
        fontSize: 'var(--aguila-fs-label, 10px)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 'var(--aguila-ls-label, 0.08em)',
        color: TEXT_MUTED,
      }}>
        Cola de excepciones
      </div>
      <div style={{
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: 'var(--aguila-fs-kpi-large, 44px)',
        fontWeight: 800,
        color: colaCount > 0 ? (severity === 'critical' ? AMBER : GOLD) : TEXT_MUTED,
        margin: '8px 0 12px 0',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {colaCount}
      </div>
      {colaCount > 0 ? (
        <Link
          href="/operador/cola"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            padding: '10px 16px',
            borderRadius: 12,
            background: GOLD,
            color: '#0D0D0C',
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
            width: '100%',
          }}
        >
          Ver cola →
        </Link>
      ) : (
        <p style={{ fontSize: 12, color: TEXT_SECONDARY, margin: 0 }}>
          Sin excepciones pendientes.
        </p>
      )}
    </section>
  )
}

const DECISION_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  'En Proceso':       { bg: 'rgba(192,197,206,0.12)', fg: ACCENT_SILVER,   label: 'En proceso' },
  'Documentacion':    { bg: 'rgba(148,163,184,0.12)', fg: '#94a3b8',       label: 'Documentación' },
  'En Aduana':        { bg: 'rgba(148,163,184,0.12)', fg: '#94a3b8',       label: 'En aduana' },
  'Pedimento Pagado': { bg: 'rgba(34,197,94,0.12)',   fg: '#22C55E',       label: 'Pagado' },
  'Cruzado':          { bg: 'rgba(34,197,94,0.12)',   fg: '#22C55E',       label: 'Cruzado' },
}

function DecisionPill({ label }: { label: string | null }) {
  const c = (label && DECISION_PILL[label]) || { bg: 'rgba(148,163,184,0.1)', fg: TEXT_MUTED, label: label || '—' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      padding: '2px 8px', borderRadius: 20,
      background: c.bg, color: c.fg,
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}

function truncate(s: string | null, n: number): string {
  if (!s) return '—'
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}

// Used only by the activity callout indicator style.
void Activity
