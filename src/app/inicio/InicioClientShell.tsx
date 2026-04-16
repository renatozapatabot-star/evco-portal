'use client'

import { useRef, useState } from 'react'
import {
  CockpitInicio,
  ActividadStrip,
  CapabilityCardGrid,
  type CockpitHeroKPI,
  type ActividadStripItem,
} from '@/components/aguila'
import { TimelineModal } from '@/components/cockpit/client/TimelineModal'
import { MorningBriefing, type MorningBriefingData } from '@/components/cockpit/client/MorningBriefing'
import type { ActiveShipment } from '@/components/cockpit/client/ActiveShipmentTimeline'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'
import type { CapabilityCounts } from '@/lib/cockpit/capabilities'

/**
 * InicioClientShell — client-side wrapper for /inicio that mounts the
 * TimelineModal without reintroducing the cockpit's 2-col grid + right-rail
 * "Actividad reciente" that was explicitly removed on 2026-04-16.
 *
 * The "Próximo cruce" hero KPI (always heroKPIs[0]) opens this modal. All
 * other KPIs / nav cards work as before.
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
  /** Server pre-fetched most-imminent tráfico. null = no active shipment → KPI
   *  renders as "Último cruce" variant (non-tappable) and modal never opens. */
  imminentShipment: ActiveShipment | null
  /** Daily CRUZ briefing row. null = no briefing for today (feature
   *  dormant pre-migration, or user dismissed, or cron hasn't fired). */
  morningBriefing: MorningBriefingData | null
}

export function InicioClientShell({
  role, name, companyName,
  heroKPIs, navCounts, actividadStripItems, capabilityCounts,
  summaryLine, pulseSignal, month, metaPills,
  imminentShipment, morningBriefing,
}: InicioClientShellProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const kpiButtonRef = useRef<HTMLButtonElement | null>(null)

  // Attach onClick + ref to heroKPIs[0] only when there IS an imminent
  // shipment. When there isn't, the first KPI stays static (page.tsx will
  // already have set its label to "Último cruce · [fecha]" — no tap
  // surface, no modal).
  const wiredHeroKPIs: CockpitHeroKPI[] = heroKPIs.map((k, i) => {
    if (i !== 0 || !imminentShipment) return k
    return {
      ...k,
      onClick: () => setModalOpen(true),
      buttonRef: kpiButtonRef,
    }
  })

  return (
    <>
      <CockpitInicio
        role={role}
        name={name}
        companyName={companyName}
        heroKPIs={wiredHeroKPIs}
        navCounts={navCounts}
        actividadStripSlot={
          <>
            {/* Morning briefing renders ONLY when the server pre-fetched
                one for today. Otherwise this fragment contributes nothing
                and the ActividadStrip flows up to its usual position. */}
            <MorningBriefing briefing={morningBriefing} />
            <ActividadStrip
              items={actividadStripItems}
              emptyLabel="Tu operación está en calma · Todo en orden"
              title="Últimos mensajes"
            />
          </>
        }
        capabilitySlot={<CapabilityCardGrid counts={capabilityCounts} />}
        summaryLine={summaryLine}
        pulseSignal={pulseSignal}
        month={month}
        metaPills={metaPills}
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
