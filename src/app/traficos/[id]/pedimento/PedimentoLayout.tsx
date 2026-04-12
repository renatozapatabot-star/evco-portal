'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AguilaMark } from '@/components/brand/AguilaMark'
import { AguilaWordmark } from '@/components/brand/AguilaWordmark'
import { CoordinatesBadge } from '@/components/brand/CoordinatesBadge'
import { TAB_ORDER, TAB_LABELS_ES } from '@/lib/pedimento-types'
import type {
  PedimentoRow,
  TabId,
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
import { TabStrip } from './TabStrip'
import { RightRail } from './RightRail'
import { ActionBar } from './ActionBar'
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
}

export function PedimentoLayout({ trafico, pedimento, children_data }: PedimentoLayoutProps) {
  const [activeTab, setActiveTab] = useState<TabId>('inicio')

  const renderTab = () => {
    switch (activeTab) {
      case 'inicio':
        return <InicioTab pedimento={pedimento} trafico={trafico} />
      case 'datos_generales':
        return <DatosGeneralesTab pedimento={pedimento} />
      case 'cliente_observaciones':
        return <ClienteObservacionesTab pedimento={pedimento} />
      case 'facturas_proveedores':
        return <FacturasProveedoresTab facturas={children_data.facturas} />
      case 'destinatarios':
        return <DestinatariosTab rows={children_data.destinatarios} />
      case 'partidas':
        return <PartidasTab traficoId={trafico.trafico} />
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        paddingBottom: 80,
      }}
    >
      {/* Header */}
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
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <Link
            href={`/traficos/${encodeURIComponent(trafico.trafico)}`}
            style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
          >
            ← Tráfico
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

      <TabStrip activeTab={activeTab} onChange={setActiveTab} />

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
        <aside aria-label="Panel lateral">
          <RightRail />
        </aside>
      </div>

      <ActionBar pedimentoId={pedimento.id} />
    </div>
  )
}

// Expose tab order + labels for child components
export { TAB_ORDER, TAB_LABELS_ES }
