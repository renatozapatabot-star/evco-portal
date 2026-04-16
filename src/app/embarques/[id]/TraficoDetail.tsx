'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ACCENT_SILVER,
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  GOLD,
  GREEN,
  RED,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '@/lib/design-system'
import { useTrack } from '@/lib/telemetry/useTrack'
import { fmtUSDCompact } from '@/lib/format-utils'
import { ChainView, type ChainNode, type ChainNodeKind } from '@/components/aguila'
import { ChainVincularModal } from '@/components/aguila/ChainVincularModal'
import { translateEstatus } from '@/lib/estatus-translator'
import { PageOpenTracker } from './PageOpenTracker'
import { Header } from './Header'
import { HeroStrip, type HeroTileSpec } from './HeroStrip'
import { BelowFold } from './BelowFold'
import { RightRail } from './RightRail'
import { DocumentosTab } from './tabs/DocumentosTab'
import { PartidasTab } from './tabs/PartidasTab'
import { CronologiaTab } from './tabs/CronologiaTab'
import { NotasTab, type NotasTabHandle } from './tabs/NotasTab'
import { ComunicacionTab } from './tabs/ComunicacionTab'
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

type TabId = 'documentos' | 'partidas' | 'cronologia' | 'notas' | 'comunicacion'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'documentos', label: 'Documentos' },
  { id: 'partidas', label: 'Partidas' },
  { id: 'cronologia', label: 'Cronología' },
  { id: 'notas', label: 'Notas' },
  { id: 'comunicacion', label: 'Comunicación' },
]

export function TraficoDetail(props: TraficoDetailProps) {
  const [active, setActive] = useState<TabId>('documentos')
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

  const heroTiles: HeroTileSpec[] = [
    {
      id: 'estado',
      label: 'Estado actual',
      value: estadoActualValue,
    },
    {
      id: 'dias',
      label: 'Días activos',
      value: daysActive !== null ? String(daysActive) : '—',
      mono: true,
      color: daysColor,
    },
    {
      id: 'documentos',
      label: 'Documentos',
      value:
        props.requiredDocsCount > 0
          ? `${props.uploadedRequiredCount} / ${props.requiredDocsCount}`
          : String(props.docs.length),
      mono: true,
      color: docsColor,
    },
    {
      id: 'valor',
      label: 'Valor declarado',
      value: valor > 0 ? fmtUSDCompact(valor) : '—',
      mono: true,
      color: GOLD,
    },
    {
      id: 'partidas',
      label: 'Partidas',
      value: String(props.partidas.length),
      mono: true,
    },
    {
      id: 'eventos',
      label: 'Eventos',
      value: String(props.events.length),
      mono: true,
      color: ACCENT_SILVER,
      clickable: true,
      hint: props.events.length === 0 ? 'Ninguno aún' : null,
    },
  ]

  const expedientePct =
    props.requiredDocsCount > 0
      ? Math.round((props.uploadedRequiredCount / props.requiredDocsCount) * 100)
      : 0

  const proveedorName =
    (props.trafico.proveedores?.split(',')[0] || '').trim() || null

  const tabContent: Record<TabId, ReactNode> = {
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
    partidas: <PartidasTab traficoId={props.traficoId} partidas={props.partidas} />,
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
    <div style={{ padding: '8px 0', maxWidth: 1400, margin: '0 auto' }}>
      {/* TraficoQuickActions chip strip retired 2026-04-15 per audit —
          Pedimento/DODA/Carta Porte are reachable from the detail tabs + chain. */}
      <PageOpenTracker traficoId={props.traficoId} />

      <Header
        traficoNumber={props.trafico.trafico}
        cliente={props.clientName}
        patente={props.trafico.patente}
        aduana={props.trafico.aduana}
        tipoOperacion={props.trafico.tipo_operacion}
        events={props.events}
        createdAt={props.trafico.created_at}
      />

      <HeroStrip
        traficoId={props.traficoId}
        tiles={heroTiles}
        onEventosClick={() => switchTo('cronologia')}
      />

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
          <div
            style={{
              background: BG_CARD,
              backdropFilter: `blur(${GLASS_BLUR})`,
              WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
              border: `1px solid ${BORDER}`,
              borderRadius: 20,
              boxShadow: GLASS_SHADOW,
              overflow: 'hidden',
            }}
          >
            <div
              role="tablist"
              aria-label="Secciones del embarque"
              className="trafico-tablist"
              style={{
                display: 'flex',
                gap: 4,
                padding: '8px 12px 0',
                borderBottom: `1px solid ${BORDER}`,
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
                        ? `2px solid ${ACCENT_SILVER}`
                        : '2px solid transparent',
                      color: selected ? TEXT_PRIMARY : TEXT_MUTED,
                      fontSize: 'var(--aguila-fs-body)',
                      fontWeight: selected ? 700 : 500,
                      letterSpacing: '0.02em',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
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
          </div>
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
      />

      <div
        style={{
          textAlign: 'center',
          padding: '20px 0',
          fontSize: 'var(--aguila-fs-meta)',
          color: TEXT_MUTED,
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
