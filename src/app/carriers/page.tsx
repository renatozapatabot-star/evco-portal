'use client'

import { useEffect, useState } from 'react'
import { Truck, Clock, TrendingUp, AlertTriangle, ChevronRight, X } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

interface Carrier {
  name: string
  shipments: number
  cruzados: number
  avg_peso: number
  faltantes_rate: number
  danos_rate: number
  completion_rate: number
  score: number
  crossing_avg_hours?: number
  crossing_avg_days?: number
}

function scoreColor(s: number) { return s >= 90 ? '#166534' : s >= 70 ? 'var(--amber-text, #92400E)' : 'var(--danger-text, #991B1B)' }
function scoreBg(s: number) { return s >= 90 ? '#DCFCE7' : s >= 70 ? '#FEF3C7' : '#FEE2E2' }

export default function CarriersPage() {
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [crossingData, setCrossingData] = useState<{ averages?: { overall?: { days?: number }; by_carrier?: { name: string; avgHours: number; avgDays: number }[] }; fastest_day?: string; slowest_day?: string; recommended_arrival_day?: string } | null>(null)
  const [selected, setSelected] = useState<Carrier | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/carriers').then(r => r.json()),
      fetch('/api/crossing-prediction').then(r => r.json()).catch(() => null),
    ]).then(([carrierData, crossing]) => {
      const carrierList = carrierData.carriers || []
      setCrossingData(crossing)

      // Merge crossing times into carrier data
      const crossingByCarrier: Record<string, { avgHours: number; avgDays: number }> = {}
      ;(crossing?.averages?.by_carrier || []).forEach((c: { name: string; avgHours: number; avgDays: number }) => {
        crossingByCarrier[c.name] = { avgHours: c.avgHours, avgDays: c.avgDays }
      })

      const merged = carrierList.map((c: Carrier) => ({
        ...c,
        crossing_avg_hours: crossingByCarrier[c.name]?.avgHours,
        crossing_avg_days: crossingByCarrier[c.name]?.avgDays,
      }))

      setCarriers(merged)
      setTotal(carrierData.total_traficos || 0)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // KPI calculations
  const avgCrossing = crossingData?.averages?.overall?.days || 0
  const bestPerformer = carriers.length > 0 ? carriers.reduce((best, c) => c.score > best.score ? c : best, carriers[0]) : null
  const worstIncident = carriers.length > 0 ? carriers.reduce((worst, c) => (c.faltantes_rate + c.danos_rate) > (worst.faltantes_rate + worst.danos_rate) ? c : worst, carriers[0]) : null

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>Carrier Performance</h1>
        <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {carriers.length} transportistas &middot; {total.toLocaleString()} tráficos analizados
        </p>
      </div>

      {/* KPI Cards */}
      {!loading && carriers.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="rounded-[3px] p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Truck size={13} style={{ color: 'var(--text-muted)' }} />
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--text-muted)' }}>Transportistas</span>
            </div>
            <div className="mono text-[22px] font-semibold" style={{ color: 'var(--text-primary)' }}>{carriers.length}</div>
          </div>
          <div className="rounded-[3px] p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={13} style={{ color: 'var(--text-muted)' }} />
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--text-muted)' }}>Avg Cruce</span>
            </div>
            <div className="mono text-[22px] font-semibold" style={{ color: avgCrossing > 3 ? 'var(--amber-600)' : 'var(--green)' }}>{avgCrossing}d</div>
          </div>
          <div className="rounded-[3px] p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={13} style={{ color: 'var(--text-muted)' }} />
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--text-muted)' }}>Mejor</span>
            </div>
            <div className="text-[13px] font-semibold truncate" style={{ color: '#166534' }}>
              {bestPerformer?.name?.substring(0, 22) || ''}
            </div>
            <div className="mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{bestPerformer?.score}/100</div>
          </div>
          <div className="rounded-[3px] p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={13} style={{ color: 'var(--text-muted)' }} />
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--text-muted)' }}>Mayor Incidencia</span>
            </div>
            <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--danger-text)' }}>
              {worstIncident?.name?.substring(0, 22) || ''}
            </div>
            <div className="mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{((worstIncident?.faltantes_rate || 0) + (worstIncident?.danos_rate || 0)).toFixed(1)}% incidentes</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16 }}>
        {/* Main Table */}
        <div className="rounded-[3px] overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {loading ? (
            <div className="text-center py-12 text-[13px]" style={{ color: 'var(--text-muted)' }}>Cargando carriers...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Transportista</th>
                  <th style={{ textAlign: 'right' }}>Embarques</th>
                  <th style={{ textAlign: 'right' }}>Avg Cruce</th>
                  <th style={{ textAlign: 'right' }}>Faltantes</th>
                  <th style={{ textAlign: 'right' }}>Danos</th>
                  <th style={{ textAlign: 'right' }}>T-MEC</th>
                  <th style={{ textAlign: 'center' }}>Score</th>
                  <th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {!loading && carriers.length === 0 && (
                  <tr><td colSpan={9}>
                    <EmptyState icon="🚛" title="Sin transportistas registrados" description="Los datos de carriers aparecerán después de la sincronización" />
                  </td></tr>
                )}
                {carriers.map((c, i) => (
                  <tr key={c.name}
                    style={{ cursor: 'pointer', minHeight: 60, background: selected?.name === c.name ? 'rgba(201,168,76,0.04)' : undefined }}
                    onClick={() => setSelected(selected?.name === c.name ? null : c)}>
                    <td className="mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td>
                      <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>
                        {c.name.length > 28 ? c.name.substring(0, 28) + '...' : c.name}
                      </span>
                    </td>
                    <td className="text-right mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{c.shipments.toLocaleString()}</td>
                    <td className="text-right mono text-[12px]" style={{ color: c.crossing_avg_days && c.crossing_avg_days > 3 ? 'var(--amber-600)' : 'var(--text-secondary)' }}>
                      {c.crossing_avg_days ? `${c.crossing_avg_days}d` : ''}
                    </td>
                    <td className="text-right text-[12px]" style={{ color: c.faltantes_rate > 0 ? '#b91c1c' : 'var(--text-muted)' }}>{c.faltantes_rate}%</td>
                    <td className="text-right text-[12px]" style={{ color: c.danos_rate > 0 ? '#b91c1c' : 'var(--text-muted)' }}>{c.danos_rate}%</td>
                    <td className="text-right mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{c.completion_rate}%</td>
                    <td className="text-center">
                      <span className="mono text-[11px] font-bold px-2 py-0.5 rounded-[4px]"
                        style={{ background: scoreBg(c.score), color: scoreColor(c.score) }}>
                        {c.score}/100
                      </span>
                    </td>
                    <td>
                      <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Carrier Detail Panel */}
        {selected && (
          <div className="rounded-[3px] overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', alignSelf: 'start', position: 'sticky', top: 20 }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              <div>
                <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{selected.name}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Detalle de transportista</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <div className="p-4">
              {/* Score badge */}
              <div className="flex items-center justify-center mb-4">
                <div className="text-center">
                  <div className="mono text-[36px] font-bold" style={{ color: scoreColor(selected.score) }}>{selected.score}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>/100 Score</div>
                  <div className="mt-2">
                    <span className="text-[11px] font-semibold px-3 py-1 rounded-full"
                      style={{
                        background: selected.score >= 90 ? '#DCFCE7' : selected.score >= 70 ? '#FEF3C7' : '#FEE2E2',
                        color: selected.score >= 90 ? '#166534' : selected.score >= 70 ? 'var(--amber-text, #92400E)' : 'var(--danger-text, #991B1B)',
                      }}>
                      {selected.score >= 90 ? 'Excelente' : selected.score >= 70 ? 'Aceptable' : 'Requiere Atención'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Embarques', value: selected.shipments.toLocaleString() },
                  { label: 'Cruzados', value: selected.cruzados.toLocaleString() },
                  { label: 'Avg Peso', value: `${selected.avg_peso.toLocaleString()} kg` },
                  { label: 'Avg Cruce', value: selected.crossing_avg_days ? `${selected.crossing_avg_days}d` : '' },
                  { label: 'Completion', value: `${selected.completion_rate}%` },
                  { label: 'Incidentes', value: `${(selected.faltantes_rate + selected.danos_rate).toFixed(1)}%` },
                ].map(stat => (
                  <div key={stat.label} className="p-2.5 rounded-[4px]" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-light)' }}>
                    <div className="text-[9.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
                    <div className="mono text-[14px] font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Incident breakdown */}
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--text-muted)' }}>Incidencias</div>
              <div className="space-y-1.5 mb-4">
                {[
                  { label: 'Faltantes', rate: selected.faltantes_rate, color: '#EF4444' },
                  { label: 'Danos', rate: selected.danos_rate, color: 'var(--warning-500)' },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                      <span className="mono font-medium" style={{ color: item.rate > 0 ? item.color : 'var(--text-muted)' }}>{item.rate}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(item.rate * 10, 100)}%`, height: '100%', background: item.color, borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Crossing time insights */}
              {crossingData && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--text-muted)' }}>Tiempos de Cruce</div>
                  <div className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    <div>Dia mas rapido: <span className="font-semibold" style={{ color: 'var(--green)' }}>{crossingData.fastest_day}</span></div>
                    <div>Dia mas lento: <span className="font-semibold" style={{ color: '#EF4444' }}>{crossingData.slowest_day}</span></div>
                    <div>Recomendado: <span className="font-semibold" style={{ color: 'var(--amber-600)' }}>{crossingData.recommended_arrival_day}</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
