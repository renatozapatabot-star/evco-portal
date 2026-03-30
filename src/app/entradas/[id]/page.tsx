'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Check, AlertTriangle, X } from 'lucide-react'
import { CLIENT_CLAVE } from '@/lib/client-config'
import { fmtDate, fmtDesc } from '@/lib/format-utils'
import { fmtCarrier } from '@/lib/carrier-names'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Entrada {
  id: number
  cve_entrada: string
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
  comentarios_faltantes?: string | null
  comentarios_danada?: string | null
  comentarios_generales?: string | null
  [key: string]: unknown
}

const fmtKg = (n: number | null | undefined) =>
  n ? `${Number(n).toLocaleString('es-MX')} kg` : ''

const fmtTrafico = (id: string) => {
  const clean = id.replace(/[\u2013\u2014]/g, '-')
  return clean.startsWith(`${CLIENT_CLAVE}-`) ? clean : `${CLIENT_CLAVE}-${clean}`
}

const BoolBadge = ({ value, labelTrue, labelFalse }: { value: boolean | null | undefined; labelTrue: string; labelFalse: string }) => {
  if (value) return (
    <span className="badge badge-hold"><AlertTriangle size={11} /> {labelTrue}</span>
  )
  return (
    <span className="badge badge-cruzado"><Check size={11} /> {labelFalse}</span>
  )
}

const CheckBadge = ({ value }: { value: boolean | null | undefined }) => {
  if (value) return <span className="badge badge-cruzado"><Check size={11} strokeWidth={2.5} /> Recibido</span>
  return <span className="badge badge-hold"><X size={11} strokeWidth={2.5} /> Faltante</span>
}

const titleCase = (s: string) => s ? s.toLowerCase().replace(/(?:^|\s|[-/])\w/g, c => c.toUpperCase()) : ''

