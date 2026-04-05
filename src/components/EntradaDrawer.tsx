'use client'

import { useEffect, useState } from 'react'
import { X, Check, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { getCookieValue } from '@/lib/client-config'
import { fmtCarrier } from '@/lib/carrier-names'
import { GOLD } from '@/lib/design-system'

interface Entrada {
  id: number
  cve_entrada: string
  cve_embarque?: number | null
  cve_cliente?: string | null
  cve_proveedor?: string | null
  trafico?: string | null
  descripcion_mercancia?: string | null
  fecha_llegada_mercancia?: string | null
  cantidad_bultos?: number | null
  peso_bruto?: number | null
  peso_neto?: number | null
  tipo_operacion?: string | null
  tipo_carga?: string | null
  transportista_americano?: string | null
  transportista_mexicano?: string | null
  recibido_por?: string | null
  tiene_faltantes?: boolean | null
  mercancia_danada?: boolean | null
  recibio_facturas?: boolean | null
  recibio_packing_list?: boolean | null
  num_pedido?: string | null
  num_talon?: string | null
  num_caja_trailer?: string | null
  comentarios_faltantes?: string | null
  comentarios_danada?: string | null
  comentarios_generales?: string | null
  [key: string]: unknown
}

interface Props {
  entrada: Entrada | null
  onClose: () => void
}

const fmtDate = (s: string | null | undefined) => {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return s }
}

const fmtPeso = (n: number | null | undefined) =>
  n ? `${Number(n).toLocaleString('es-MX')} kg` : ''

const fmtTrafico = (id: string) => {
  const clientClave = getCookieValue('company_clave') ?? ''
  const clean = id.replace(/[\u2013\u2014]/g, '-')
  return clean.startsWith(`${clientClave}-`) ? clean : `${clientClave}-${clean}`
}

const DetailItem = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="rounded-[7px] p-3" style={{ background: 'var(--bg-elevated, #f7f8fa)' }}>
    <div className="text-[10.5px] mb-1" style={{ color: 'var(--text-muted, #6b7280)' }}>{label}</div>
    <div
      className={`text-[13px] font-medium ${mono ? 'mono' : ''}`}
      style={{ color: (typeof value === 'string' && !value) ? 'var(--text-disabled, #d1d5db)' : 'var(--text-primary, #111827)' }}
    >
      {value}
    </div>
  </div>
)

const BoolBadge = ({ value, labelTrue, labelFalse }: { value: boolean | null | undefined; labelTrue: string; labelFalse: string }) => {
  if (value) return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[4px]"
      style={{ background: 'var(--red-bg, #fef2f2)', color: 'var(--red-text, #b91c1c)' }}>
      <AlertTriangle size={11} /> {labelTrue}
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[4px]"
      style={{ background: 'var(--green-bg, #d1fae5)', color: 'var(--green-text, #065f46)' }}>
      <Check size={11} /> {labelFalse}
    </span>
  )
}

const CheckBadge = ({ value }: { value: boolean | null | undefined }) => {
  if (value) return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[4px]"
      style={{ background: 'var(--green-bg, #d1fae5)', color: 'var(--green-text, #065f46)' }}>
      <Check size={11} strokeWidth={2.5} /> Recibido
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[4px]"
      style={{ background: 'var(--red-bg, #fef2f2)', color: 'var(--red-text, #b91c1c)' }}>
      <X size={11} strokeWidth={2.5} /> No
    </span>
  )
}

function EntradaDocuments({ traficoId }: { traficoId: string }) {
  const [docs, setDocs] = useState<{ type: string; name: string; url: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const all: { type: string; name: string; url: string | null }[] = []
      try {
        const res = await fetch(`/api/data?table=documents&limit=200`)
        const d = await res.json()
        ;(d.data ?? []).forEach((doc: { document_type?: string; file_url?: string; metadata?: { trafico?: string; nombre?: string } }) => {
          const metaTrafico = doc.metadata?.trafico
          const urlMatch = doc.file_url?.includes(traficoId)
          if (metaTrafico === traficoId || urlMatch) {
            all.push({
              type: doc.document_type || 'unknown',
              name: doc.metadata?.nombre || doc.file_url?.split('/').pop() || doc.document_type || '',
              url: doc.file_url ?? null
            })
          }
        })
      } catch {}
      setDocs(all)
      setLoading(false)
    }
    load()
  }, [traficoId])

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>Cargando documentos...</div>

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: 'var(--text-muted, #9ca3af)' }}>
        Documentos ({docs.length})
      </div>
      {docs.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '8px 0' }}>Sin documentos vinculados</div>
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

