'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import type { CockpitHeroKPI, ActividadStripItem } from '@/components/aguila'
import { TimelineModal } from '@/components/cockpit/client/TimelineModal'
import { MorningBriefing, type MorningBriefingData } from '@/components/cockpit/client/MorningBriefing'
import { PortalDashboard, type PortalTickerItem } from '@/components/portal'
import type { ActiveShipment } from '@/components/cockpit/client/ActiveShipmentTimeline'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'
import type { CapabilityCounts } from '@/lib/cockpit/capabilities'
import { cleanCompanyDisplayName } from '@/lib/format/company-name'

/** Pre-encoded once — `/cruz` reads `?hello=` as the first agent message
 *  shown to the user when they land. Keeps the greeting a single sentence,
 *  calm, invitation-toned. Matches `DEFAULT_HELLO.client` in AsistenteButton
 *  so the in-content link and the floating button land on the same opening. */
const ASK_AGENT_HREF =
  '/cruz?ctx=client&hello=' +
  encodeURIComponent('¿En qué te puedo apoyar hoy?')
// AguilaFooter is rendered by PortalDashboard itself (Cluster F ·
// 2026-04-28). The previous shell-level fallback was racy; per-page
// ownership is the deterministic fix.

/**
 * Client-side shell for /inicio. Mounts the Próximo-cruce modal
 * (opened from the first KPI tile in the legacy surface; now folded into
 * the greeting summary copy + theater) and the MorningBriefing banner.
 *
 * Renders the 2026-04-17 reference PortalDashboard composition — 6
 * module cards with bespoke vizzes + TopBar + greeting + floating
 * Agente IA. The legacy CockpitInicio has been retired from /inicio
 * per user approval (plan: `.claude/plans/mellow-yawning-papert.md`).
 */

export interface InicioClientShellProps {
  role: 'client'
  name: string
  companyName: string
  heroKPIs: CockpitHeroKPI[]
  navCounts: NavCounts
  actividadStripItems: ActividadStripItem[]
  capabilityCounts: CapabilityCounts
  summaryLine?: string
  pulseSignal?: boolean
  month?: string
  metaPills?: Array<{ label: string; value: string | number; tone?: 'silver' | 'warning' }>
  imminentShipment: ActiveShipment | null
  morningBriefing: MorningBriefingData | null
  freshnessSlot?: React.ReactNode
  tickerItems?: PortalTickerItem[]
}

export function InicioClientShell({
  role: _role,
  name,
  companyName,
  heroKPIs,
  navCounts,
  actividadStripItems: _actividadStripItems,
  capabilityCounts: _capabilityCounts,
  summaryLine,
  pulseSignal: _pulseSignal,
  month,
  metaPills: _metaPills,
  imminentShipment,
  morningBriefing,
  freshnessSlot,
  tickerItems,
}: InicioClientShellProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const kpiButtonRef = useRef<HTMLButtonElement | null>(null)

  const displayName = cleanCompanyDisplayName(companyName) || companyName
  const firstToken = displayName.split(/[\s,·]/).find((t) => t.length > 0) || name || 'Bienvenida'

  // Pull a concise line out of heroKPIs[0] if the page passed a "Próximo
  // cruce" signal — retains the existing "tap for timeline" pattern by
  // surfacing a button in the summary.
  const proximoCruce = heroKPIs[0]
  const hasImminent = imminentShipment != null

  const summary = summaryLine ? (
    <>
      {summaryLine}
      {hasImminent && proximoCruce && (
        <>
          {' · '}
          <button
            ref={kpiButtonRef}
            onClick={() => setModalOpen(true)}
            style={{
              background: 'transparent',
              border: 0,
              padding: 0,
              color: 'var(--portal-green-2)',
              textDecoration: 'underline',
              textDecorationColor: 'var(--portal-green-5)',
              textUnderlineOffset: '3px',
              cursor: 'pointer',
              font: 'inherit',
            }}
            aria-label="Ver próximo cruce"
          >
            {proximoCruce.label?.toLowerCase() ?? 'próximo cruce'} ·{' '}
            <span className="portal-num">{proximoCruce.value}</span>
          </button>
        </>
      )}
      {/* Demo-polish 2026-04-22 — in-content invitation to the agent
          chat. Matches the styling of the tasa-de-éxito / próximo-cruce
          button above so it reads as a first-class summary element.
          Floating AsistenteButton remains bottom-right; this gives
          Ursula a hero-level entry point the moment she lands. */}
      {' · '}
      <Link
        href={ASK_AGENT_HREF}
        style={{
          color: 'var(--portal-green-2)',
          textDecoration: 'underline',
          textDecorationColor: 'var(--portal-green-5)',
          textUnderlineOffset: '3px',
          font: 'inherit',
        }}
        aria-label="Hablar con el agente IA del portal"
      >
        pregúntale al agente →
      </Link>
    </>
  ) : undefined

  const openTheater = () => {
    if (typeof window !== 'undefined' && typeof window.__portalOpenTheater === 'function') {
      window.__portalOpenTheater('latest')
    }
  }

  return (
    <>
      <PortalDashboard
        role="client"
        greetingName={firstToken}
        companyName={displayName}
        summary={summary}
        navCounts={navCounts}
        month={month}
        onOpenTheater={openTheater}
        tickerItems={tickerItems}
        freshnessSlot={
          <>
            <MorningBriefing briefing={morningBriefing} />
            {freshnessSlot}
          </>
        }
      />
      <TimelineModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        shipment={imminentShipment}
        returnFocusRef={kpiButtonRef}
      />
    </>
  )
}

// Global augmentation so callers can invoke the theater without
// coupling to the component file. Defined by PortalPedimentoTheater in
// Phase 5 (mounted once in app/layout.tsx).
declare global {
  interface Window {
    __portalOpenTheater?: (pedimentoId: string) => void
  }
}
