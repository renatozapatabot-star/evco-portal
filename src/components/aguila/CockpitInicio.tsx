'use client'

import type { ReactNode } from 'react'
import { Activity } from 'lucide-react'
import { ACCENT_SILVER } from '@/lib/design-system'
import { PageShell } from './PageShell'
import { KPITile } from './KPITile'
import { TimelineFeed, type TimelineItem } from './TimelineFeed'
import type { SparklineTone } from './Sparkline'
import { NavCardGrid, type NavCardGridItem } from '@/components/NavCardGrid'
import { UNIFIED_NAV_TILES, type NavCounts, type NavTileKey } from '@/lib/cockpit/nav-tiles'
import { CockpitBanner, type CockpitRole } from './CockpitBanner'
import { cleanCompanyDisplayName } from '@/lib/format/company-name'
import { PortalCard } from '@/components/portal/PortalCard'

type SystemStatus = 'healthy' | 'warning' | 'critical'

export interface CockpitHeroKPI {
  key: string
  label: string
  value: number | string
  /** Small secondary line rendered below `value`. Use for companion
   *  data that shouldn't compete with the headline — e.g. an absolute
   *  date under a relative "hace N días" (quiet-season Último cruce
   *  tile), a total beneath a month count, etc. Renders muted,
   *  JetBrains Mono, single-line with ellipsis. */
  sublabel?: string
  series?: number[]
  current?: number
  previous?: number
  href?: string
  /** Click handler — tile renders as a button when set (takes precedence over href). */
  onClick?: () => void
  /** Forwarded ref for focus-return after a modal closes. */
  buttonRef?: React.RefObject<HTMLButtonElement | null>
  /** Overrides the default aria-label (defaults to `label`). */
  ariaLabel?: string
  tone?: SparklineTone
  urgent?: boolean
  inverted?: boolean
}

export interface CockpitInicioProps {
  role: CockpitRole
  name: string
  companyName?: string
  /** 4 hero KPI tiles, role-shaped. */
  heroKPIs: CockpitHeroKPI[]
  /** Per-nav-tile counts + 7-day series (sparkline). */
  navCounts: NavCounts
  /** Role-specific content rendered in the main column below the nav grid. */
  estadoSections?: ReactNode
  /** Feed already filtered to the right scope by the caller. Deprecated — use actividadSlot. */
  actividad?: TimelineItem[]
  /** Empty-state label for the actividad feed. Deprecated — use actividadSlot. */
  actividadEmptyLabel?: string
  /** Free-form activity renderer for the right rail. v9 canonical. */
  actividadSlot?: ReactNode
  /** v10 — horizontal activity strip rendered above the hero KPIs. */
  actividadStripSlot?: ReactNode
  /** Sync freshness signal rendered between the activity strip and the
   *  hero KPIs. Typically a `<FreshnessBanner />` fed by the server
   *  `readFreshness()` helper. Null when the caller opts out. */
  freshnessSlot?: ReactNode
  /** v10 — capability cards row (Checklist / Clasificador / Mensajes) between nav and main. */
  capabilitySlot?: ReactNode
  /** Optional system-wide status dot next to the greeting. */
  systemStatus?: SystemStatus
  /** True → status dot pulses (work in motion). False → solid (at rest). */
  pulseSignal?: boolean
  /** Short summary line right under the h1 greeting. */
  summaryLine?: string
  /** Render a live timestamp under the summary line. Default: true. */
  liveTimestamp?: boolean
  /** Role-aware meta pills rendered in CockpitBanner. */
  metaPills?: Array<{ label: string; value: string | number; tone?: 'silver' | 'warning' }>
  /** YYYY-MM — when present, nav tile hrefs include ?month=YYYY-MM so drill-downs
   *  inherit the dashboard's selected month. */
  month?: string
}

/**
 * CRUZ v7 — the canonical cockpit composition. Three role views, one layout.
 *
 * Renders (top → bottom):
 *  - PageShell (dark cockpit canvas)
 *  - CockpitBanner (role-aware brand + meta)
 *  - Greeting h1 + summary + LiveTimestamp
 *  - Hero KPI strip (4 tiles)
 *  - UNIFIED_NAV_TILES grid (6 cards, trend sparklines)
 *  - 2-col main: estadoSections (left) + Actividad reciente (right rail)
 *
 * Consumers:
 *  - /inicio           → role="client"  (invariant 24: no deltas, no severity)
 *  - /operador/inicio  → role="operator"
 *  - /admin/eagle      → role="owner"
 */
