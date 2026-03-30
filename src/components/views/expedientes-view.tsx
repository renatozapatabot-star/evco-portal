'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const PAGE = 25

const T = {
  bg: '#FAFAF8', surface: '#FFFFFF', border: '#E8E6E0', surfaceAlt: '#F5F3EF',
  text: '#1A1A1A', textSub: '#6B6B6B', textMuted: '#999999',
  navy: '#BA7517', gold: '#BA7517', goldBg: '#FFF8EB',
  green: '#16A34A', greenBg: '#EAF3DE',
  amber: '#854D0E', amberBg: '#FEF9C3',
  red: '#DC2626', redBg: '#FEF2F2',
  shadow: '0 1px 3px rgba(0,0,0,0.07)',
}

const EXPECTED_DOCS = 10 // realistic target per trafico
function pct(docs: number) { return Math.min(100, Math.round((docs / EXPECTED_DOCS) * 100)) }
function pctColor(p: number) { return p >= 100 ? '#16A34A' : p >= 50 ? '#D4952A' : p >= 1 ? '#CA8A04' : '#999999' }

function DocBar({ docs, pedimento }: { docs: number; pedimento: string | null }) {
  // No pedimento assigned yet — not a completeness problem
  if (!pedimento) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ background: '#E8E6E0', color: '#6B6B6B', fontSize: 10, fontWeight: 600,
          borderRadius: 20, padding: '2px 10px' }}>Sin pedimento</span>
      </div>
    )
  }
  // Has pedimento but no docs yet — pending sync
  if (docs === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 5, background: T.border, borderRadius: 99, overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 99,
            background: 'linear-gradient(90deg, #E8E6E0 25%, #F5F3EF 50%, #E8E6E0 75%)',
            backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
        </div>
        <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 600, minWidth: 52 }}>Pendiente</span>
      </div>
    )
  }
  const p = pct(docs)
  const color = pctColor(p)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: T.border, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: 99 }} />
      </div>
      <span style={{ color, fontSize: 11, fontWeight: 700, minWidth: 32 }}>{p}%</span>
    </div>
  )
}

