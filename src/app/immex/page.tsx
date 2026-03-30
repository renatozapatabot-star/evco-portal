'use client'

import { useEffect, useState, useMemo } from 'react'
import { CLIENT_NAME, CLIENT_CLAVE } from '@/lib/client-config'
import { fmtDate } from '@/lib/format-utils'

type ImmexRow = { trafico: string; fecha_llegada: string; estatus: string; descripcion_mercancia: string; peso_bruto: number; importe_total: number; pedimento: string }

export default function ImmexPage() {
  const [rows, setRows] = useState<ImmexRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/data?table=traficos&clave_cliente=${CLIENT_CLAVE}&trafico_prefix=${CLIENT_CLAVE}-&limit=5000&order_by=fecha_llegada&order_dir=desc`)
      .then(r => r.json()).then(d => { setRows(d.data ?? d ?? []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const enProceso = rows.filter(r => r.estatus === 'En Proceso')

  const immexData = useMemo(() => {
    return enProceso.filter(r => r.fecha_llegada).map(r => {
      const entrada = new Date(r.fecha_llegada)
      const limit18m = new Date(entrada); limit18m.setMonth(limit18m.getMonth() + 18)
      const daysElapsed = Math.floor((Date.now() - entrada.getTime()) / 86400000)
      const daysRemaining = Math.floor((limit18m.getTime() - Date.now()) / 86400000)
      const pctUsed = Math.min(100, Math.round((daysElapsed / 548) * 100)) // 548 = 18 months
      return { ...r, daysElapsed, daysRemaining, limit18m: limit18m.toISOString().split('T')[0], pctUsed }
    }).sort((a, b) => a.daysRemaining - b.daysRemaining)
  }, [enProceso])

  const critical = immexData.filter(d => d.daysRemaining <= 60)
  const warning = immexData.filter(d => d.daysRemaining > 60 && d.daysRemaining <= 180)
  const ok = immexData.filter(d => d.daysRemaining > 180)
  const totalValor = immexData.reduce((s, d) => s + (d.importe_total || 0), 0)

  function barColor(days: number) { return days <= 60 ? '#EF4444' : days <= 180 ? '#F59E0B' : '#10B981' }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="pg-title">IMMEX — Importación Temporal</h1>
        <p className="pg-meta">{immexData.length} tráficos temporales activos · Límite 18 meses · {CLIENT_NAME.split(' ')[0]} Plastics</p>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Temporales Activos', value: immexData.length.toLocaleString(), color: 'var(--text-primary)' },
          { label: 'Críticos (<60d)', value: critical.length.toLocaleString(), color: critical.length > 0 ? '#EF4444' : 'var(--status-green)' },
          { label: 'Atención (<180d)', value: warning.length.toLocaleString(), color: warning.length > 0 ? '#F59E0B' : 'var(--text-primary)' },
          { label: 'Valor Temporal', value: `$${(totalValor / 1000).toFixed(0)}K`, color: 'var(--amber-600)' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 6 }}>{k.label}</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Critical alert */}
      {critical.length > 0 && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red-b)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ color: 'var(--red-text)', fontSize: 13, fontWeight: 700 }}>🚨 {critical.length} tráfico(s) dentro de 60 días del límite IMMEX</div>
          <div style={{ color: 'var(--red-text)', fontSize: 12, marginTop: 4 }}>Acción: Retorno o cambio de régimen requerido antes del vencimiento</div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Cargando datos IMMEX...</div>
        ) : immexData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--n-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--n-700)', marginBottom: 4 }}>Sin tráficos temporales activos</div>
            <div style={{ fontSize: 13, color: 'var(--n-400)' }}>Todo bajo control</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tráfico</th>
                <th>Entrada</th>
                <th>Límite 18m</th>
                <th style={{ textAlign: 'right' }}>Días Restantes</th>
                <th style={{ width: 180 }}>Uso del Período</th>
                <th>Descripción</th>
                <th style={{ textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {immexData.map(d => (
                <tr key={d.trafico}>
                  <td><span className="mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.trafico}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtDate(d.fecha_llegada)}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12, fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtDate(d.limit18m)}</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600, color: barColor(d.daysRemaining) }}>{d.daysRemaining}d</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${d.pctUsed}%`, height: '100%', background: barColor(d.daysRemaining), borderRadius: 99, transition: 'width 0.3s' }} />
                      </div>
                      <span className="mono" style={{ fontSize: 10, color: barColor(d.daysRemaining), fontWeight: 700, minWidth: 32 }}>{d.pctUsed}%</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.descripcion_mercancia || ''}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ background: d.daysRemaining <= 60 ? 'var(--red-bg)' : d.daysRemaining <= 180 ? 'var(--amber-bg)' : 'var(--green-bg)', color: d.daysRemaining <= 60 ? 'var(--red-text)' : d.daysRemaining <= 180 ? 'var(--amber-text)' : 'var(--green-text)', borderRadius: 4, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                      {d.daysRemaining <= 60 ? 'CRÍTICO' : d.daysRemaining <= 180 ? 'ATENCIÓN' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