export function CockpitInicio({
  role, name, companyName,
  heroKPIs, navCounts, estadoSections, actividad,
  actividadEmptyLabel = 'Sin actividad reciente.',
  actividadSlot, actividadStripSlot, freshnessSlot, capabilitySlot,
  systemStatus, pulseSignal, summaryLine, liveTimestamp = true,
  metaPills, month,
}: CockpitInicioProps) {
  // Strip Mexican legal suffixes + title-case for the header. The full
  // legal shape "EVCO PLASTICS DE MEXICO, S.DE R.L.DE C.V." wrapped to
  // three lines on 393px mobile (2026-04-20 audit). Canonical helper
  // lives in lib/format/company-name so the same cleaning applies in
  // TopBar, greeting, and any other client-chrome surface.
  const cleanCompany = cleanCompanyDisplayName(companyName) || 'Portal del cliente'
  const greetingTitle =
    role === 'client' ? cleanCompany
    : `${greetingFor(role)}, ${name}`

  const monthQuery = month ? `?month=${encodeURIComponent(month)}` : ''
  const withMonth = (href: string | undefined): string | undefined => {
    if (!href) return href
    if (!month) return href
    return href.includes('?') ? `${href}&month=${encodeURIComponent(month)}` : `${href}?month=${encodeURIComponent(month)}`
  }
  const navItems: NavCardGridItem[] = UNIFIED_NAV_TILES.map((tile) => {
    const cell = navCounts[tile.key as NavTileKey]
    return {
      tile: {
        href: withMonth(tile.href) ?? tile.href,
        label: tile.label,
        icon: tile.icon,
        description: tile.description,
      },
      count: cell?.count ?? null,
      countSuffix: cell?.countSuffix,
      microStatus: cell?.microStatus,
      microStatusWarning: cell?.microStatusWarning,
      historicMicrocopy: cell?.historicMicrocopy,
      trendData: cell?.series && cell.series.length > 7 ? cell.series.slice(-7) : cell?.series,
      trendTone: 'silver',
    }
  })

  return (
    <PageShell
      title={greetingTitle}
      subtitle={summaryLine}
      systemStatus={systemStatus}
      pulseSignal={pulseSignal}
      liveTimestamp={liveTimestamp}
      brandHeader={<CockpitBanner role={role} name={name} companyName={companyName} metaPills={metaPills} />}
    >
      {/* v10 — ActividadStrip rendered above hero when provided */}
      {actividadStripSlot}

      {/* Sync freshness — "Sincronizado hace N min" under the strip, or a
          calm amber banner when data is stale. Renders nothing for
          pre-activation tenants (helper returns `hasData: false`). */}
      {freshnessSlot}

      {/* Hero KPI strip */}
      <div
        className="aguila-cockpit-hero"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 'var(--aguila-gap-card, 16px)',
          marginBottom: 'var(--aguila-gap-card, 16px)',
        }}
      >
        <style>{`
          /* Force grid children to respect 1fr instead of expanding to
             content width. Without min-width: 0 a KPI tile with a long
             value ("hace 2 días") overflows its column on mobile, making
             the sibling tile appear narrower and its content truncate
             (2026-04-20 screenshot audit). */
          .aguila-cockpit-hero > * { min-width: 0; }
          @media (max-width: 1024px) {
            .aguila-cockpit-hero { grid-template-columns: repeat(2, 1fr) !important; }
          }
        `}</style>
        {heroKPIs.slice(0, 4).map((k) => (
          <KPITile
            key={k.key}
            label={k.label}
            value={k.value}
            sublabel={k.sublabel}
            series={k.series}
            current={k.current}
            previous={k.previous}
            href={k.onClick ? undefined : withMonth(k.href)}
            onClick={k.onClick}
            buttonRef={k.buttonRef}
            ariaLabel={k.ariaLabel}
            tone={k.tone ?? 'silver'}
            urgent={k.urgent}
            inverted={k.inverted}
          />
        ))}
      </div>

      {/* Unified nav grid — same 6 cards for every role */}
      <div style={{ marginBottom: 'var(--aguila-gap-card, 16px)' }}>
        <NavCardGrid items={navItems} />
      </div>

      {/* v10 — Capability cards row (Checklist · Clasificador · Mensajes) */}
      {capabilitySlot ? (
        <div style={{ marginBottom: 'var(--aguila-gap-card, 16px)' }}>
          {capabilitySlot}
        </div>
      ) : null}

      {/* 2-col main: estadoSections + actividad. Skipped entirely when the
          caller omits both — client surface uses this to stay calm. */}
      {(estadoSections || actividadSlot || (actividad && actividad.length > 0)) && (
      <div
        className="aguila-cockpit-main"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 'var(--aguila-gap-card, 16px)',
          alignItems: 'flex-start',
        }}
      >
        <style>{`
          @media (max-width: 1024px) {
            .aguila-cockpit-main { grid-template-columns: 1fr !important; }
          }
        `}</style>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--aguila-gap-card, 16px)' }}>
          {estadoSections}
        </div>
        <aside>
          <PortalCard padding={'16px 20px'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Activity size={14} color={ACCENT_SILVER} />
              <span
                className="portal-eyebrow"
                style={{ letterSpacing: '0.18em' }}
              >
                Actividad reciente
              </span>
              {actividad && actividad.length > 0 && (
                <span aria-hidden className="portal-pulse" style={{ marginLeft: 4 }} />
              )}
            </div>
            {actividadSlot ?? (
              <TimelineFeed items={actividad ?? []} max={8} emptyLabel={actividadEmptyLabel} />
            )}
          </PortalCard>
        </aside>
      </div>
      )}
    </PageShell>
  )
}

function greetingFor(role: CockpitRole): string {
  const h = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false })
  const hour = Number(h)
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}