export function ExpedientesView() {
  const [traficos, setTraficos] = useState<any[]>([])
  const router = useRouter()
  const [documents, setDocuments] = useState<Record<string, string[]>>({})
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    // Query traficos directly — 9254-% covers all EVCO tráficos
    let q = supabase.from('traficos')
      .select('trafico, pedimento, estatus, fecha_llegada, descripcion_mercancia, proveedores, importe_total', { count: 'exact' })
      .ilike('trafico', '9254-%')
      .order('created_at', { ascending: false })
      .range(page * PAGE, (page + 1) * PAGE - 1)
    if (search) q = q.ilike('trafico', `%${search}%`)
    const { data: rawData, count } = await q

    const ids = (rawData || []).map(r => r.trafico)

    const data = (rawData || []).map(r => ({
      trafico: r.trafico,
      estatus: r.estatus || 'En Proceso',
      fecha_llegada: r.fecha_llegada,
      descripcion_mercancia: `${r.descripcion_mercancia || ''} · $${r.importe_total?.toLocaleString() || '0'}`,
      pedimento_num: r.pedimento || null,
    }))
    setTraficos(data)
    setTotal(count || 0)

    // Load documents — query BOTH tables and merge
    if (ids.length > 0) {
      const [r1, r2] = await Promise.all([
        supabase.from('documents')
          .select('trafico_id, document_type')
          .in('trafico_id', ids),
        supabase.from('expediente_documentos')
          .select('trafico_id, doc_type')
          .in('trafico_id', ids)
      ])

      const map: Record<string, string[]> = {}
      ;(r1.data || []).forEach((d: any) => {
        if (!map[d.trafico_id]) map[d.trafico_id] = []
        if (d.document_type && !map[d.trafico_id].includes(d.document_type))
          map[d.trafico_id].push(d.document_type)
      })
      ;(r2.data || []).forEach((d: any) => {
        if (!map[d.trafico_id]) map[d.trafico_id] = []
        if (d.doc_type && !map[d.trafico_id].includes(d.doc_type))
          map[d.trafico_id].push(d.doc_type)
      })

      setDocuments(map)
    }
    setLoading(false)
  }, [page, search])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search])

  return (
    <div style={{ padding: '24px 28px', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>Expedientes Digitales</h2>
          <p style={{ color: T.textMuted, fontSize: 12, margin: '4px 0 0' }}>
            {total.toLocaleString()} tráficos activos
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, fontSize: 14 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tráfico..."
            style={{ paddingLeft: 32, paddingRight: 12, height: 36, border: `1px solid ${T.border}`,
              borderRadius: 8, background: T.surface, color: T.text, fontSize: 13, outline: 'none',
              width: 200, fontFamily: 'inherit' }} />
        </div>
      </div>

      <div className="card">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 28, height: 28, border: `3px solid ${T.border}`, borderTopColor: T.navy,
                borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : traficos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <FolderOpen size={32} strokeWidth={1.5} style={{ color: 'var(--n-300)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--n-700)', marginBottom: 4 }}>Sin expedientes</div>
              <div style={{ fontSize: 13, color: 'var(--n-400)' }}>Los expedientes vinculados aparecerán aquí</div>
            </div>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Trafico</th>
                    <th>Estado</th>
                    <th>Documentos</th>
                    <th>Completitud</th>
                  </tr>
                </thead>
                <tbody>
                  {[...traficos].sort((a, b) => {
                    // En Proceso first
                    const aActive = a.estatus === 'Cruzado' ? 1 : 0
                    const bActive = b.estatus === 'Cruzado' ? 1 : 0
                    if (aActive !== bActive) return aActive - bActive
                    // Lowest doc count first
                    const aDocs = (documents[a.trafico] || []).length
                    const bDocs = (documents[b.trafico] || []).length
                    return aDocs - bDocs
                  }).map((t) => {
                    const docs = documents[t.trafico] || []
                    const docCount = docs.length
                    return (
                      <tr key={t.trafico} onClick={() => router.push(`/traficos/${t.trafico}`)}
                        className="expediente-row">
                        <td>
                          <span className="c-id">{t.trafico}</span>
                          <div style={{ color: 'var(--n-400)', fontSize: 11, marginTop: 2 }}>
                            {t.fecha_llegada ? new Date(t.fecha_llegada).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : ''}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${t.estatus === 'Cruzado' ? 'badge-cruzado' : t.estatus === 'Detenido' ? 'badge-hold' : 'badge-proceso'}`}>
                            <span className="badge-dot" />{t.estatus}
                          </span>
                        </td>
                        <td>
                          {t.pedimento_num
                            ? <span className="c-num" style={{ textAlign: 'left' }}>{docCount}<span style={{ color: 'var(--n-400)', fontWeight: 400 }}>/{EXPECTED_DOCS}</span></span>
                            : ''
                          }
                        </td>
                        <td style={{ minWidth: 160 }}>
                          <DocBar docs={docCount} pedimento={t.pedimento_num} />
                          {docCount > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                              {docs.slice(0, 4).map((dtype: string) => (
                                <span key={dtype} style={{ fontSize: 11, fontWeight: 600,
                                  padding: '2px 8px', borderRadius: 'var(--r-sm, 4px)',
                                  background: 'var(--n-50, #F9F9F8)', border: '1px solid var(--n-100, #E8E6E0)',
                                  color: 'var(--n-600, #6B6B6B)', whiteSpace: 'nowrap' }}>
                                  {dtype.replace(/_/g, ' ')}
                                </span>
                              ))}
                              {docs.length > 4 && (
                                <span style={{ fontSize: 9, color: T.textMuted, padding: '1px 4px' }}>
                                  +{docs.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {Math.ceil(total / PAGE) > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: `1px solid ${T.border}` }}>
                  <span style={{ color: T.textMuted, fontSize: 12 }}>{(page*PAGE+1).toLocaleString()}–{Math.min((page+1)*PAGE, total).toLocaleString()} de {total.toLocaleString()}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[['← Ant.', page-1, page===0], ['Sig. →', page+1, page>=Math.ceil(total/PAGE)-1]].map(([l,n,d]: any) => (
                      <button key={String(l)} onClick={() => !d && setPage(n)} disabled={d}
                        style={{ border: `1px solid ${T.border}`, background: d ? T.surfaceAlt : T.surface,
                          borderRadius: 6, padding: '5px 12px', cursor: d ? 'default' : 'pointer',
                          color: d ? T.textMuted : T.text, fontSize: 12, fontFamily: 'inherit' }}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } } .expediente-row { cursor: pointer; transition: background 0.15s ease; } .expediente-row:hover { background: #FFF8EB !important; }`}</style>
    </div>
  )
}
