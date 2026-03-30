'use client'

import { useEffect, useState, useMemo } from 'react'
import { Truck, DollarSign, AlertTriangle, ChevronRight, CheckCircle, Clock, Package, Shield, Activity } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { CLIENT_CLAVE, COMPANY_ID } from '@/lib/client-config'
import { fmtId, fmtUSDCompact, formatAbsoluteETA, formatAbsoluteDate, fmtDate } from '@/lib/format-utils'
import { AnimatedNumber } from '@/components/AnimatedNumber'
import { calculateCruzScore, extractScoreInput } from '@/lib/cruz-score'
import { CruzScore } from '@/components/cruz-score'
import { useIsMobile } from '@/hooks/use-mobile'
import { GOLD } from '@/lib/design-system'
import Link from 'next/link'

interface TraficoRow {
  trafico: string; estatus: string; fecha_llegada: string | null
  peso_bruto: number | null; importe_total: number | null
  pedimento: string | null; descripcion_mercancia: string | null
  proveedores: string | null; fecha_cruce: string | null
  fecha_pago: string | null; updated_at?: string
  [k: string]: unknown
}

const fmtUSD = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`

export default function Dashboard() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [entradas, setEntradas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'executive' | 'operations'>('operations')
  const [bridgeData, setBridgeData] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      fetch(`/api/data?table=traficos&trafico_prefix=${CLIENT_CLAVE}-&limit=1000&order_by=fecha_llegada&order_dir=desc`).then(r => r.json()),
      fetch(`/api/data?table=entradas&cve_cliente=${CLIENT_CLAVE}&limit=500&order_by=fecha_llegada_mercancia&order_dir=desc`).then(r => r.json()),
      fetch(`/api/data?table=bridge_intelligence&company_id=${COMPANY_ID}&limit=500`).then(r => r.json()).catch(() => ({ data: [] })),
    ]).then(([trafData, entData, bridgeRes]) => {
      setTraficos(trafData.data ?? [])
      setEntradas(entData.data ?? [])
      setBridgeData(bridgeRes.data ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // ── Computed values ──
  const enProceso = useMemo(() => traficos.filter(t => t.estatus === 'En Proceso'), [traficos])
  const cruzadosHoy = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return traficos.filter(t =>
      t.estatus === 'Cruzado' && (t.fecha_cruce?.startsWith(today) || t.updated_at?.startsWith(today))
    )
  }, [traficos])
  const urgentes = useMemo(() =>
    enProceso.filter(t => t.pedimento && calculateCruzScore(extractScoreInput(t)) < 50)
  , [enProceso])
  const valorEnProceso = useMemo(() =>
    enProceso.reduce((s, t) => s + (Number(t.importe_total) || 0), 0)
  , [enProceso])
  const incidencias = useMemo(() =>
    entradas.filter((e: any) => e.mercancia_danada || e.tiene_faltantes)
  , [entradas])
  const hasIssues = urgentes.length > 0 || incidencias.length > 0

  // ── Bridge averages ──
  const bridgeAvg = useMemo(() => {
    const bridges: Record<string, { total: number; count: number }> = {}
    bridgeData.forEach((b: any) => {
      const id = b.bridge_id || 'unknown'
      if (!bridges[id]) bridges[id] = { total: 0, count: 0 }
      bridges[id].total += Number(b.crossing_hours) || 0
      bridges[id].count++
    })
    return Object.entries(bridges).map(([id, d]) => ({
      id, name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      avgMinutes: Math.round((d.total / d.count) * 60),
    })).sort((a, b) => a.avgMinutes - b.avgMinutes)
  }, [bridgeData])

  // ── Action queue ──
  const actions = useMemo(() => {
    const items: { id: string; dot: string; title: string; sub: string; link: string }[] = []
    urgentes.slice(0, 3).forEach(t => {
      const score = calculateCruzScore(extractScoreInput(t))
      items.push({ id: `u-${t.trafico}`, dot: '#DC2626', title: `${fmtId(t.trafico)} — Score ${score}`, sub: `${t.pedimento ? 'Con pedimento' : 'Sin pedimento'} · ${formatAbsoluteDate(t.fecha_llegada)}`, link: `/traficos/${encodeURIComponent(t.trafico)}` })
    })
    incidencias.slice(0, 2).forEach((e: any) => {
      items.push({ id: `i-${e.cve_entrada}`, dot: '#D97706', title: `Entrada ${e.cve_entrada} — Incidencia`, sub: e.descripcion_mercancia?.substring(0, 40) || 'Faltantes reportados', link: `/entradas/${e.cve_entrada}` })
    })
    return items
  }, [urgentes, incidencias])

  // ── Next delivery ETA (most recent En Proceso with fecha_llegada) ──
  const nextDelivery = useMemo(() => {
    const sorted = enProceso.filter(t => t.fecha_llegada).sort((a, b) => (b.fecha_llegada || '').localeCompare(a.fecha_llegada || ''))
    return sorted[0] || null
  }, [enProceso])

  // ══════════════════════════════════
  // EXECUTIVE VIEW
  // ══════════════════════════════════
  const ExecutiveView = () => (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Status Card */}
      <div style={{
        background: hasIssues
          ? 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)'
          : 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
        borderLeft: `4px solid ${hasIssues ? 'var(--amber)' : 'var(--green)'}`,
        borderRadius: '0 var(--r-lg) var(--r-lg) 0',
        padding: '28px 32px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          {hasIssues
            ? <AlertTriangle size={28} style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 2 }} />
            : <CheckCircle size={28} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} />
          }
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: hasIssues ? '#92400E' : '#14532D', letterSpacing: '-0.02em' }}>
              {hasIssues ? 'Atención requerida' : 'Todo en orden'}
            </div>
            <div style={{ fontSize: 15, color: hasIssues ? '#92400E' : '#166534', marginTop: 6, lineHeight: 1.6 }}>
              {enProceso.length} embarque{enProceso.length !== 1 ? 's' : ''} en proceso
              {nextDelivery && <> · Próxima entrega: {formatAbsoluteETA(nextDelivery.fecha_llegada)}</>}
            </div>
            {hasIssues ? (
              <div style={{ fontSize: 13, color: '#92400E', marginTop: 4 }}>
                {urgentes.length > 0 && `${urgentes.length} tráfico${urgentes.length > 1 ? 's' : ''} requieren seguimiento`}
                {urgentes.length > 0 && incidencias.length > 0 && ' · '}
                {incidencias.length > 0 && `${incidencias.length} incidencia${incidencias.length > 1 ? 's' : ''} en bodega`}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#166534', marginTop: 4 }}>Sin incidencias activas</div>
            )}
          </div>
        </div>
      </div>

      {/* Shipment List */}
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--n-400)', marginBottom: 12 }}>
        Embarques Activos
      </div>
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 'var(--r-md)' }} />)}
        </div>
      ) : enProceso.length === 0 ? (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--r-lg)', padding: 32, textAlign: 'center' }}>
          <CheckCircle size={24} style={{ color: '#16A34A', margin: '0 auto 8px' }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#14532D' }}>Sin embarques activos</div>
          <div style={{ fontSize: 13, color: '#166534', marginTop: 4 }}>Todos los tráficos recientes han cruzado</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {enProceso.slice(0, 10).map(t => (
            <Link key={t.trafico} href={`/traficos/${encodeURIComponent(t.trafico)}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', background: 'var(--bg-card)', border: 'var(--b-default)',
                borderRadius: 'var(--r-md)', textDecoration: 'none', color: 'inherit',
                transition: 'background 0.15s', minHeight: 60,
              }}>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 15, color: 'var(--n-900)' }}>
                  {fmtId(t.trafico)}
                </span>
                <span style={{ fontSize: 13, color: 'var(--n-500)', marginLeft: 10 }}>
                  {(t.proveedores || t.descripcion_mercancia || '').substring(0, 30)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="badge badge-amber" style={{ height: 24, fontSize: 11 }}>
                  <span className="badge-dot" />En Proceso
                </span>
                <span style={{ fontSize: 12, color: 'var(--n-400)', fontFamily: 'var(--font-mono)' }}>
                  {formatAbsoluteDate(t.fecha_llegada)}
                </span>
                <ChevronRight size={14} style={{ color: 'var(--n-300)' }} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )

  // ══════════════════════════════════
  // OPERATIONS VIEW
  // ══════════════════════════════════
  const OperationsView = () => (
    <div>
      {/* Section A — KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        {[
          { label: 'En Proceso', value: enProceso.length, color: GOLD, sub: 'tráficos activos' },
          { label: 'Requieren Atención', value: urgentes.length, color: urgentes.length > 0 ? '#DC2626' : '#16A34A', sub: urgentes.length > 0 ? 'acción requerida' : 'todo en orden' },
          { label: 'Cruzados Hoy', value: cruzadosHoy.length, color: '#16A34A', sub: 'despachados' },
          { label: 'Valor en Proceso', value: valorEnProceso, color: 'var(--n-900)', sub: 'USD activo', format: fmtUSD },
        ].map((kpi, i) => (
          <div key={kpi.label} className="kpi-card" style={{ cursor: kpi.label === 'Requieren Atención' ? 'pointer' : undefined }}
            onClick={kpi.label === 'Requieren Atención' ? () => router.push('/traficos?filter=proceso') : undefined}>
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value" style={{ color: kpi.color }}>
              <AnimatedNumber value={kpi.value} format={kpi.format} duration={800} />
            </div>
            <div className="kpi-sub">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Section B — Action Queue */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <span className="card-title">Acciones Pendientes</span>
          <Link href="/alertas" style={{ fontSize: 13, color: 'var(--gold-700)', textDecoration: 'none', fontWeight: 700 }}>Ver todas →</Link>
        </div>
        {actions.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', background: '#F0FDF4', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
            <CheckCircle size={24} style={{ color: '#16A34A', margin: '0 auto 8px' }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#14532D' }}>Sin acciones urgentes</div>
            <div style={{ fontSize: 13, color: '#166534', marginTop: 4 }}>Todo bajo control</div>
          </div>
        ) : (
          <div style={{ padding: '0 16px 12px' }}>
            {actions.map(a => (
              <Link key={a.id} href={a.link} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0', borderBottom: '1px solid var(--n-100)',
                textDecoration: 'none', color: 'inherit',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.dot, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--n-900)' }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--n-500)', marginTop: 2 }}>{a.sub}</div>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--n-300)', flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Section C — Bridge Intelligence */}
      {bridgeAvg.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <span className="card-title">Puentes — Tiempo Promedio Cruce</span>
          </div>
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 10 }}>
            {bridgeAvg.slice(0, 4).map((b, i) => {
              const color = b.avgMinutes <= 20 ? '#16A34A' : b.avgMinutes <= 40 ? '#D97706' : '#DC2626'
              const isRecommended = i === 0 && b.avgMinutes <= 40
              return (
                <div key={b.id} style={{
                  padding: '14px 16px', borderRadius: 'var(--r-md)',
                  border: isRecommended ? '2px solid #16A34A' : 'var(--b-default)',
                  background: isRecommended ? '#F0FDF4' : 'var(--bg-card)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--n-500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {b.name}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color, fontFamily: 'var(--font-data)', marginTop: 4 }}>
                    {b.avgMinutes} min
                  </div>
                  {isRecommended && (
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Recomendado
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          {bridgeAvg.length > 0 && bridgeAvg[0].avgMinutes > 40 && (
            <div style={{ padding: '10px 16px', background: '#FFFBEB', borderTop: '1px solid #FDE68A', fontSize: 13, color: '#92400E', fontWeight: 600 }}>
              Congestión en todos los puentes · Considerar cruce nocturno
            </div>
          )}
        </div>
      )}

      {/* Section E — Recent Tráficos */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Tráficos Recientes</span>
          <Link href="/traficos" style={{ fontSize: 13, color: 'var(--gold-700)', textDecoration: 'none', fontWeight: 700 }}>Ver todos →</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th>Tráfico</th><th>Estado</th><th>Fecha</th><th style={{ textAlign: 'right' }}>Valor</th><th style={{ textAlign: 'center', width: 50 }}>Score</th>
            </tr></thead>
            <tbody>
              {loading && [0,1,2,3,4].map(i => (
                <tr key={i}><td><div className="skeleton" style={{ width: 100, height: 14 }} /></td><td><div className="skeleton" style={{ width: 80, height: 14 }} /></td><td><div className="skeleton" style={{ width: 60, height: 14 }} /></td><td><div className="skeleton" style={{ width: 60, height: 14, marginLeft: 'auto' }} /></td><td><div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%', margin: '0 auto' }} /></td></tr>
              ))}
              {!loading && traficos.slice(0, 8).map(t => {
                const score = calculateCruzScore(extractScoreInput(t))
                const isCruzado = (t.estatus || '').toLowerCase().includes('cruz')
                return (
                  <tr key={t.trafico} className={score < 50 && !isCruzado ? 'row-critical' : isCruzado ? 'row-healthy' : 'row-warning'}
                    onClick={() => router.push(`/traficos/${encodeURIComponent(t.trafico)}`)}>
                    <td>
                      <div className="c-id">{fmtId(t.trafico)}</div>
                      {t.pedimento && <div className="c-sub">PED {t.pedimento}</div>}
                    </td>
                    <td>
                      <span className={`badge ${isCruzado ? 'badge-green' : 'badge-amber'}`}>
                        <span className="badge-dot" />{isCruzado ? 'Cruzado' : t.estatus || 'En Proceso'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--n-500)', fontFamily: 'var(--font-mono)' }}>{formatAbsoluteDate(t.fecha_llegada)}</td>
                    <td className="c-num">{t.importe_total ? fmtUSD(Number(t.importe_total)) : <span style={{ color: 'var(--n-300)' }}>—</span>}</td>
                    <td style={{ textAlign: 'center' }}><CruzScore score={score} size="sm" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: isMobile ? 16 : 32 }}>
      {/* Role Toggle (testing) */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--n-100)', borderRadius: 'var(--r-pill)', padding: 3, width: 'fit-content' }}>
        {(['executive', 'operations'] as const).map(r => (
          <button key={r} onClick={() => setRole(r)} style={{
            padding: '6px 16px', borderRadius: 'var(--r-pill)', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700,
            background: role === r ? 'var(--bg-card)' : 'transparent',
            color: role === r ? 'var(--n-900)' : 'var(--n-500)',
            boxShadow: role === r ? 'var(--s-sm)' : 'none',
          }}>
            {r === 'executive' ? 'Ejecutivo' : 'Operaciones'}
          </button>
        ))}
      </div>

      {role === 'executive' ? <ExecutiveView /> : <OperationsView />}
    </div>
  )
}
