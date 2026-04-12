'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText } from 'lucide-react'
import { fmtId, fmtDate, fmtUSD, fmtDesc, fmtPedimentoShort } from '@/lib/format-utils'
import { EntityBreadcrumb } from '@/components/entity-breadcrumb'
import { useIsMobile } from '@/hooks/use-mobile'
import { fmtCarrier } from '@/lib/carrier-names'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { useSupplierNames } from '@/hooks/use-supplier-names'

interface PartidaRow {
  id?: number
  cve_trafico?: string
  numero_parte?: string | null
  descripcion?: string | null
  fraccion_arancelaria?: string | null
  fraccion?: string | null
  cantidad?: number | null
  cantidad_bultos?: number | null
  peso_bruto?: number | null
  valor_comercial?: number | null
  regimen?: string | null
}

interface EntradaRow {
  cve_entrada?: string
  num_talon?: string | null
  num_caja_trailer?: string | null
  cantidad_bultos?: number | null
  peso_bruto?: number | null
  fecha_llegada_mercancia?: string | null
}

interface FacturaRow {
  referencia?: string
  pedimento?: string | null
  proveedor?: string | null
  num_factura?: string | null
  valor_usd?: number | null
  dta?: number | null
  igi?: number | null
  iva?: number | null
  tipo_cambio?: number | null
  descripcion?: string | null
}

interface DocRow {
  id?: string
  document_type?: string | null
  doc_type?: string | null
  file_name?: string | null
}

function getStatus(estatus: string | undefined): 'Cruzado' | 'Pendiente' {
  if (!estatus) return 'Pendiente'
  return estatus.toLowerCase().includes('cruz') ? 'Cruzado' : 'Pendiente'
}

