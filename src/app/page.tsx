'use client'

import { useEffect, useState, useMemo } from 'react'
import { Truck, DollarSign, FileText, Package, Shield, Clock, AlertTriangle, ArrowRight } from 'lucide-react'
import { CLIENT_CLAVE } from '@/lib/client-config'
import { fmtId } from '@/lib/format-utils'
import TraficoDrawer from '@/components/TraficoDrawer'
import Link from 'next/link'

interface TraficoRow { trafico: string; estatus: string; fecha_llegada: string | null; peso_bruto: number | null; importe_total: number | null; pedimento: string | null; descripcion_mercancia: string | null; updated_at?: string; [k: string]: unknown }
interface Proveedor { proveedor: string; total: number }

const fmtUSD = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`
const fmtDate = (s: string | null) => { if (!s) return '-'; try { return new Date(s).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) } catch { return '-' } }
const fmtRelative = (s: string | null) => {
  if (!s) return '-'
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 86400000)
  if (d === 0) return 'hoy'
  if (d === 1) return 'ayer'
  if (d < 7) return `hace ${d}d`
  return fmtDate(s)
}

export default function Dashboard() {
  const [traficos, setTraficos] = useState<TraficoRow[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [entradas, setEntradas] = useState<any[]>([])
  const [selected, setSelected] = useState<TraficoRow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/data?table=traficos&trafico_prefix=${CLIENT_CLAVE}-&limit=1000&order_by=fecha_llegada&order_dir=desc`).then(r => r.json()),
      fetch(`/api/data?table=aduanet_facturas&clave_cliente=${CLIENT_CLAVE}&limit=5000`).then(r => r.json()),
      fetch(`/api/data?table=entradas&limit=500&order_by=fecha_llegada_mercancia&order_dir=desc`).then(r => r.json()),
    ]).then(([trafData, factData, entData]) => {
      const rows = trafData.data ?? []
      setTraficos(rows)
      setEntradas(entData.data ?? [])
      const map: Record<string, number> = {}
      ;(factData.data ?? []).forEach((r: any) => { if (r.proveedor) map[r.proveedor] = (map[r.proveedor] || 0) + (Number(r.valor_usd) || 0) })
      setProveedores(Object.entries(map).sort(([,a],[,b]) => b - a).slice(0, 6).map(([proveedor, total]) => ({ proveedor, total })))
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // KPI data
  const kpi = useMemo(() => {
    if (traficos.length === 0) return null
    return {
      total: traficos.length,
      valor: traficos.reduce((s, r) => s + (Number(r.importe_total) || 0), 0),
      pedimentos: traficos.filter(r => r.pedimento).length,
      entradas: entradas.length,
    }
  }, [traficos, entradas])

  // MVE countdown
  const mveDays = Math.max(0, Math.ceil((new Date('2026-03-31').getTime() - Date.now()) / 86400000))

  // Activity feed — derive from traficos + entradas
  const activity = useMemo(() => {
    const items: { icon: any; color: string; text: string; time: string; date: string; highlight?: boolean }[] = []
    traficos.slice(0, 20).forEach(t => {
      const isCruz = (t.estatus || '').toLowerCase().includes('cruz')
      items.push({
        icon: isCruz ? Shield : Truck,
        color: isCruz ? 'var(--status-green)' : 'var(--status-blue)',
        text: `${fmtId(t.trafico)} — ${t.estatus || 'En Proceso'}`,
        time: fmtRelative(t.fecha_llegada), date: t.fecha_llegada || '',
      })
    })
    entradas.slice(0, 10).forEach((e: any) => {
      const hasIssue = e.mercancia_danada || e.tiene_faltantes
      items.push({
        icon: hasIssue ? AlertTriangle : Package,
        color: hasIssue ? 'var(--status-red)' : 'var(--amber-600)',
        text: `Entrada ${e.cve_entrada} — ${hasIssue ? 'Incidencia' : 'Recibida'}`,
        time: fmtRelative(e.fecha_llegada_mercancia), date: e.fecha_llegada_mercancia || '',
        highlight: hasIssue,
      })
    })
    return items.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10)
  }, [traficos, entradas])

  const maxProv = proveedores[0]?.total ?? 1

  const kpiCards = [
    { label: 'Tráficos Activos', value: kpi ? kpi.total.toLocaleString('es-MX') : '-', sub: 'Total cargados', icon: Truck, hero: true },
    { label: 'Valor Importado', value: kpi ? fmtUSD(kpi.valor) : '-', sub: 'Acumulado USD', icon: DollarSign, hero: true },
    { label: 'Pedimentos', value: kpi ? kpi.pedimentos.toLocaleString() : '-', sub: 'Con pedimento', icon: FileText, hero: false },
    { label: 'Entradas', value: kpi ? kpi.entradas.toLocaleString() : '-', sub: 'Remesas bodega', icon: Package, hero: false },
  ]

  return (
    <div style={{ padding: 32 }}>
      {/* Hero — MVE Countdown */}
      {mveDays <= 30 && (
        <div className={`card anim-0 ${mveDays <= 4 ? 'a-critical' : mveDays <= 10 ? 'a-warning' : 'a-info'}`} style={{ marginBottom: 24, borderLeft: `4px solid ${mveDays <= 4 ? 'var(--status-red)' : mveDays <= 10 ? 'var(--status-yellow)' : 'var(--amber-500)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div className="mono" style={{ fontSize: 64, fontWeight: 600, color: mveDays <= 4 ? 'var(--status-red)' : 'var(--text-primary)', lineHeight: 1 }}>{mveDays}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Días restantes — MVE</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Fecha límite: 31 marzo 2026</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Mercancía en Virtual Export requiere declaración antes del deadline</div>
            </div>
          </div>
          <Link href="/mve" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 24px', borderRadius: 8, background: 'var(--amber-100)', border: '1px solid var(--border-primary)', color: 'var(--amber-600)', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
            Ver cumplimiento <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* KPI Row */}
      <div className="kpi-grid anim-1">
        {kpiCards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className="kpi-card">
              <div className="kpi-label">{card.label}</div>
              <div className="kpi-value" style={card.hero ? { fontSize: 36 } : undefined}>{card.value}</div>
              <div className="kpi-sub">{card.sub}</div>
              <div className="kpi-icon"><Icon size={16} /></div>
            </div>
          )
        })}
      </div>

      {/* Top Proveedores — full width bar chart */}
      {proveedores.length > 0 && (
        <div className="card anim-2" style={{ marginBottom: 16, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--amber-700)', marginBottom: 16 }}>Top Proveedores</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {proveedores.map(p => (
              <div key={p.proveedor}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{p.proveedor}</span>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--text-primary)', flexShrink: 0 }}>${(p.total / 1_000_000).toFixed(1)}M</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--border-light)' }}>
                  <div style={{ width: `${(p.total / maxProv) * 100}%`, height: '100%', borderRadius: 2, background: 'var(--amber-500)', transition: 'width 500ms ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }} className="anim-2">
        {/* LEFT — Tráficos Recientes */}
        <div className="card">
          <div className="card-head">
            <span className="card-title">Tráficos Recientes</span>
            <Link href="/traficos" style={{ fontSize: 14, color: 'var(--amber-600)', textDecoration: 'none' }}>Ver todos &rarr;</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr>
                <th>Tráfico</th><th>Fecha</th><th style={{ textAlign: 'right' }}>Peso</th><th>Estado</th>
              </tr></thead>
              <tbody>
                {loading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td><div className="skel" style={{ width: 100, height: 14 }} /></td><td><div className="skel" style={{ width: 60, height: 14 }} /></td><td><div className="skel" style={{ width: 50, height: 14, marginLeft: 'auto' }} /></td><td><div className="skel" style={{ width: 70, height: 14 }} /></td></tr>
                ))}
                {!loading && traficos.slice(0, 10).map(t => (
                  <tr key={t.trafico} onClick={() => setSelected(t)}>
                    <td>
                      <div className="c-id">{fmtId(t.trafico)}</div>
                      {t.pedimento && <div className="c-sub">PED {t.pedimento}</div>}
                    </td>
                    <td className="c-mono">{fmtDate(t.fecha_llegada)}</td>
                    <td className="c-num">{t.peso_bruto ? `${Number(t.peso_bruto).toLocaleString('es-MX')}` : '-'}</td>
                    <td>
                      <span className={`status ${(t.estatus || '').toLowerCase().includes('cruz') ? 's-cruzado' : 's-proceso'}`}>
                        <span className="s-dot" />{(t.estatus || '').includes('Cruz') ? 'Cruzado' : 'En Proceso'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Activity Feed */}
          <div className="card" style={{ maxHeight: 320 }}>
            <div className="card-head">
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--amber-700)' }}>Actividad Reciente</span>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 260 }}>
              {activity.map((a, i) => {
                const Icon = a.icon
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border-light)', borderLeft: a.highlight ? '3px solid var(--status-red)' : '3px solid transparent' }}>
                    <Icon size={14} style={{ color: a.color, flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{a.text}</div>
                    </div>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{a.time}</span>
                  </div>
                )
              })}
              {activity.length === 0 && <div style={{ padding: 24, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>Sin actividad reciente</div>}
            </div>
          </div>

          {/* Bridge Summary */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--amber-700)', marginBottom: 12 }}>Estado de Puentes</div>
            {[
              { name: 'World Trade Bridge', type: 'Comercial', status: 'green' },
              { name: 'Puente Colombia', type: 'Comercial', status: 'green' },
              { name: 'Puente Juarez-Lincoln', type: 'Mixto', status: 'yellow' },
              { name: 'Gateway to Americas', type: 'Pasajero', status: 'green' },
            ].map(b => (
              <div key={b.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                <div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.type}</div>
                </div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.status === 'green' ? 'var(--status-green)' : b.status === 'yellow' ? 'var(--status-yellow)' : 'var(--status-red)' }} />
              </div>
            ))}
            <Link href="/soia" style={{ display: 'block', textAlign: 'center', marginTop: 12, fontSize: 14, color: 'var(--amber-600)', textDecoration: 'none' }}>Ver SOIA &rarr;</Link>
          </div>
        </div>
      </div>

      {selected && <TraficoDrawer trafico={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
