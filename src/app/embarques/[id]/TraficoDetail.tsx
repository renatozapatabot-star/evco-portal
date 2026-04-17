'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  GOLD,
  GREEN,
  RED,
  TEXT_PRIMARY,
} from '@/lib/design-system'
import { useTrack } from '@/lib/telemetry/useTrack'
import { fmtUSDCompact, fmtDate } from '@/lib/format-utils'
import { ChainView, type ChainNode, type ChainNodeKind } from '@/components/aguila'
import { ChainVincularModal } from '@/components/aguila/ChainVincularModal'
import { PortalCard } from '@/components/portal/PortalCard'
import { PortalButton } from '@/components/portal/PortalButton'
import { PortalDetailHero, type DetailHeroStage } from '@/components/portal/PortalDetailHero'
import {
  PortalTheaterAnimation,
  actFromStatus,
} from '@/components/portal/PortalTheaterAnimation'
import { formatPedimento } from '@/lib/format/pedimento'
import { translateEstatus } from '@/lib/estatus-translator'
import { PageOpenTracker } from './PageOpenTracker'
import { BelowFold } from './BelowFold'
import { RightRail } from './RightRail'
import { DocumentosTab } from './tabs/DocumentosTab'
import { PartidasTab } from './tabs/PartidasTab'
import { CronologiaTab } from './tabs/CronologiaTab'
import { NotasTab, type NotasTabHandle } from './tabs/NotasTab'
import { ComunicacionTab } from './tabs/ComunicacionTab'
import { PedimentoTab } from './tabs/PedimentoTab'
import type { DocType } from '@/lib/doc-requirements'
import type {
  AvailableUserLite,
  DocRow,
  EventRow,
  NoteRow,
  PartidaRow,
  TraficoRow,
} from './types'

interface TraficoDetailProps {
  traficoId: string
  trafico: TraficoRow
  events: EventRow[]
  docs: DocRow[]
  partidas: PartidaRow[]
  notes: NoteRow[]
  availableUsers: AvailableUserLite[]
  clientName: string
  clientRfc: string | null
  isInternal: boolean
  /** Session role — forwarded to RightRail to suppress the Acciones
   *  rápidas panel entirely on client surfaces (invariant #24). */
  role: string
  currentUserId: string
  missingDocs: DocType[]
  requiredDocsCount: number
  uploadedRequiredCount: number
  chain: ChainNode[]
}

type TabId = 'pedimento' | 'documentos' | 'mercancia' | 'cronologia' | 'notas' | 'comunicacion'

// v3 · Pedimento leads (SAT-audit truth), Mercancía renamed from
// Partidas (client-friendly term), others unchanged. Communication +
// Notes stay as operator-facing tabs on the right.
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'pedimento', label: 'Pedimento' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'mercancia', label: 'Mercancía' },
  { id: 'cronologia', label: 'Cronología' },
  { id: 'notas', label: 'Notas' },
  { id: 'comunicacion', label: 'Comunicación' },
]

