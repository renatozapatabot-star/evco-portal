'use client'

import { useEffect, useState } from 'react'
import { X, AlertTriangle, Clock } from 'lucide-react'
import { getCookieValue } from '@/lib/client-config'
import { fmtCarrier } from '@/lib/carrier-names'
import { GOLD } from '@/lib/design-system'

interface Trafico {
  trafico: string
  estatus?: string
  fecha_llegada?: string | null
  descripcion_mercancia?: string | null
  peso_bruto?: number | null
  importe_total?: number | null
  pedimento?: string | null
  transportista_mexicano?: string | null
  transportista_extranjero?: string | null
  proveedores?: string | null
  facturas?: string | null
  [key: string]: unknown
}

interface Props {
  trafico: Trafico | null
  onClose: () => void
}

const fmtId = (id: string) => {
  const clientClave = getCookieValue('company_clave') ?? ''
  const clean = (id ?? '').replace(/[\u2013\u2014]/g, '-')
  return clean.startsWith(`${clientClave}-`) ? clean : `${clientClave}-${clean}`
}

const fmtPeso = (n: number | null | undefined) =>
  n ? `${Number(n).toLocaleString('es-MX')} kg` : '—'

const fmtUSD = (n: number | null | undefined) =>
  n
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
    : '—'

const fmtDate = (s: string | null | undefined) => {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return s
  }
}

const StatusBadge = ({ status }: { status?: string }) => {
  const s = (status ?? '').toLowerCase()
  if (s.includes('cruz')) return (
    <span className="badge badge-cruzado"><span className="badge-dot" />Cruzado</span>
  )
  if (s.includes('hold') || s.includes('detenido')) return (
    <span className="badge badge-hold"><span className="badge-dot" />On Hold</span>
  )
  return (
    <span className="badge badge-proceso"><span className="badge-dot" />En Proceso</span>
  )
}

interface DetailItemProps {
  label: string
  value: React.ReactNode
  mono?: boolean
}

const DetailItem = ({ label, value, mono }: DetailItemProps) => (
  <div
    className="rounded-[7px] p-3"
    style={{ background: '#f7f8fa' }}
  >
    <div className="text-[10.5px] mb-1" style={{ color: '#6b7280' }}>
      {label}
    </div>
    <div
      className={`text-[13px] font-medium ${mono ? 'mono' : ''}`}
      style={{ color: typeof value === 'string' && value === '—' ? '#d1d5db' : '#111827' }}
    >
      {value}
    </div>
  </div>
)

const DocRow = ({
  name,
  status,
}: {
  name: string
  status: 'ok' | 'pending' | 'missing'
}) => {
  const colors = {
    ok:      { bg: '#d1fae5', color: '#065f46', label: 'OK' },
    pending: { bg: '#fffbeb', color: '#92400e', label: 'Pendiente' },
    missing: { bg: '#fef2f2', color: '#b91c1c', label: 'Falta' },
  }
  const c = colors[status]
  return (
    <div
      className="flex items-center justify-between px-3 py-2 rounded-[6px]"
      style={{ background: '#f7f8fa' }}
    >
      <span className="text-[12px]" style={{ color: '#374151' }}>
        {name}
      </span>
      <span
        className="text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px]"
        style={{ background: c.bg, color: c.color }}
      >
        {c.label}
      </span>
    </div>
  )
}

interface Evento {
  consecutivo: number
  cve_trafico: string
  fecha: string
  comentarios: string | null
  registrado_por: string | null
}

