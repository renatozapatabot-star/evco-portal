'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { AguilaWordmark } from '@/components/brand/AguilaWordmark'
import { CoordinatesBadge } from '@/components/brand/CoordinatesBadge'
import { TAB_ORDER, TAB_LABELS_ES } from '@/lib/pedimento-types'
import type {
  PedimentoRow,
  TabId,
  ValidationError,
  DestinatarioRow,
  CompensacionRow,
  PagoVirtualRow,
  GuiaRow,
  TransportistaRow,
  CandadoRow,
  DescargaRow,
  CuentaGarantiaRow,
  ContribucionRow,
  PedimentoFacturaRow,
} from '@/lib/pedimento-types'
import type { PartidaRow } from '@/app/embarques/[id]/types'
import { PedimentoContext } from '@/components/pedimento/PedimentoContext'
import { useTrack } from '@/lib/telemetry/useTrack'
import { TabStrip } from './TabStrip'
import { RightRail } from './RightRail'
import { ActionBar } from './ActionBar'
import { PdfPreviewRail } from '@/components/pedimento/PdfPreviewRail'
import { InicioTab } from './tabs/InicioTab'
import { DatosGeneralesTab } from './tabs/DatosGeneralesTab'
import { ClienteObservacionesTab } from './tabs/ClienteObservacionesTab'
import { FacturasProveedoresTab } from './tabs/FacturasProveedoresTab'
import { DestinatariosTab } from './tabs/DestinatariosTab'
import { PartidasTab } from './tabs/PartidasTab'
import { CompensacionesTab } from './tabs/CompensacionesTab'
import { PagosVirtualesTab } from './tabs/PagosVirtualesTab'
import { GuiasContenedoresTab } from './tabs/GuiasContenedoresTab'
import { TransportistasTab } from './tabs/TransportistasTab'
import { CandadosTab } from './tabs/CandadosTab'
import { DescargasTab } from './tabs/DescargasTab'
import { CuentasGarantiaTab } from './tabs/CuentasGarantiaTab'
import { ContribucionesTab } from './tabs/ContribucionesTab'

export interface PedimentoChildrenData {
  destinatarios: DestinatarioRow[]
  compensaciones: CompensacionRow[]
  pagos_virtuales: PagoVirtualRow[]
  guias: GuiaRow[]
  transportistas: TransportistaRow[]
  candados: CandadoRow[]
  descargas: DescargaRow[]
  cuentas_garantia: CuentaGarantiaRow[]
  contribuciones: ContribucionRow[]
  facturas: PedimentoFacturaRow[]
}

export interface PedimentoLayoutProps {
  trafico: { trafico: string; estatus: string | null; pedimento: string | null }
  pedimento: PedimentoRow
  children_data: PedimentoChildrenData
  partidas: PartidaRow[]
  clienteName: string | null
  clienteRfc: string | null
  workflowEvents: Array<{ event_type: string; created_at: string }>
}

const VALIDATION_DEBOUNCE_MS = 500

