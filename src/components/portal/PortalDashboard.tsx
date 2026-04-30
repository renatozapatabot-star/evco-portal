'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Truck, FileText, FolderOpen, Book, Package, ClipboardList, Receipt } from 'lucide-react'
import { PortalTopBar } from './PortalTopBar'
import { PortalGreeting } from './PortalGreeting'
import { PortalModuleCard } from './PortalModuleCard'
import { PortalAssistantFab } from './PortalAssistantFab'
import { PortalCommandPalette } from './PortalCommandPalette'
import { PortalWorldMesh } from './PortalWorldMesh'
import { PortalTicker } from './PortalTicker'
import type { PortalTickerItem } from './PortalTicker'
import { useCmdK } from '@/hooks/useCmdK'
import {
  VizPulse,
  VizPedimentoLedger,
  VizDocs,
  VizCatalog,
  VizWarehouseDock,
  VizDonut,
} from './viz'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'

export type PortalDashboardRole = 'client' | 'operator' | 'owner'

export interface PortalDashboardProps {
  role: PortalDashboardRole
  /** First name shown in emerald inside the greeting. */
  greetingName: string
  /** Optional summary node under the greeting. Mix numbers + copy. */
  summary?: ReactNode
  /** Locked 6-tile counts/series. Feeds module card metrics + microStatus. */
  navCounts: NavCounts
  /** YYYY-MM query param for month-aware drill-down hrefs. */
  month?: string
  /** Called when Pedimentos card clicked. Typically opens the theater. */
  onOpenTheater?: () => void
  /** Called when Agent FAB / Cmd+K trigger. */
  onOpenCmd?: () => void
  onLogout?: () => void
  /** Optional PORTAL ticker above the greeting (rates/bridges/etc.). */
  tickerItems?: PortalTickerItem[]
  /** Rendered above the greeting, below the ticker. Freshness banner etc. */
  freshnessSlot?: ReactNode
  /** Free slot below the modules grid (owner uses this for custom tiles). */
  extraRow?: ReactNode
  /** Optional last-cross event for TopBar toast. */
  lastCross?: { id: string; label: string; ts: string } | null
  /** Company name for clients; shown as metadata in TopBar if provided. */
  companyName?: string
}

const ICON_SIZE = 15

/**
 * First-message greeting the agent shows when the FAB opens /cruz.
 * Mirrors `DEFAULT_HELLO` in `src/components/aguila/AsistenteButton.tsx`
 * so the in-content "pregúntale al agente" link and this FAB land on
 * the same greeting. Role-keyed.
 */
const AGENT_HELLO: Record<PortalDashboardRole, string> = {
  client: '¿En qué te puedo apoyar hoy?',
  operator: 'Listo para ayudar con el flujo operativo. ¿Qué necesitas?',
  owner: 'Vista ejecutiva lista. ¿Qué necesitas revisar?',
}

function buildAgentHref(role: PortalDashboardRole): string {
  const params = new URLSearchParams({ ctx: role, hello: AGENT_HELLO[role] })
  return `/cruz?${params.toString()}`
}

function attachMonth(href: string, month?: string): string {
  if (!month) return href
  return href.includes('?') ? `${href}&month=${encodeURIComponent(month)}` : `${href}?month=${encodeURIComponent(month)}`
}

function fmt(count: number | null, fallback = '—'): string {
  if (count === null || count === undefined) return fallback
  return count.toLocaleString('es-MX')
}

/**
 * PORTAL reference dashboard — the 2026-04-17 handoff composition.
 *
 * Ink-0 canvas with animated world-mesh background, sticky TopBar
 * (pulse + PORTAL wordmark + Cmd+K trigger + live badge), warm
 * greeting with emerald first-name, 6 module cards in 3/2/1 responsive
 * grid (each with its own bespoke viz), floating Agente IA fab, Cmd+K
 * command palette.
 *
 * Role-aware: same composition for client / operator / owner; data
 * shape of navCounts decides the metric. Client surface keeps invariant
 * #24 (no delta / severity indicators) — module cards never render
 * those per se.
 *
 * Replaces the legacy `<CockpitInicio>` composition per the 2026-04-17
 * user-approved override of invariant #30 (plan file:
 * `.claude/plans/mellow-yawning-papert.md`).
 */