export default function EntradaDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [entrada, setEntrada] = useState<Entrada | null>(null)
  const [loading, setLoading] = useState(true)
  const [proveedorName, setProveedorName] = useState('')

  useEffect(() => {
    fetch(`/api/data?table=entradas&cve_entrada=${encodeURIComponent(id)}&limit=1`)
      .then(r => r.json())
      .then(async d => {
        const rows = d.data ?? d ?? []
        const entry = rows[0] || null
        setEntrada(entry)

        // Resolve proveedor name
        const provCode = entry?.cve_proveedor
        if (provCode) {
          setProveedorName(provCode)
          const { data: gpc } = await supabase
            .from('globalpc_proveedores')
            .select('nombre')
            .or(`cve_proveedor.eq.${provCode},nombre.ilike.%${provCode}%`)
            .limit(1)
          if (gpc?.[0]) {
            setProveedorName(gpc[0].nombre)
          } else {
            const { data: supplier } = await supabase
              .from('supplier_network')
              .select('supplier_name')
              .ilike('supplier_name', `%${provCode}%`)
              .limit(1)
            if (supplier?.[0]) setProveedorName(supplier[0].supplier_name)
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="p-6">
      <div className="skeleton" style={{ width: 200, height: 32, marginBottom: 20 }} />
      <div className="skeleton" style={{ height: 300, borderRadius: 'var(--r-lg)' }} />
    </div>
  )

  if (!entrada) return (
    <div className="p-6">
      <Link href="/entradas" className="flex items-center gap-1.5 text-[13px] mb-4" style={{ color: 'var(--n-400)', textDecoration: 'none' }}>
        <ChevronLeft size={14} /> Entradas
      </Link>
      <h1 className="page-title">Entrada no encontrada</h1>
    </div>
  )

  const hasIncidencia = entrada.tiene_faltantes || entrada.mercancia_danada

  return (
    <div className="p-6" style={{ maxWidth: 900 }}>
      <Link href="/entradas" className="flex items-center gap-1.5 text-[13px] mb-4" style={{ color: 'var(--n-400)', textDecoration: 'none' }}>
        <ChevronLeft size={14} /> Entradas
      </Link>

      <div className="page-header">
        <h1 className="page-title">Entrada {entrada.cve_entrada}</h1>
        <p className="page-sub">EVCO Plastics de Mexico &middot; Patente 3596</p>
      </div>

      {entrada.trafico && (
        <Link href={`/traficos/${encodeURIComponent(fmtTrafico(entrada.trafico))}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--gold-600)', textDecoration: 'none', marginBottom: 12 }}>
          Tráfico: {fmtTrafico(entrada.trafico)} →
        </Link>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
        {hasIncidencia ? (
          <span className="badge badge-hold"><span className="badge-dot" />Incidencia</span>
        ) : (
          <span className="badge badge-cruzado"><span className="badge-dot" />OK</span>
        )}
        {entrada.peso_bruto && (
          <span style={{ fontSize: 14, color: 'var(--n-500)' }}>{fmtKg(entrada.peso_bruto)}</span>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Informacion de Entrada</span>
        </div>
        <div style={{ padding: 20 }}>
          <div className="d-grid">
            <div className="d-cell">
              <div className="d-label">No. Entrada</div>
              <div className="d-val mono">{entrada.cve_entrada}</div>
            </div>
            <div className="d-cell">
              <div className="d-label">Trafico</div>
              <div className="d-val mono">
                {entrada.trafico ? (
                  <Link href="/traficos" style={{ color: '#1A6BFF', textDecoration: 'none', fontWeight: 600 }}>
                    {fmtTrafico(entrada.trafico)}
                  </Link>
                ) : <span className="c-empty">&middot;</span>}
              </div>
            </div>
            <div className="d-cell">
              <div className="d-label">Proveedor</div>
              <div className="d-val">{proveedorName ? titleCase(proveedorName) : <span className="c-empty">&middot;</span>}</div>
            </div>
            <div className="d-cell">
              <div className="d-label">Fecha Llegada</div>
              <div className="d-val">{fmtDate(entrada.fecha_llegada_mercancia)}</div>
            </div>
            <div className="d-cell">
              <div className="d-label">Bultos Recibidos</div>
              <div className="d-val mono">{entrada.cantidad_bultos?.toLocaleString('es-MX') || ''}</div>
            </div>
            <div className="d-cell">
              <div className="d-label">Num. Pedido</div>
              <div className="d-val mono">{entrada.num_pedido || <span className="c-empty">&middot;</span>}</div>
            </div>
            <div className="d-cell">
              <div className="d-label">Peso Bruto</div>
              <div className="d-val mono">{fmtKg(entrada.peso_bruto)}</div>
            </div>
            <div className="d-cell">
              <div className="d-label">Peso Neto</div>
              <div className="d-val mono">{entrada.peso_neto ? fmtKg(entrada.peso_neto) : <span className="c-empty">&middot;</span>}</div>
            </div>
          </div>
        </div>
      </div>

      {entrada.descripcion_mercancia && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Mercancia</span>
          </div>
          <div style={{ padding: 20, fontSize: 15, fontWeight: 600, color: 'var(--n-900)' }}>
            {fmtDesc(entrada.descripcion_mercancia)}
          </div>
        </div>
      )}

      {(entrada.transportista_americano || entrada.transportista_mexicano) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Transportistas</span>
          </div>
          <div style={{ padding: 20 }}>
            <div className="d-grid">
              <div className="d-cell">
                <div className="d-label">Transp. Americano</div>
                <div className="d-val">{fmtCarrier(entrada.transportista_americano)}</div>
              </div>
              <div className="d-cell">
                <div className="d-label">Transp. Mexicano</div>
                <div className="d-val">{fmtCarrier(entrada.transportista_mexicano)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Revision de Recepcion</span>
        </div>
        <div style={{ padding: 20 }}>
          <div className="d-grid">
            <div className="d-cell">
              <div className="d-label">Faltantes</div>
              <div className="d-val"><BoolBadge value={entrada.tiene_faltantes} labelTrue="Si — Faltantes" labelFalse="Sin faltantes" /></div>
            </div>
            <div className="d-cell">
              <div className="d-label">Mercancia Danada</div>
              <div className="d-val"><BoolBadge value={entrada.mercancia_danada} labelTrue="Si — Dano" labelFalse="Sin dano" /></div>
            </div>
            <div className="d-cell">
              <div className="d-label">Facturas</div>
              <div className="d-val"><CheckBadge value={entrada.recibio_facturas} /></div>
            </div>
            <div className="d-cell">
              <div className="d-label">Packing List</div>
              <div className="d-val"><CheckBadge value={entrada.recibio_packing_list} /></div>
            </div>
          </div>
        </div>
      </div>

      {entrada.recibido_por && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Recibido Por</span>
          </div>
          <div style={{ padding: 20, fontSize: 14, fontWeight: 500, color: 'var(--n-800)' }}>{entrada.recibido_por}</div>
        </div>
      )}

      {(entrada.comentarios_faltantes || entrada.comentarios_danada || entrada.comentarios_generales) && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Comentarios</span>
          </div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entrada.comentarios_faltantes && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-t)', borderRadius: 'var(--r-md)', padding: 12, fontSize: 13, fontWeight: 600 }}>
                Faltantes: {entrada.comentarios_faltantes}
              </div>
            )}
            {entrada.comentarios_danada && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-t)', borderRadius: 'var(--r-md)', padding: 12, fontSize: 13, fontWeight: 600 }}>
                Dano: {entrada.comentarios_danada}
              </div>
            )}
            {entrada.comentarios_generales && (
              <div style={{ background: 'var(--n-50)', color: 'var(--n-700)', borderRadius: 'var(--r-md)', padding: 12, fontSize: 13 }}>
                {entrada.comentarios_generales}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