export default function TraficoDetailPage() {
  const { id } = useParams()
  const isMobile = useIsMobile()
  const { resolve: resolveSupplier } = useSupplierNames()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trafico, setTrafico] = useState<Record<string, any> | null>(null)
  const [partidas, setPartidas] = useState<PartidaRow[]>([])
  const [entradas, setEntradas] = useState<EntradaRow[]>([])
  const [facturas, setFacturas] = useState<FacturaRow[]>([])
  const [documents, setDocuments] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const tId = decodeURIComponent(String(id))

    Promise.all([
      fetch(`/api/trafico/${encodeURIComponent(tId)}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/data?table=globalpc_partidas&cve_trafico=${encodeURIComponent(tId)}&limit=500`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([tRes, partidasRes]) => {
      setTrafico(tRes.trafico ?? tRes.data ?? null)
      setEntradas(tRes.entradas ?? [])
      setFacturas(tRes.facturas ?? [])
      setDocuments(tRes.documents ?? [])
      setPartidas(Array.isArray(partidasRes.data) ? partidasRes.data : [])
      setLoading(false)
    }).catch(() => {
      setFetchError('No se pudo cargar el tráfico.')
      setLoading(false)
    })
  }, [id])

  const t = trafico
  const status = getStatus(t?.estatus)

  // Derived from facturas (the real data source)
  const facSummary = useMemo(() => {
    if (facturas.length === 0) return null
    const totalUSD = facturas.reduce((s, f) => s + (Number(f.valor_usd) || 0), 0)
    const totalDTA = facturas.reduce((s, f) => s + (Number(f.dta) || 0), 0)
    const totalIGI = facturas.reduce((s, f) => s + (Number(f.igi) || 0), 0)
    const totalIVA = facturas.reduce((s, f) => s + (Number(f.iva) || 0), 0)
    const proveedor = facturas.find(f => f.proveedor)?.proveedor || ''
    const numFactura = facturas.find(f => f.num_factura)?.num_factura || ''
    const descripcion = facturas.find(f => f.descripcion)?.descripcion || ''
    const tc = facturas.find(f => f.tipo_cambio)?.tipo_cambio || 0
    return { totalUSD, totalDTA, totalIGI, totalIVA, proveedor, numFactura, descripcion, tc }
  }, [facturas])

  // Resolve supplier name
  const supplierName = useMemo(() => {
    const raw = facSummary?.proveedor || String(t?.proveedores ?? '').split(',')[0]?.trim() || ''
    if (!raw) return ''
    return resolveSupplier(raw)
  }, [facSummary?.proveedor, t?.proveedores, resolveSupplier])

  // Best description
  const bestDescription = useMemo(() => {
    return t?.descripcion_mercancia || facSummary?.descripcion || ''
  }, [t?.descripcion_mercancia, facSummary?.descripcion])

  // Guía from entradas
  const guia = useMemo(() => {
    for (const e of entradas) {
      if (e.num_talon) return e.num_talon
      if (e.num_caja_trailer) return e.num_caja_trailer
    }
    return null
  }, [entradas])

  // Valor — prefer facturas sum, fallback to trafico field
  const valorUSD = facSummary?.totalUSD || Number(t?.importe_total) || 0

  if (loading) {
    return (
      <div className="page-shell" style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ padding: '20px 0' }}>
          <div className="skeleton-shimmer" style={{ width: 200, height: 24, borderRadius: 6, marginBottom: 16 }} />
          <div className="skeleton-shimmer" style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 16 }} />
          <div className="skeleton-shimmer" style={{ width: '100%', height: 300, borderRadius: 12 }} />
        </div>
      </div>
    )
  }

  if (fetchError || !t) {
    return (
      <div className="page-shell" style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Link href="/traficos" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 16 }}>
          <ArrowLeft size={14} /> Tráficos
        </Link>
        <ErrorCard message={fetchError || 'Tráfico no encontrado.'} onRetry={() => window.location.reload()} />
      </div>
    )
  }

  return (
    <div className="page-shell" style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Breadcrumb navigation */}
      <EntityBreadcrumb segments={[
        { label: 'TRÁFICOS', value: 'Lista', href: '/traficos' },
        { label: 'TRÁFICO', value: fmtId(String(t.trafico)), href: `/traficos/${encodeURIComponent(String(t.trafico))}` },
        ...(t.pedimento ? [{ label: 'PEDIMENTO', value: fmtPedimentoShort(String(t.pedimento)), href: `/pedimentos` }] : []),
      ]} />

      {/* Header card */}
      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', margin: 0 }}>
              {fmtId(String(t.trafico))}
            </h1>
            {supplierName && supplierName !== '—' && (
              <p style={{ fontSize: 14, fontWeight: 600, color: '#00E5FF', marginTop: 4, margin: '4px 0 0' }}>
                {supplierName}
              </p>
            )}
            {bestDescription && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, margin: '4px 0 0' }}>
                {fmtDesc(String(bestDescription))}
              </p>
            )}
          </div>
          <span className={`badge ${status === 'Cruzado' ? 'badge-cruzado' : 'badge-proceso'}`} style={{ fontSize: 13, padding: '6px 14px' }}>
            {status}
          </span>
        </div>
      </div>

      {/* Key stats grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 16,
      }}>
        {[
          { label: 'Valor', value: valorUSD > 0 ? `${fmtUSD(valorUSD)} USD` : '—', mono: true },
          { label: 'Pedimento', value: t.pedimento ? fmtPedimentoShort(String(t.pedimento)) : 'Pendiente', mono: true },
          { label: 'Fecha Llegada', value: t.fecha_llegada ? fmtDate(String(t.fecha_llegada)) : '—', mono: true },
          { label: 'Invoice', value: facSummary?.numFactura || String(t.facturas ?? '') || '—', mono: true },
          { label: 'Transporte MX', value: fmtCarrier(String(t.transportista_mexicano ?? '')) || '—', mono: false },
          { label: 'Régimen', value: String(t.regimen ?? 'A1'), mono: false },
          { label: 'Guía', value: guia || '—', mono: true },
          { label: 'Documentos', value: documents.length > 0 ? `${documents.length} archivo${documents.length !== 1 ? 's' : ''}` : '—', mono: false },
        ].map(stat => (
          <div key={stat.label} className="kpi-card" style={{ padding: '14px 16px' }}>
            <div className="kpi-card-label">{stat.label}</div>
            <div style={{
              fontSize: 14,
              fontWeight: stat.value === '—' || stat.value === 'Pendiente' ? 500 : 700,
              color: stat.value === '—' || stat.value === 'Pendiente' ? 'var(--text-muted)' : 'var(--text-primary)',
              fontStyle: stat.value === 'Pendiente' ? 'italic' : undefined,
              fontFamily: stat.mono && stat.value !== '—' && stat.value !== 'Pendiente' ? 'var(--font-mono)' : undefined,
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Financial breakdown from facturas */}
      {facSummary && facSummary.totalUSD > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
            Desglose Financiero
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: 12,
          }}>
            {[
              { label: 'Valor Comercial', value: fmtUSD(facSummary.totalUSD), suffix: ' USD' },
              { label: 'DTA', value: facSummary.totalDTA > 0 ? `$${facSummary.totalDTA.toLocaleString('es-MX')}` : '—', suffix: '' },
              { label: 'IGI', value: facSummary.totalIGI > 0 ? `$${facSummary.totalIGI.toLocaleString('es-MX')}` : '—', suffix: '' },
              { label: 'IVA', value: facSummary.totalIVA > 0 ? `$${facSummary.totalIVA.toLocaleString('es-MX')}` : '—', suffix: '' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginTop: 4 }}>
                  {item.value}{item.suffix}
                </div>
              </div>
            ))}
          </div>
          {facSummary.tc > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              T/C: {facSummary.tc.toFixed(4)} MXN/USD
            </div>
          )}
        </div>
      )}

      {/* Partidas table */}
      <div className="table-shell">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Partidas {partidas.length > 0 && <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>({partidas.length})</span>}
          </h2>
        </div>

        {partidas.length === 0 ? (
          <div style={{ padding: 20 }}>
            <EmptyState icon="📦" title="Sin partidas registradas" description="Las partidas aparecerán cuando se procese el pedimento." />
          </div>
        ) : isMobile ? (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {partidas.map((p, i) => (
              <div key={p.id ?? i} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {p.numero_parte || `Partida ${i + 1}`}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {p.fraccion_arancelaria || p.fraccion || '—'}
                  </span>
                </div>
                {p.descripcion && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.descripcion}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  <span>{status === 'Cruzado' ? 'Sí' : 'No'}</span>
                  {(p.cantidad_bultos ?? p.cantidad) ? <span>{p.cantidad_bultos ?? p.cantidad} btos</span> : null}
                  {p.peso_bruto ? <span>{Number(p.peso_bruto).toLocaleString('es-MX')} kg</span> : null}
                  {p.regimen && <span>{p.regimen}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="aduana-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Núm. de Parte</th>
                  <th style={{ width: 120 }}>Fracción</th>
                  <th style={{ width: 100 }}>Llegada</th>
                  <th style={{ width: 90 }}>Cruzó</th>
                  <th style={{ textAlign: 'right', width: 80 }}>Bultos</th>
                  <th style={{ textAlign: 'right', width: 100 }}>Peso (kg)</th>
                  <th style={{ width: 150 }}>Transporte MX</th>
                  <th style={{ width: 120 }}>Núm. de Guía</th>
                  <th style={{ width: 80 }}>Régimen</th>
                </tr>
              </thead>
              <tbody>
                {partidas.map((p, i) => (
                  <tr key={p.id ?? i} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {p.numero_parte || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {p.fraccion_arancelaria || p.fraccion || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {t.fecha_llegada ? fmtDate(String(t.fecha_llegada)) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <span className={`badge ${status === 'Cruzado' ? 'badge-cruzado' : 'badge-proceso'}`} style={{ fontSize: 11 }}>
                        {status === 'Cruzado' ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {p.cantidad_bultos ?? p.cantidad ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {p.peso_bruto ? Number(p.peso_bruto).toLocaleString('es-MX') : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {fmtCarrier(String(t.transportista_mexicano ?? '')) || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                      {guia || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {p.regimen || String(t.regimen ?? 'A1')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Documents summary */}
      {documents.length > 0 && (
        <div className="card" style={{ padding: 20, marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 12 }}>
            Expediente Digital ({documents.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {documents.map((doc, i) => {
              const docType = (doc.document_type || doc.doc_type || 'Documento').replace(/_/g, ' ')
              return (
                <div key={doc.id ?? i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'var(--text-secondary)',
                }}>
                  <FileText size={12} style={{ color: 'var(--text-muted)' }} />
                  {docType}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Entradas linked */}
      {entradas.length > 0 && (
        <div className="table-shell" style={{ marginTop: 16 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Entradas vinculadas <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>({entradas.length})</span>
            </h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="aduana-table">
              <thead>
                <tr>
                  <th>Entrada</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Bultos</th>
                  <th style={{ textAlign: 'right' }}>Peso (kg)</th>
                  <th>Guía</th>
                </tr>
              </thead>
              <tbody>
                {entradas.map((e, i) => (
                  <tr key={e.cve_entrada ?? i} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {e.cve_entrada || '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {e.fecha_llegada_mercancia ? fmtDate(e.fecha_llegada_mercancia) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {e.cantidad_bultos ?? '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                      {e.peso_bruto ? Number(e.peso_bruto).toLocaleString('es-MX') : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                      {e.num_talon || e.num_caja_trailer || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, color: 'var(--text-muted)' }}>
        Renato Zapata &amp; Company · Patente 3596 · Aduana 240
      </div>
    </div>
  )
}