export function PortalDashboard({
  role,
  greetingName,
  summary,
  navCounts,
  month,
  onOpenTheater,
  onOpenCmd: onOpenCmdProp,
  onLogout,
  tickerItems,
  freshnessSlot,
  extraRow,
  lastCross,
  companyName,
}: PortalDashboardProps) {
  const [cmdOpen, setCmdOpen] = useState(false)

  const openCmd = () => {
    if (onOpenCmdProp) onOpenCmdProp()
    else setCmdOpen(true)
  }
  const closeCmd = () => setCmdOpen(false)

  useCmdK(openCmd, closeCmd)

  // onOpenTheater retained in the prop signature for back-compat callers
  // but no longer wired — tile 2 is now a direct-nav Contabilidad card.
  void onOpenTheater

  // Prefer the role-aware description but keep the 6 cards identical in
  // order, icon, label (invariant #29). Clients see warm copy; operator
  // + owner see terser ops copy.
  const isClient = role === 'client'

  const navHref = (k: keyof NavCounts, defaultHref: string) => attachMonth(defaultHref, month)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--portal-ink-0)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <PortalWorldMesh opacity={0.04} />
      <PortalTopBar
        onOpenCmd={openCmd}
        onLogout={onLogout}
        lastCross={lastCross}
        searchPlaceholder={
          isClient
            ? 'Buscar pedimento, embarque, expediente… o pregúntale al Agente'
            : 'Buscar SKU, pedimento, embarque, Anexo 24…'
        }
      />

      <main
        style={{
          padding: '0 clamp(16px, 4vw, 32px) var(--portal-s-11)',
          maxWidth: 'var(--portal-maxw)',
          margin: '0 auto',
          width: '100%',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {tickerItems && tickerItems.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <PortalTicker items={tickerItems} />
          </div>
        )}

        {freshnessSlot}

        <PortalGreeting name={greetingName} summary={summary} />

        <div className="portal-modules-grid">
          {/* 1. Tráficos / Embarques */}
          <PortalModuleCard
            icon={<Truck size={ICON_SIZE} />}
            title="Embarques"
            desc={
              isClient
                ? navCounts.traficos?.microStatus ??
                  'Tus unidades en tránsito y cruces programados esta semana.'
                : 'Operaciones activas y cruces en curso.'
            }
            badge={
              (navCounts.traficos?.count ?? 0) > 0
                ? {
                    tone: 'live',
                    label: `${navCounts.traficos?.count} en tránsito`.toUpperCase(),
                  }
                : undefined
            }
            viz={
              <VizPulse
                items={[
                  { t: 'Unidad activa', v: navCounts.traficos?.count ? 'en ruta' : '—', live: true },
                  { t: 'Último cruce', v: navCounts.traficos?.microStatus ?? '—', live: false },
                ]}
              />
            }
            metric={fmt(navCounts.traficos?.count ?? null, '0')}
            metricLabel="ACTIVOS"
            href={navHref('traficos', '/embarques')}
            accent
            ariaLabel="Ir a Embarques"
          />

          {/* 2. Contabilidad (2026-04-19 founder-override — was Pedimentos).
               Client → /mi-cuenta (own A/R, ethical contract in
               .claude/rules/client-accounting-ethics.md). Broker/operator →
               /contabilidad/inicio (Anabel's cockpit). For clients, gated
               by NEXT_PUBLIC_MI_CUENTA_ENABLED — when OFF, tile renders
               AS the old Pedimentos card so Ursula's experience is
               preserved until Tito flips the flag post-walkthrough. */}
          {(() => {
            const miCuentaEnabled = process.env.NEXT_PUBLIC_MI_CUENTA_ENABLED === 'true'
            const clientFallback = isClient && !miCuentaEnabled
            return clientFallback ? (
              <PortalModuleCard
                icon={<FileText size={ICON_SIZE} />}
                title="Pedimentos"
                desc={
                  navCounts.pedimentos?.microStatus ??
                  'Declaraciones aduanales firmadas este mes.'
                }
                badge={
                  navCounts.pedimentos?.count
                    ? { tone: 'info', label: `${navCounts.pedimentos.count} MES` }
                    : undefined
                }
                viz={<VizPedimentoLedger />}
                metric={fmt(navCounts.pedimentos?.count ?? null, '0')}
                metricLabel="ESTE MES"
                href={navHref('pedimentos', '/pedimentos')}
                accent
                ariaLabel="Ir a Pedimentos"
              />
            ) : (
              <PortalModuleCard
                icon={<Receipt size={ICON_SIZE} />}
                title="Contabilidad"
                desc={
                  isClient
                    ? navCounts.contabilidad?.microStatus ??
                      'Tu saldo, facturas del mes, próximos vencimientos.'
                    : 'CxC · CxP · cierre del mes.'
                }
                badge={
                  navCounts.contabilidad?.count
                    ? { tone: 'info', label: `${navCounts.contabilidad.count} ABIERTA${navCounts.contabilidad.count === 1 ? '' : 'S'}` }
                    : undefined
                }
                viz={<VizPedimentoLedger />}
                metric={fmt(navCounts.contabilidad?.count ?? null, '0')}
                metricLabel={isClient ? 'ABIERTAS' : 'CxC ABIERTAS'}
                href={navHref('contabilidad', isClient ? '/mi-cuenta' : '/contabilidad/inicio')}
                accent
                ariaLabel={isClient ? 'Ir a Mi cuenta' : 'Ir a Contabilidad'}
              />
            )
          })()}

          {/* 3. Expedientes */}
          <PortalModuleCard
            icon={<FolderOpen size={ICON_SIZE} />}
            title="Expedientes"
            desc={
              isClient
                ? navCounts.expedientes?.microStatus ??
                  'Carpetas de operación digitales. Firmas electrónicas al día.'
                : 'Expedientes por tráfico.'
            }
            viz={<VizDocs />}
            metric={fmt(navCounts.expedientes?.count ?? null, '0')}
            metricLabel="ESTE MES"
            href={navHref('expedientes', '/expedientes')}
            ariaLabel="Ir a Expedientes"
          />

          {/* 4. Catálogo */}
          <PortalModuleCard
            icon={<Book size={ICON_SIZE} />}
            title="Catálogo"
            desc={
              isClient
                ? navCounts.catalogo?.microStatus ??
                  'Partes, fracciones arancelarias e historial de clasificación IA.'
                : 'Catálogo · clasificación IA.'
            }
            badge={{ tone: 'neutral', label: 'PREVIEW' }}
            viz={<VizCatalog />}
            metric={fmt(navCounts.catalogo?.count ?? null, '—')}
            metricLabel="PARTES VIGENTES"
            href={navHref('catalogo', '/catalogo')}
            ariaLabel="Ir a Catálogo"
          />

          {/* 5. Entradas */}
          <PortalModuleCard
            icon={<Package size={ICON_SIZE} />}
            title="Entradas"
            desc={
              isClient
                ? navCounts.entradas?.microStatus ??
                  'Recibos en almacén Laredo TX.'
                : 'Entradas — almacén.'
            }
            viz={<VizWarehouseDock />}
            metric={fmt(navCounts.entradas?.count ?? null, '0')}
            metricLabel="ESTA SEMANA"
            href={navHref('entradas', '/entradas')}
            ariaLabel="Ir a Entradas"
          />

          {/* 6. Anexo 24 */}
          <PortalModuleCard
            icon={<ClipboardList size={ICON_SIZE} />}
            title="Anexo 24"
            desc={
              isClient
                ? navCounts.anexo24?.microStatus ??
                  'Padrón de SKUs con IMMEX vigente. Todos clasificados al día.'
                : 'Padrón IMMEX · SKUs vigentes.'
            }
            badge={
              navCounts.anexo24?.microStatusWarning
                ? { tone: 'warn', label: navCounts.anexo24.microStatus ?? 'ATENCIÓN' }
                : undefined
            }
            viz={
              <VizDonut greenPct={98.8} redPct={1.2} size={72} label="63% clasificado" />
            }
            metric={fmt(navCounts.anexo24?.count ?? null, '0')}
            metricLabel="SKUs EN ANEXO"
            href={navHref('anexo24', '/anexo-24')}
            ariaLabel="Ir a Anexo 24"
          />
        </div>

        {extraRow}

        {/* Operation footer — Patente line lives in AguilaFooter mounted
            by page-level wrappers; we don't re-render it here. */}
      </main>

      <PortalAssistantFab href={buildAgentHref(role)} />
      <PortalCommandPalette open={cmdOpen} onClose={closeCmd} />
    </div>
  )
}