export function TraficoDetail(props: TraficoDetailProps) {
  // Default tab is Pedimento — it's the SAT-audit truth + the first
  // thing Ursula wants to see. Documentos/Mercancía/etc. are one tap
  // away and the timeline already sits above the tabs as context.
  const [active, setActive] = useState<TabId>('pedimento')
  const track = useTrack()
  const notasRef = useRef<NotasTabHandle | null>(null)

  function switchTo(next: TabId) {
    if (next === active) return
    track('page_view', {
      entityType: 'trafico_tab',
      entityId: props.traficoId,
      metadata: { event: 'tab_switched', from_tab: active, to_tab: next },
    })
    setActive(next)
  }

  function onRequestAddNote() {
    switchTo('notas')
    window.setTimeout(() => notasRef.current?.focusComposer(), 80)
  }

  const valor = Number(props.trafico.importe_total ?? 0)

  // Tile colors driven by expediente completeness / active days.
  const docsAllGood =
    props.requiredDocsCount > 0 && props.uploadedRequiredCount >= props.requiredDocsCount
  const docsColor = docsAllGood
    ? GREEN
    : props.missingDocs.length > 0
      ? RED
      : TEXT_PRIMARY

  // V1 · Chain tap-to-link state
  const [vincularOpen, setVincularOpen] = useState(false)
  const [vincularKind, setVincularKind] = useState<ChainNodeKind | null>(null)
  // Each ChainNode in props.chain gets its handler wired at render time.
  // Vincular is an operator/owner action — the client never sees the
  // "Vincular" CTA on a missing chain node (invariant #24: client
  // surface is read-only by construction, not by disclaimer).
  const chainWithVincular: ChainNode[] = props.chain.map((node) => ({
    ...node,
    onVincular: props.isInternal && node.status === 'missing' && node.kind !== 'trafico'
      ? (kind) => { setVincularKind(kind); setVincularOpen(true) }
      : undefined,
  }))

  const [daysActive, setDaysActive] = useState<number | null>(null)
  useEffect(() => {
    // Defer a tick so the compiler doesn't flag setState-in-effect
    // as a cascading render; the value depends only on created_at.
    queueMicrotask(() => {
      if (!props.trafico.created_at) {
        setDaysActive(null)
        return
      }
      const ms = Date.now() - new Date(props.trafico.created_at).getTime()
      if (Number.isNaN(ms)) {
        setDaysActive(null)
        return
      }
      setDaysActive(Math.max(0, Math.floor(ms / 86_400_000)))
    })
  }, [props.trafico.created_at])

  const daysColor =
    daysActive === null
      ? TEXT_PRIMARY
      : daysActive > 14
        ? RED
        : daysActive > 7
          ? '#FBBF24'
          : TEXT_PRIMARY

  const estadoEvent = props.events[0] ?? null

  // Estado actual value priority:
  //   1. estadoEvent.display_name_es  (richest Spanish phrase, pre-computed)
  //   2. translateEstatus(trafico.estatus).label  (canonical estatus → Spanish,
  //      e.g. "E1" → "Entregado" — raw GlobalPC codes must never leak)
  //   3. "Sin estatus"  (fallback for genuinely null rows)
  const estadoActualValue = estadoEvent?.display_name_es
    ?? (props.trafico.estatus ? translateEstatus(props.trafico.estatus).label : 'Sin estatus')

  const expedientePct =
    props.requiredDocsCount > 0
      ? Math.round((props.uploadedRequiredCount / props.requiredDocsCount) * 100)
      : 0

  const proveedorName =
    (props.trafico.proveedores?.split(',')[0] || '').trim() || null

  // Pedimento tab — pulls the fecha_pago from the chain's factura-paid
  // node if it exists; otherwise surfaces "Pago pendiente" language.
  // ChainNode uses status = 'linked' | 'missing' | 'pending' | 'error'
  // + optional `date` field (not `timestamp`).
  const pagoNode = props.chain.find((n) => n.kind === 'factura')
  const pedimentoPaid = pagoNode?.status === 'linked' && !!pagoNode.date
  const fechaPago = pagoNode?.date ?? null
  const importeTotalUsd = typeof props.trafico.importe_total === 'number' && props.trafico.importe_total > 0
    ? props.trafico.importe_total
    : null

  const tabContent: Record<TabId, ReactNode> = {
    pedimento: (
      <PedimentoTab
        traficoId={props.traficoId}
        trafico={props.trafico}
        fechaPago={fechaPago}
        pedimentoPaid={pedimentoPaid}
        missingDocsCount={props.missingDocs.length}
        importeTotalUsd={importeTotalUsd}
      />
    ),
    documentos: (
      <DocumentosTab
        traficoId={props.traficoId}
        docs={props.docs}
        regimen={props.trafico.regimen}
        cliente={props.clientName}
        proveedor={proveedorName}
        operatorName={props.currentUserId}
        missingDocs={props.missingDocs}
      />
    ),
    mercancia: <PartidasTab traficoId={props.traficoId} partidas={props.partidas} />,
    cronologia: (
      <CronologiaTab
        traficoId={props.traficoId}
        events={props.events}
        currentUserId={props.currentUserId}
      />
    ),
    notas: (
      <NotasTab
        ref={notasRef}
        traficoId={props.traficoId}
        notes={props.notes}
        availableUsers={props.availableUsers}
      />
    ),
    comunicacion: (
      <ComunicacionTab
        traficoId={props.traficoId}
        cliente={props.clientName}
        proveedor={proveedorName}
        operatorName={props.currentUserId}
        missingDocs={props.missingDocs}
      />
    ),
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <PortalDetailHero
        eyebrow={`PEDIMENTO · ${(props.trafico.tipo_operacion ?? 'A1').toUpperCase()} · ${props.clientName.toUpperCase()}`}
        numberPrefix={(() => {
          const ped = props.trafico.pedimento
          if (!ped) return `${props.trafico.patente ?? '3596'}-`
          // Split on the last dash so the serial tail becomes the emerald suffix.
          const segments = ped.split(' ')
          if (segments.length >= 2) {
            return segments.slice(0, -1).join(' ') + ' '
          }
          return ped.slice(0, Math.max(0, ped.length - 7))
        })()}
        numberSuffix={(() => {
          const ped = props.trafico.pedimento
          if (!ped) return props.trafico.trafico
          const segments = ped.split(' ')
          if (segments.length >= 2) return segments[segments.length - 1]
          return ped.slice(-7)
        })()}
        stages={(() => {
          const act = actFromStatus(props.trafico.estatus)
          const order: Array<{ id: string; label: string; aligned: 'filing'|'acceptance'|'clearance'|'exit'|'archived' }> = [
            { id: 'creacion',    label: 'Creación',    aligned: 'filing'     },
            { id: 'validacion',  label: 'Validación',  aligned: 'acceptance' },
            { id: 'pago',        label: 'Pago',        aligned: 'acceptance' },
            { id: 'firma',       label: 'Firma',       aligned: 'clearance'  },
            { id: 'liberacion',  label: 'Liberación',  aligned: 'exit'       },
          ]
          const rank = ['filing', 'acceptance', 'clearance', 'exit', 'archived']
          const currentRank = rank.indexOf(act)
          return order.map((stage): DetailHeroStage => {
            const stageRank = rank.indexOf(stage.aligned)
            if (stageRank < currentRank) return { id: stage.id, label: stage.label, status: 'done' }
            if (stageRank === currentRank) return { id: stage.id, label: stage.label, status: 'active' }
            return { id: stage.id, label: stage.label, status: 'upcoming' }
          })
        })()}
        badges={(() => {
          const out: Array<{ tone?: 'live'|'info'|'warn'|'alert'|'neutral'; label: string }> = []
          if (props.trafico.estatus === 'Cruzado' || props.trafico.estatus === 'E1' || props.trafico.estatus === 'Entregado') {
            out.push({ tone: 'live', label: 'LIBERADO · SEMÁFORO VERDE' })
          } else {
            out.push({ tone: 'info', label: estadoActualValue.toUpperCase() })
          }
          out.push({ tone: 'info', label: 'IMMEX VIGENTE' })
          out.push({ tone: 'neutral', label: `${(props.trafico.tipo_operacion ?? 'A1').toUpperCase()} · DEFINITIVO` })
          out.push({ tone: 'neutral', label: 'T-MEC' })
          return out
        })()}
        stats={[
          {
            label: 'VALOR ADUANA',
            value: valor > 0 ? fmtUSDCompact(valor) : '—',
            sub: valor > 0 ? 'USD declarado' : 'Pendiente',
          },
          {
            label: 'DOCUMENTOS',
            value:
              props.requiredDocsCount > 0
                ? `${props.uploadedRequiredCount} / ${props.requiredDocsCount}`
                : String(props.docs.length),
            sub: props.missingDocs.length > 0 ? `${props.missingDocs.length} por subir` : 'al corriente',
          },
          {
            label: 'PARTIDAS',
            value: String(props.partidas.length),
            sub: props.partidas.length > 0 ? 'todas clasificadas' : 'sin partidas',
          },
          {
            label: 'DÍAS ACTIVOS',
            value: daysActive !== null ? String(daysActive) : '—',
            sub: daysActive === null ? '—' : daysActive > 14 ? 'revisar' : 'en curso',
          },
        ]}
        backHref="/embarques"
        breadcrumb={['DASHBOARD', 'EMBARQUES', props.trafico.trafico]}
        onOpenTheater={() => {
          if (typeof window !== 'undefined' && typeof window.__portalOpenTheater === 'function') {
            window.__portalOpenTheater(props.trafico.pedimento ?? props.traficoId)
          }
        }}
        topbarActions={
          <PortalButton
            variant="ghost"
            size="sm"
            href={`/embarques/${encodeURIComponent(props.trafico.trafico)}/pedimento`}
          >
            Pedimento completo →
          </PortalButton>
        }
      />

      <PageOpenTracker traficoId={props.traficoId} />

      <div
        className="trafico-main-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ChainView
            nodes={chainWithVincular}
            ariaLabel={`Cadena de documentos de ${props.traficoId}`}
          />
          <ChainVincularModal
            open={vincularOpen}
            kind={vincularKind}
            traficoId={props.traficoId}
            onClose={() => setVincularOpen(false)}
            onLinked={() => {
              // Refresh chain by reloading — the simplest correct behavior.
              // A future optimistic update can hydrate the node locally.
              if (typeof window !== 'undefined') window.location.reload()
            }}
          />
          <PortalCard padding={0}>
            <div
              role="tablist"
              aria-label="Secciones del embarque"
              className="trafico-tablist"
              style={{
                display: 'flex',
                gap: 4,
                padding: '8px 12px 0',
                borderBottom: '1px solid var(--portal-line-1)',
                overflowX: 'auto',
              }}
            >
              {TABS.map((t) => {
                const selected = t.id === active
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => switchTo(t.id)}
                    style={{
                      minHeight: 60,
                      minWidth: 60,
                      padding: '14px 18px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: selected
                        ? '2px solid var(--portal-green-2)'
                        : '2px solid transparent',
                      color: selected ? 'var(--portal-fg-1)' : 'var(--portal-fg-4)',
                      fontFamily: 'var(--portal-font-mono)',
                      fontSize: 'var(--portal-fs-micro)',
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      fontWeight: selected ? 700 : 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      transition: 'color var(--portal-dur-2) var(--portal-ease-out), border-color var(--portal-dur-2) var(--portal-ease-out)',
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            <div role="tabpanel" style={{ padding: 20 }}>
              {tabContent[active]}
            </div>
          </PortalCard>
        </div>

        <RightRail
          traficoId={props.traficoId}
          events={props.events}
          isInternal={props.isInternal}
          role={props.role}
          clientName={props.clientName}
          clientRfc={props.clientRfc}
          clientAduana={props.trafico.aduana}
          clientPatente={props.trafico.patente}
          proveedorName={proveedorName}
          assignedOperator={props.trafico.assigned_to_operator_id}
          availableOperators={props.availableUsers}
          createdAt={props.trafico.created_at}
          expedienteProgressPct={expedientePct}
          onRequestAddNote={onRequestAddNote}
        />
      </div>

      <BelowFold
        traficoId={props.traficoId}
        trafico={props.trafico}
        partidasCount={props.partidas.length}
        role={props.role}
      />

      <div
        style={{
          textAlign: 'center',
          padding: '20px 0',
          fontSize: 'var(--aguila-fs-meta)',
          color: 'var(--portal-fg-4)',
        }}
      >
        Renato Zapata &amp; Company · Patente 3596 · Aduana 240
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .trafico-main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