export function PedimentoLayout({
  trafico, pedimento, children_data, partidas, clienteName, clienteRfc, workflowEvents,
}: PedimentoLayoutProps) {
  const [activeTab, setActiveTab] = useState<TabId>('inicio')
  const [activeAside, setActiveAside] = useState<'validacion' | 'preview'>('validacion')
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [errorsCount, setErrorsCount] = useState(0)
  const [warningsCount, setWarningsCount] = useState(0)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const track = useTrack()

  const runValidation = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch(`/api/pedimento/${pedimento.id}/validate`, {
        method: 'GET',
        signal: controller.signal,
      })
      if (!res.ok) return
      const body = (await res.json()) as {
        errors?: ValidationError[]
        errors_count?: number
        warnings_count?: number
      }
      if (!mountedRef.current) return
      setValidationErrors(body.errors ?? [])
      setErrorsCount(body.errors_count ?? 0)
      setWarningsCount(body.warnings_count ?? 0)
    } catch {
      /* aborted or transient — caller retries on next autosave */
    }
  }, [pedimento.id])

  const requestValidation = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void runValidation()
    }, VALIDATION_DEBOUNCE_MS)
  }, [runValidation])

  useEffect(() => {
    mountedRef.current = true
    track('page_view', { metadata: { event: 'pedimento_opened', pedimentoId: pedimento.id, traficoId: trafico.trafico } })
    void runValidation()
    return () => {
      mountedRef.current = false
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
    // Intentionally run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTabChange = useCallback(
    (tab: TabId) => {
      setActiveTab(tab)
      track('page_view', { metadata: { event: 'pedimento_tab_switched', pedimentoId: pedimento.id, tab } })
    },
    [pedimento.id, track],
  )

  const focusField = useCallback((tab: string, field: string) => {
    setActiveTab(tab as TabId)
    // Let tab mount, then scroll-focus.
    setTimeout(() => {
      const el = document.getElementById(`field-${field}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const input = el.querySelector('input, textarea, select')
        if (input instanceof HTMLElement) input.focus()
      }
    }, 50)
  }, [])

  const renderTab = () => {
    switch (activeTab) {
      case 'inicio':
        return (
          <InicioTab
            pedimento={pedimento}
            trafico={trafico}
            clienteName={clienteName}
            clienteRfc={clienteRfc}
            childrenData={children_data}
            partidasCount={partidas.length}
            onJumpTab={handleTabChange}
          />
        )
      case 'datos_generales':
        return <DatosGeneralesTab pedimento={pedimento} />
      case 'cliente_observaciones':
        return <ClienteObservacionesTab pedimento={pedimento} clienteName={clienteName} />
      case 'facturas_proveedores':
        return <FacturasProveedoresTab facturas={children_data.facturas} />
      case 'destinatarios':
        return <DestinatariosTab rows={children_data.destinatarios} />
      case 'partidas':
        return <PartidasTab traficoId={trafico.trafico} partidas={partidas} />
      case 'compensaciones':
        return <CompensacionesTab rows={children_data.compensaciones} />
      case 'pagos_virtuales':
        return <PagosVirtualesTab rows={children_data.pagos_virtuales} />
      case 'guias_contenedores':
        return <GuiasContenedoresTab rows={children_data.guias} />
      case 'transportistas':
        return <TransportistasTab rows={children_data.transportistas} />
      case 'candados':
        return <CandadosTab rows={children_data.candados} />
      case 'descargas':
        return <DescargasTab rows={children_data.descargas} />
      case 'cuentas_garantia':
        return <CuentasGarantiaTab rows={children_data.cuentas_garantia} />
      case 'contribuciones':
        return <ContribucionesTab rows={children_data.contribuciones} />
    }
  }

  return (
    <PedimentoContext.Provider
      value={{
        pedimentoId: pedimento.id,
        traficoId: trafico.trafico,
        companyId: pedimento.company_id,
        validationErrors,
        errorsCount,
        warningsCount,
        requestValidation,
        focusField,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          paddingBottom: 80,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexWrap: 'wrap',
          }}
        >
          <AguilaMark size={32} tone="silver" />
          <AguilaWordmark size={18} tone="silver" />
          <CoordinatesBadge tone="silver-dim" />
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--text-secondary)' }}>
            <Link
              href={`/embarques/${encodeURIComponent(trafico.trafico)}`}
              style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
            >
              ← Embarque
            </Link>
            <span style={{ margin: '0 8px', opacity: 0.4 }}>/</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{trafico.trafico}</span>
            {pedimento.pedimento_number && (
              <>
                <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{pedimento.pedimento_number}</span>
              </>
            )}
          </div>
        </header>

        <TabStrip activeTab={activeTab} onChange={handleTabChange} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)',
            gap: 24,
            padding: '24px',
            flex: 1,
          }}
        >
          <section aria-label={`Contenido — ${TAB_LABELS_ES[activeTab]}`}>
            {renderTab()}
          </section>
          <aside aria-label="Panel lateral" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              role="tablist"
              aria-label="Pestañas del panel lateral"
              style={{
                display: 'flex',
                gap: 6,
                padding: 4,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.045)',
                border: '1px solid rgba(192,197,206,0.14)',
              }}
            >
              {([
                { id: 'validacion', label: 'Validación' },
                { id: 'preview', label: 'Vista previa PDF' },
              ] as const).map((t) => {
                const active = activeAside === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveAside(t.id)}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: active
                        ? '1px solid rgba(192,197,206,0.45)'
                        : '1px solid transparent',
                      background: active ? 'rgba(192,197,206,0.12)' : 'transparent',
                      color: active ? '#E8EAED' : 'var(--text-secondary)',
                      fontSize: 'var(--aguila-fs-compact)',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            {activeAside === 'validacion'
              ? <RightRail workflowEvents={workflowEvents} />
              : <PdfPreviewRail />}
          </aside>
        </div>

        <ActionBar pedimentoId={pedimento.id} />
      </div>
    </PedimentoContext.Provider>
  )
}

export { TAB_ORDER, TAB_LABELS_ES }
