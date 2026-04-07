'use client'

import { useEffect, useState } from 'react'

const T = {
  surface: 'var(--card-bg)', surfaceAlt: 'var(--bg-main)', border: 'var(--border)',
  text: 'var(--text-primary)', textSub: 'var(--text-secondary)', textMuted: '#999999',
  navy: '#FFF8EB', gold: 'var(--gold-dark)', goldBg: '#FFF8EB',
  green: 'var(--success)', greenBg: '#EAF3DE',
  amber: 'var(--gold-dark)', amberBg: '#FEF9C3',
  red: 'var(--danger-500)', redBg: '#FEF2F2',
  blue: 'var(--info)', blueBg: '#EFF6FF',
  shadow: '0 4px 16px rgba(0,0,0,0.08)',
}

function fmtUSD(v: string | number | null | undefined) { return '$' + Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) }
function fmtNum(v: string | number | null | undefined) { return Number(v || 0).toLocaleString('es-MX') }
function fmtDate(v: string | number | null | undefined) {
  if (!v) return ''
  return new Date(v).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_CFG: Record<string, { color: string; bg: string }> = {
  'En Proceso': { color: 'var(--amber-text, #92400E)', bg: '#FEF3C7' },
  'Cruzado':    { color: 'var(--success-dark, #166534)', bg: '#DCFCE7' },
  'Detenido':   { color: 'var(--danger-text, #991B1B)', bg: '#FEE2E2' },
}

export function TraficoDetail({ traficoId, onClose }: { traficoId: string; onClose: () => void }) {
  interface FacturaItem { pedimento?: string; referencia?: string; valor_usd?: number; proveedor?: string; tipo_cambio?: number; dta?: number; igi?: number; iva?: number }
  interface EntradaItem { cve_entrada?: string; fecha_llegada_mercancia?: string; descripcion_mercancia?: string; bultos?: number; peso_bruto?: number; transporte?: string; guia?: string; cantidad_bultos?: number; tiene_faltantes?: boolean; mercancia_danada?: boolean }
  interface DocItem { doc_type?: string; doc_name?: string; file_url?: string }
  interface TraficoData { trafico?: string; estatus?: string; pedimento?: string; descripcion_mercancia?: string; fecha_llegada?: string; fecha_pago?: string; fecha_cruce?: string; peso_bruto?: number; importe_total?: number; proveedor?: string; tipo_cambio?: number; transportista_extranjero?: string; transportista_mexicano?: string; embarque?: string; oficina?: string }
  const [data, setData] = useState<{ trafico?: TraficoData; facturas?: FacturaItem[]; entradas?: EntradaItem[]; documents?: DocItem[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetch(`/api/trafico/${traficoId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [traficoId])

  const t = data?.trafico
  const facturas = data?.facturas || []
  const entradas = data?.entradas || []
  const documents = data?.documents || []
  const totalValor = facturas.reduce((s: number, f: FacturaItem) => s + (f.valor_usd || 0), 0)
  const totalGravamen = facturas.reduce((s: number, f: FacturaItem) =>
    s + (f.dta || 0) + (f.igi || 0) + (f.iva || 0), 0)
  const status = t?.estatus ?? ''
  const statusCfg = STATUS_CFG[status] || { color: T.textMuted, bg: T.surfaceAlt }

  const TABS = ['overview', 'facturas', 'entradas', 'documentos']

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 100, backdropFilter: 'blur(2px)' }} />

      {/* Panel */}
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 560,
        background: T.surface, boxShadow: T.shadow, zIndex: 101,
        display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-geist-sans)',
        animation: 'slideIn 0.2s ease-out' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`,
          background: T.navy, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700 }}>
                {traficoId}
              </div>
              {t && (
                <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 3 }}>
                  {t.descripcion_mercancia?.substring(0, 50) || ''}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {status && (
                <span style={{ background: statusCfg.bg, color: statusCfg.color,
                  borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                  {status}
                </span>
              )}
              <button onClick={onClose}
                style={{ background: '#F5F3EF', border: 'none',
                  borderRadius: 6, width: 28, height: 28, color: 'var(--text-primary)',
                  fontSize: 16, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center' }}>x</button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`,
          background: T.surface, flexShrink: 0 }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{ flex: 1, padding: '10px 0', background: 'none',
                border: 'none', borderBottom: activeTab === tab ? '2px solid #BA7517' : '2px solid transparent',
                color: activeTab === tab ? 'var(--gold-dark)' : T.textMuted,
                fontSize: 12, fontWeight: activeTab === tab ? 700 : 400,
                cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
                transition: 'all 0.15s' }}>
              {tab}
              {tab === 'facturas' && facturas.length > 0 &&
                <span style={{ marginLeft: 5, background: '#FAEEDA', color: 'var(--gold-dark)',
                  borderRadius: 99, padding: '1px 5px', fontSize: 9 }}>{facturas.length}</span>}
              {tab === 'entradas' && entradas.length > 0 &&
                <span style={{ marginLeft: 5, background: T.gold, color: 'var(--text-primary)',
                  borderRadius: 99, padding: '1px 5px', fontSize: 9 }}>{entradas.length}</span>}
              {tab === 'documentos' &&
                <span style={{ marginLeft: 5, background: documents.length > 0 ? T.green : T.red,
                  color: 'var(--text-primary)', borderRadius: 99, padding: '1px 5px', fontSize: 9 }}>{documents.length}</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${T.border}`,
                borderTopColor: T.navy, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : (
            <>
              {/* OVERVIEW */}
              {activeTab === 'overview' && t && (
                <div>
                  {/* KPIs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                    {[
                      { label: 'Valor Total USD', value: fmtUSD(totalValor), color: T.navy },
                      { label: 'Gravamen Total', value: fmtUSD(totalGravamen), color: T.textSub },
                      { label: 'Peso Bruto', value: t.peso_bruto ? `${fmtNum(t.peso_bruto)} kg` : '—', color: T.navy },
                      { label: 'Fecha Llegada', value: fmtDate(t.fecha_llegada), color: T.textSub },
                    ].map(k => (
                      <div key={k.label} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`,
                        borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 700,
                          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5 }}>{k.label}</div>
                        <div style={{ color: k.color, fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)' }}>{k.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Details */}
                  {[
                    { label: 'Pedimento', value: t.pedimento },
                    { label: 'Transportista Ext.', value: t.transportista_extranjero },
                    { label: 'Transportista Mex.', value: t.transportista_mexicano },
                    { label: 'Importe Total', value: t.importe_total ? fmtUSD(t.importe_total) : null },
                    { label: 'Embarque', value: t.embarque },
                    { label: 'Oficina', value: t.oficina },
                  ].filter(d => d.value).map(d => (
                    <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between',
                      padding: '9px 0', borderBottom: `1px solid ${T.border}` }}>
                      <span style={{ color: T.textMuted, fontSize: 12 }}>{d.label}</span>
                      <span style={{ color: T.text, fontSize: 12, fontWeight: 500 }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* FACTURAS */}
              {activeTab === 'facturas' && (
                facturas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: T.textMuted }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                    Sin facturas registradas
                  </div>
                ) : (
                  <div>
                    {facturas.map((f: FacturaItem, i: number) => (
                      <div key={i} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`,
                        borderRadius: 8, padding: 14, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ color: T.navy, fontSize: 13, fontWeight: 700 }}>
                            {f.pedimento || f.referencia || `Factura ${i+1}`}
                          </span>
                          <span style={{ color: T.text, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtUSD(f.valor_usd)}</span>
                        </div>
                        <div style={{ color: T.textSub, fontSize: 11, marginBottom: 4 }}>{f.proveedor}</div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          <span style={{ color: T.textMuted, fontSize: 11 }}>T/C: ${Number(f.tipo_cambio || 0).toFixed(4)}</span>
                          <span style={{ color: T.textMuted, fontSize: 11, fontFamily: 'var(--font-jetbrains-mono)' }}>DTA: {fmtUSD(f.dta)}</span>
                          <span style={{ color: (f.igi || 0) === 0 ? T.green : T.textMuted, fontSize: 11, fontFamily: 'var(--font-jetbrains-mono)' }}>
                            IGI: {(f.igi || 0) === 0 ? 'T-MEC' : fmtUSD(f.igi)}
                          </span>
                          <span style={{ color: T.textMuted, fontSize: 11, fontFamily: 'var(--font-jetbrains-mono)' }}>IVA: {fmtUSD(f.iva)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* ENTRADAS */}
              {activeTab === 'entradas' && (
                entradas.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: T.textMuted }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                    Sin entradas registradas
                  </div>
                ) : (
                  <div>
                    {entradas.map((e: EntradaItem, i: number) => (
                      <div key={i} style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`,
                        borderRadius: 8, padding: 12, marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ color: T.blue, fontSize: 12, fontWeight: 700 }}>{e.cve_entrada}</span>
                          <span style={{ color: T.textMuted, fontSize: 11 }}>{fmtDate(e.fecha_llegada_mercancia)}</span>
                        </div>
                        <div style={{ color: T.text, fontSize: 12, marginBottom: 4 }}>
                          {e.descripcion_mercancia?.substring(0, 60) || ''}
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <span style={{ color: T.textMuted, fontSize: 11 }}>{e.cantidad_bultos || '?'} bultos</span>
                          <span style={{ color: T.textMuted, fontSize: 11 }}>{fmtNum(e.peso_bruto)} kg</span>
                          {e.tiene_faltantes && <span style={{ color: T.red, fontSize: 11, fontWeight: 700 }}>Faltantes</span>}
                          {e.mercancia_danada && <span style={{ color: T.red, fontSize: 11, fontWeight: 700 }}>Daños</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* DOCUMENTOS */}
              {activeTab === 'documentos' && (
                <div>
                  {documents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: T.textMuted }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Sin documentos</div>
                      <div style={{ fontSize: 12 }}>Sube documentos en la vista Expedientes</div>
                    </div>
                  ) : (
                    documents.map((d: DocItem, i: number) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${T.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14 }}>📄</span>
                          <div>
                            <div style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{d.doc_type}</div>
                            <div style={{ color: T.textMuted, fontSize: 10 }}>{d.doc_name}</div>
                          </div>
                        </div>
                        {d.file_url && (
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer"
                            style={{ color: T.navy, fontSize: 11, fontWeight: 600,
                              textDecoration: 'none', background: T.surfaceAlt,
                              border: `1px solid ${T.border}`, borderRadius: 6,
                              padding: '4px 10px' }}>Ver</a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
