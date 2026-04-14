'use client'

/**
 * AGUILA · Block 6b — Inicio (dashboard) tab.
 * Read-only summary: status badge, pedimento number, cliente, trafico link,
 * days active, last modified, per-tab completion grid. No form fields.
 */

import Link from 'next/link'
import type { PedimentoRow, TabId } from '@/lib/pedimento-types'
import { TAB_LABELS_ES, TAB_ORDER } from '@/lib/pedimento-types'
import { fmtDateTime } from '@/lib/format-utils'
import { ACCENT_SILVER, ACCENT_SILVER_DIM } from '@/lib/design-system'
import type { PedimentoChildrenData } from '../PedimentoLayout'

const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  borrador:  { bg: 'rgba(120,113,108,0.12)', fg: '#D6D3D1', border: 'rgba(120,113,108,0.35)' },
  validado:  { bg: 'rgba(13,148,136,0.12)',  fg: '#2DD4BF', border: 'rgba(13,148,136,0.35)' },
  firmado:   { bg: 'rgba(192,197,206,0.12)', fg: '#C0C5CE', border: 'rgba(192,197,206,0.35)' },
  pagado:    { bg: 'rgba(192,197,206,0.12)',   fg: '#FACC15', border: 'rgba(192,197,206,0.35)' },
  cruzado:   { bg: 'rgba(34,197,94,0.12)',   fg: '#4ADE80', border: 'rgba(34,197,94,0.35)' },
  cancelado: { bg: 'rgba(239,68,68,0.12)',   fg: '#F87171', border: 'rgba(239,68,68,0.35)' },
}

export interface InicioTabProps {
  pedimento: PedimentoRow
  trafico: { trafico: string; estatus: string | null; pedimento: string | null }
  clienteName: string | null
  clienteRfc: string | null
  childrenData: PedimentoChildrenData
  partidasCount: number
  onJumpTab: (tab: TabId) => void
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 0
  return Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)))
}

function tabHasData(tab: TabId, p: PedimentoRow, c: PedimentoChildrenData, partidasCount: number): boolean {
  switch (tab) {
    case 'inicio': return true
    case 'datos_generales':
      return Boolean(p.regime_type || p.document_type || p.exchange_rate || p.pedimento_number)
    case 'cliente_observaciones':
      return Boolean(p.cliente_rfc || (p.observations && p.observations.length > 0) || Object.keys(p.identifiers ?? {}).length > 0)
    case 'facturas_proveedores': return c.facturas.length > 0
    case 'destinatarios': return c.destinatarios.length > 0
    case 'partidas': return partidasCount > 0
    case 'compensaciones': return c.compensaciones.length > 0
    case 'pagos_virtuales': return c.pagos_virtuales.length > 0
    case 'guias_contenedores': return c.guias.length > 0
    case 'transportistas': return c.transportistas.length > 0
    case 'candados': return c.candados.length > 0
    case 'descargas': return c.descargas.length > 0
    case 'cuentas_garantia': return c.cuentas_garantia.length > 0
    case 'contribuciones': return c.contribuciones.length > 0
  }
}

export function InicioTab({
  pedimento, trafico, clienteName, clienteRfc, childrenData, partidasCount, onJumpTab,
}: InicioTabProps) {
  const status = pedimento.status
  const sc = STATUS_COLORS[status] ?? STATUS_COLORS.borrador

  const cardStyle: React.CSSProperties = {
    padding: 20,
    borderRadius: 20,
    background: 'rgba(255,255,255,0.045)',
    border: '1px solid rgba(192,197,206,0.18)',
    backdropFilter: 'blur(20px)',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--text-muted)', marginBottom: 6,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          ...cardStyle,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 20,
        }}
      >
        <div>
          <div style={labelStyle}>Estatus</div>
          <span
            style={{
              display: 'inline-block',
              padding: '6px 10px',
              borderRadius: 8,
              background: sc.bg,
              color: sc.fg,
              border: `1px solid ${sc.border}`,
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {status}
          </span>
        </div>
        <div>
          <div style={labelStyle}>Número de pedimento</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--text-primary)' }}>
            {pedimento.pedimento_number ?? 'Sin asignar'}
          </div>
        </div>
        <div>
          <div style={labelStyle}>Cliente</div>
          <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
            {clienteName ?? pedimento.cliente_id}
          </div>
          {clienteRfc && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
              {clienteRfc}
            </div>
          )}
        </div>
        <div>
          <div style={labelStyle}>Embarque</div>
          <Link
            href={`/embarques/${encodeURIComponent(trafico.trafico)}`}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: ACCENT_SILVER, textDecoration: 'none' }}
          >
            ← {trafico.trafico}
          </Link>
        </div>
        <div>
          <div style={labelStyle}>Días activo</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: 'var(--text-primary)' }}>
            {daysSince(pedimento.created_at)}
          </div>
        </div>
        <div>
          <div style={labelStyle}>Última modificación</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: ACCENT_SILVER_DIM }}>
            {fmtDateTime(pedimento.updated_at)}
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={labelStyle}>Completitud por pestaña</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 10,
            marginTop: 8,
          }}
        >
          {TAB_ORDER.filter((t) => t !== 'inicio').map((t) => {
            const has = tabHasData(t, pedimento, childrenData, partidasCount)
            return (
              <button
                key={t}
                type="button"
                onClick={() => onJumpTab(t)}
                style={{
                  textAlign: 'left',
                  minHeight: 60,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: `1px solid ${has ? 'rgba(34,197,94,0.28)' : 'rgba(192,197,206,0.18)'}`,
                  background: has ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.045)',
                  color: has ? '#86EFAC' : ACCENT_SILVER_DIM,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {has ? '• con datos' : '• vacío'}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                  {TAB_LABELS_ES[t]}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
