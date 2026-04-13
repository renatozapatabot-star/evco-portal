'use client'

/**
 * ClienteEstado — Shipper surface "Estado de operaciones" panel.
 *
 * Distilled from the old 3-tab ClienteInicio: shows the client's active
 * tráficos as the primary deep-dive, plus a single summary card linking
 * to the full documentos view. Invariant 24 respected (no deltas, no
 * severity, silver tone only).
 */

import {
  Truck, FileText, Package, CheckCircle, AlertCircle, MapPin, Flag, Circle,
  FolderOpen,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fmtDate, fmtDateTime } from '@/lib/format-utils'
import {
  getClienteEventLabel,
  type ClienteEventLabel,
} from '@/lib/cliente/event-labels'
import type {
  ClienteTraficoCard,
  ClienteDocumento,
} from '@/lib/cliente/dashboard'
import { GlassCard, SectionHeader } from '@/components/aguila'
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, ACCENT_SILVER } from '@/lib/design-system'

const ICONS: Record<ClienteEventLabel['icon'], LucideIcon> = {
  'truck': Truck,
  'file-text': FileText,
  'package': Package,
  'check-circle': CheckCircle,
  'alert-circle': AlertCircle,
  'map-pin': MapPin,
  'flag': Flag,
  'circle': Circle,
}

function statusPulse(estatus: string | null): string {
  const s = (estatus ?? '').toLowerCase()
  if (s.includes('cruzad')) return '#22C55E'
  if (s.includes('deten') || s.includes('riesgo') || s.includes('rojo')) return '#EF4444'
  if (s.includes('aduana') || s.includes('proceso') || s.includes('documen')) return '#FBBF24'
  return ACCENT_SILVER
}

const MONO = { fontFamily: 'var(--font-mono)' } as const

interface Props {
  activeTraficos: ClienteTraficoCard[]
  documentos: ClienteDocumento[]
}

export function ClienteEstado({ activeTraficos, documentos }: Props) {
  return (
    <>
      <GlassCard padding="16px 20px">
        <SectionHeader
          title="Mis tráficos activos"
          count={activeTraficos.length}
        />
        {activeTraficos.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
            Sin tráficos activos. Tus operaciones en curso aparecerán aquí.
          </div>
        ) : (
          <div
            className="cliente-estado-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 12,
            }}
          >
            <style jsx>{`
              @media (max-width: 640px) {
                .cliente-estado-grid { grid-template-columns: 1fr !important; }
              }
            `}</style>
            {activeTraficos.slice(0, 12).map((r) => {
              const pulse = statusPulse(r.estatus)
              const lastLabel = getClienteEventLabel(r.last_event_type)
              const Icon = ICONS[lastLabel.icon] ?? Circle
              return (
                <GlassCard
                  key={r.trafico}
                  href={`/traficos/${encodeURIComponent(r.trafico)}/trace`}
                  size="compact"
                  style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 60 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{
                      ...MONO,
                      fontSize: 'var(--aguila-fs-kpi-small, 18px)',
                      fontWeight: 700,
                      color: TEXT_PRIMARY,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.trafico}
                    </div>
                    <span
                      title={r.estatus ?? ''}
                      aria-hidden
                      style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: pulse, boxShadow: `0 0 8px ${pulse}`,
                        flexShrink: 0,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {r.estatus && (
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        padding: '3px 10px', borderRadius: 999,
                        background: 'rgba(192,197,206,0.12)',
                        color: ACCENT_SILVER,
                      }}>
                        {r.estatus}
                      </span>
                    )}
                    {r.fecha_llegada && (
                      <span style={{ ...MONO, fontSize: 11, color: TEXT_MUTED }}>
                        ETA {fmtDate(r.fecha_llegada)}
                      </span>
                    )}
                  </div>
                  {r.last_event_type && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      paddingTop: 8,
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <Icon size={14} color={ACCENT_SILVER} />
                      <span style={{
                        fontSize: 12, color: TEXT_SECONDARY,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1, minWidth: 0,
                      }}>
                        {lastLabel.label}
                      </span>
                      {r.last_event_at && (
                        <span style={{ ...MONO, fontSize: 10, color: TEXT_MUTED, flexShrink: 0 }}>
                          {fmtDateTime(r.last_event_at)}
                        </span>
                      )}
                    </div>
                  )}
                </GlassCard>
              )
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard href="/expedientes" padding="16px 20px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(192,197,206,0.08)',
            border: '1px solid rgba(192,197,206,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <FolderOpen size={18} color={ACCENT_SILVER} strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY, lineHeight: 1.3 }}>
              Expedientes completos
            </div>
            <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 }}>
              {documentos.length} documento{documentos.length === 1 ? '' : 's'} archivado{documentos.length === 1 ? '' : 's'} a la fecha · ver todos →
            </div>
          </div>
        </div>
      </GlassCard>
    </>
  )
}