export default function EntradaDrawer({ entrada, onClose }: Props) {
  if (!entrada) return null

  const hasIncidencia = entrada.tiene_faltantes || entrada.mercancia_danada

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />

      <div className="drawer-panel">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-primary, rgba(0,0,0,0.07))' }}>
          <div>
            <div className="mono font-semibold text-[15px]" style={{ color: 'var(--text-primary, #111827)' }}>
              Entrada {entrada.cve_entrada}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              {hasIncidencia ? (
                <span className="badge badge-hold"><span className="badge-dot" />Incidencia</span>
              ) : (
                <span className="badge badge-cruzado"><span className="badge-dot" />OK</span>
              )}
              {entrada.peso_bruto && (
                <span className="text-[11.5px]" style={{ color: 'var(--text-muted, #9ca3af)' }}>
                  {fmtPeso(entrada.peso_bruto)}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-[6px] flex items-center justify-center transition-colors duration-100 flex-shrink-0 mt-0.5"
            style={{ background: 'var(--bg-elevated, #f0f2f5)', color: 'var(--text-muted, #6b7280)' }}>
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Entrada info */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: 'var(--text-muted, #9ca3af)' }}>
              Información de Entrada
            </div>
            <div className="grid grid-cols-2 gap-2">
              <DetailItem label="No. Entrada" value={entrada.cve_entrada} mono />
              <DetailItem label="Tráfico" value={
                entrada.trafico ? (
                  <Link href="/traficos" className="mono font-semibold" style={{ color: '#1A6BFF', textDecoration: 'none' }}>
                    {fmtTrafico(entrada.trafico)}
                  </Link>
                ) : ''
              } />
              <DetailItem label="Proveedor" value={entrada.cve_proveedor ?? ''} />
              <DetailItem label="Fecha Llegada" value={fmtDate(entrada.fecha_llegada_mercancia)} />
              <DetailItem label="Bultos Recibidos" value={entrada.cantidad_bultos?.toLocaleString('es-MX') ?? ''} mono />
              <DetailItem label="Num. Pedido" value={entrada.num_pedido || ''} mono />
              <DetailItem label="Peso Bruto" value={fmtPeso(entrada.peso_bruto)} mono />
              <DetailItem label="Peso Neto" value={fmtPeso(entrada.peso_neto)} mono />
            </div>
          </div>

          {/* Mercancía */}
          {entrada.descripcion_mercancia && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: 'var(--text-muted, #9ca3af)' }}>
                Mercancía
              </div>
              <div className="rounded-[7px] p-3 text-[13px]"
                style={{ background: 'var(--bg-elevated, #f7f8fa)', color: 'var(--text-secondary, #374151)' }}>
                {entrada.descripcion_mercancia}
              </div>
            </div>
          )}

          {/* Transportistas */}
          {(entrada.transportista_americano || entrada.transportista_mexicano) && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: 'var(--text-muted, #9ca3af)' }}>
                Transportistas
              </div>
              <div className="grid grid-cols-2 gap-2">
                <DetailItem label="Transp. Americano" value={fmtCarrier(entrada.transportista_americano)} />
                <DetailItem label="Transp. Mexicano" value={fmtCarrier(entrada.transportista_mexicano)} />
              </div>
            </div>
          )}

          {/* Status checks */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: 'var(--text-muted, #9ca3af)' }}>
              Revisión de Recepción
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[7px] p-3" style={{ background: 'var(--bg-elevated, #f7f8fa)' }}>
                <div className="text-[10.5px] mb-1.5" style={{ color: 'var(--text-muted, #6b7280)' }}>Faltantes</div>
                <BoolBadge value={entrada.tiene_faltantes} labelTrue="Sí — Faltantes" labelFalse="Sin faltantes" />
              </div>
              <div className="rounded-[7px] p-3" style={{ background: 'var(--bg-elevated, #f7f8fa)' }}>
                <div className="text-[10.5px] mb-1.5" style={{ color: 'var(--text-muted, #6b7280)' }}>Mercancía Dañada</div>
                <BoolBadge value={entrada.mercancia_danada} labelTrue="Sí — Daño" labelFalse="Sin daño" />
              </div>
              <div className="rounded-[7px] p-3" style={{ background: 'var(--bg-elevated, #f7f8fa)' }}>
                <div className="text-[10.5px] mb-1.5" style={{ color: 'var(--text-muted, #6b7280)' }}>Facturas</div>
                <CheckBadge value={entrada.recibio_facturas} />
              </div>
              <div className="rounded-[7px] p-3" style={{ background: 'var(--bg-elevated, #f7f8fa)' }}>
                <div className="text-[10.5px] mb-1.5" style={{ color: 'var(--text-muted, #6b7280)' }}>Packing List</div>
                <CheckBadge value={entrada.recibio_packing_list} />
              </div>
            </div>
          </div>

          {/* Recibido por */}
          {entrada.recibido_por && (
            <DetailItem label="Recibido Por" value={entrada.recibido_por} />
          )}

          {/* Comments if any */}
          {(entrada.comentarios_faltantes || entrada.comentarios_danada || entrada.comentarios_generales) && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: 'var(--text-muted, #9ca3af)' }}>
                Comentarios
              </div>
              <div className="space-y-2">
                {entrada.comentarios_faltantes && (
                  <div className="rounded-[7px] p-3 text-[12px]"
                    style={{ background: 'var(--red-bg, #fef2f2)', color: 'var(--red-text, #b91c1c)' }}>
                    <span className="font-semibold">Faltantes:</span> {entrada.comentarios_faltantes}
                  </div>
                )}
                {entrada.comentarios_danada && (
                  <div className="rounded-[7px] p-3 text-[12px]"
                    style={{ background: 'var(--red-bg, #fef2f2)', color: 'var(--red-text, #b91c1c)' }}>
                    <span className="font-semibold">Daño:</span> {entrada.comentarios_danada}
                  </div>
                )}
                {entrada.comentarios_generales && (
                  <div className="rounded-[7px] p-3 text-[12px]"
                    style={{ background: 'var(--bg-elevated, #f7f8fa)', color: 'var(--text-secondary, #374151)' }}>
                    {entrada.comentarios_generales}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Documents — from parent tráfico */}
          {entrada.trafico && <EntradaDocuments traficoId={entrada.trafico} />}

        </div>
      </div>
    </>
  )
}