function Timeline({ traficoId }: { traficoId: string }) {
  const [events, setEvents] = useState<Evento[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/data?table=globalpc_eventos&cve_trafico=${traficoId}&limit=50&order_by=fecha&order_dir=desc`)
      .then(r => r.json())
      .then(data => setEvents(data.data ?? []))
      .catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
      .finally(() => setLoading(false))
  }, [traficoId])

  if (loading) return <div className="text-[12px] py-4 text-center" style={{ color: '#9ca3af' }}>Cargando eventos...</div>
  if (events.length === 0) return null

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: '#9ca3af' }}>
        Historial ({events.length})
      </div>
      <div className="relative pl-5" style={{ borderLeft: '2px solid #e5e7eb' }}>
        {events.map((e, i) => (
          <div key={e.consecutivo} className="relative pb-4 last:pb-0">
            <div
              className="absolute rounded-full"
              style={{
                left: -23, top: 3, width: 8, height: 8,
                background: i === 0 ? GOLD : '#d1d5db',
                border: `2px solid ${i === 0 ? GOLD : '#e5e7eb'}`,
              }}
            />
            <div className="text-[11px] font-medium" style={{ color: '#111827' }}>
              {e.comentarios || 'Evento registrado'}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px]" style={{ color: '#9ca3af' }}>
                {fmtDate(e.fecha)}
              </span>
              {e.registrado_por && (
                <span className="text-[10px]" style={{ color: '#d1d5db' }}>
                  · {e.registrado_por}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RealDocuments({ traficoId }: { traficoId: string }) {
  const [docs, setDocs] = useState<{ type: string; name: string; url: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const all: { type: string; name: string; url: string | null }[] = []
      // Source 1: expediente_documentos
      try {
        const res1 = await fetch(`/api/data?table=expediente_documentos&pedimento_id=${encodeURIComponent(traficoId)}&limit=50`)
        const d1 = await res1.json()
        ;(d1.data ?? d1 ?? []).forEach((d: any) => all.push({ type: d.doc_type || 'unknown', name: d.file_name || d.doc_type || '', url: d.file_url }))
      } catch {}
      // Source 2: documents table (match by file_url containing trafico ID)
      try {
        const res2 = await fetch(`/api/data?table=documents&limit=200`)
        const d2 = await res2.json()
        ;(d2.data ?? d2 ?? []).forEach((d: any) => {
          const metaTrafico = d.metadata?.trafico
          const urlMatch = d.file_url?.includes(traficoId)
          if (metaTrafico === traficoId || urlMatch) {
            all.push({ type: d.document_type || 'unknown', name: d.metadata?.nombre || d.file_url?.split('/').pop() || d.document_type || '', url: d.file_url })
          }
        })
      } catch {}
      setDocs(all)
      setLoading(false)
    }
    load()
  }, [traficoId])

  if (loading) return <div style={{ color: '#6b7280', fontSize: 12, padding: '8px 0' }}>Cargando documentos...</div>

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: '#9ca3af' }}>
        Documentos ({docs.length})
      </div>
      {docs.length === 0 ? (
        <div style={{ color: '#6b7280', fontSize: 12, padding: '8px 0' }}>Sin documentos — sync en progreso</div>
      ) : (
        <div className="flex flex-col gap-1">
          {docs.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary, #e5e7eb)' }}>
                  {d.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted, #6b7280)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.name}
                </div>
              </div>
              {d.url && d.url.startsWith('http') && (
                <a href={d.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 10, color: GOLD, textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}
                  onClick={e => e.stopPropagation()}>
                  Ver ↗
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TraficoDrawer({ trafico, onClose }: Props) {
  if (!trafico) return null

  const hasPedimento = !!trafico.pedimento
  const hasMve = false

  return (
    <>
      {/* Overlay */}
      <div className="drawer-overlay" onClick={onClose} />

      {/* Panel */}
      <div className="drawer-panel">
        {/* Header */}
        <div
          className="flex items-start justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}
        >
          <div>
            <div className="mono font-semibold text-[15px]" style={{ color: '#111827' }}>
              {fmtId(trafico.trafico)}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <StatusBadge status={trafico.estatus} />
              {trafico.peso_bruto && (
                <span className="text-[11.5px]" style={{ color: '#9ca3af' }}>
                  {fmtPeso(trafico.peso_bruto)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[6px] flex items-center justify-center
                       transition-colors duration-100 flex-shrink-0 mt-0.5"
            style={{ background: '#f0f2f5', color: '#6b7280' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e5e7eb')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f0f2f5')}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {!hasPedimento && (
            <div
              className="flex items-start gap-2.5 rounded-[8px] px-3.5 py-3"
              style={{
                background: '#fffbeb',
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              <AlertTriangle
                size={15}
                strokeWidth={1.8}
                className="flex-shrink-0 mt-0.5"
                style={{ color: '#f59e0b' }}
              />
              <p className="text-[11.5px] leading-[1.55]" style={{ color: '#92400e' }}>
                Datos de pedimento no disponibles hasta que GlobalPC autorice el
                IP <span className="mono font-medium">50.84.32.162</span>. Contactar
                a Mario para activar sincronización.
              </p>
            </div>
          )}

          {/* Shipment info */}
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5"
              style={{ color: '#9ca3af' }}
            >
              Información del Embarque
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DetailItem label="Tráfico"        value={fmtId(trafico.trafico)} mono />
              <DetailItem label="Pedimento"       value={trafico.pedimento ?? ''} mono />
              <DetailItem label="Fecha Llegada"   value={fmtDate(trafico.fecha_llegada)} />
              <DetailItem label="Peso Bruto"      value={fmtPeso(trafico.peso_bruto)} mono />
              <DetailItem label="Valor USD"        value={fmtUSD(trafico.importe_total)} mono />
              <DetailItem label="Estado"           value={<StatusBadge status={trafico.estatus} />} />
            </div>
          </div>

          {/* Carriers */}
          {(trafico.transportista_mexicano || trafico.transportista_extranjero) && (
            <div>
              <div
                className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5"
                style={{ color: '#9ca3af' }}
              >
                Transportistas
              </div>
              <div className="grid grid-cols-2 gap-2">
                <DetailItem
                  label="Transp. Mexicano"
                  value={fmtCarrier(trafico.transportista_mexicano)}
                />
                <DetailItem
                  label="Transp. Extranjero"
                  value={fmtCarrier(trafico.transportista_extranjero)}
                />
              </div>
            </div>
          )}

          {/* Description */}
          {trafico.descripcion_mercancia && (
            <div>
              <div
                className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5"
                style={{ color: '#9ca3af' }}
              >
                Mercancía
              </div>
              <div
                className="rounded-[7px] p-3 text-[13px]"
                style={{ background: '#f7f8fa', color: '#374151' }}
              >
                {trafico.descripcion_mercancia}
              </div>
            </div>
          )}

          {/* Timeline */}
          <Timeline traficoId={trafico.trafico} />

          {/* Documents — Real data from WSDL sync */}
          <RealDocuments traficoId={trafico.trafico} />

        </div>
      </div>
    </>
  )
}
