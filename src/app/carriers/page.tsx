'use client'

import { useEffect, useState } from 'react'

export default function CarriersPage() {
  const [carriers, setCarriers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/carriers').then(r => r.json()).then(d => { setCarriers(d.carriers || []); setTotal(d.total_traficos || 0); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  function scoreColor(s: number) { return s >= 90 ? '#166534' : s >= 70 ? '#92400E' : '#991B1B' }
  function scoreBg(s: number) { return s >= 90 ? '#DCFCE7' : s >= 70 ? '#FEF3C7' : '#FEE2E2' }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>Carrier Performance</h1>
        <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {carriers.length} transportistas · {total.toLocaleString()} tráficos analizados
        </p>
      </div>

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
                <th style={{ textAlign: 'right' }}>Cruzados</th>
                <th style={{ textAlign: 'right' }}>Avg Peso</th>
                <th style={{ textAlign: 'right' }}>Faltantes</th>
                <th style={{ textAlign: 'right' }}>Daños</th>
                <th style={{ textAlign: 'right' }}>Completion</th>
                <th style={{ textAlign: 'center' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {carriers.map((c, i) => (
                <tr key={c.name}>
                  <td className="mono text-[11px]" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                  <td>
                    <span className="text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>
                      {c.name.length > 28 ? c.name.substring(0, 28) + '…' : c.name}
                    </span>
                  </td>
                  <td className="text-right mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{c.shipments.toLocaleString()}</td>
                  <td className="text-right mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{c.cruzados.toLocaleString()}</td>
                  <td className="text-right mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{c.avg_peso.toLocaleString()} kg</td>
                  <td className="text-right text-[12px]" style={{ color: c.faltantes_rate > 0 ? '#b91c1c' : 'var(--text-muted)' }}>{c.faltantes_rate}%</td>
                  <td className="text-right text-[12px]" style={{ color: c.danos_rate > 0 ? '#b91c1c' : 'var(--text-muted)' }}>{c.danos_rate}%</td>
                  <td className="text-right mono text-[12px]" style={{ color: 'var(--text-secondary)' }}>{c.completion_rate}%</td>
                  <td className="text-center">
                    <span className="mono text-[11px] font-bold px-2 py-0.5 rounded-[4px]"
                      style={{ background: scoreBg(c.score), color: scoreColor(c.score) }}>
                      {c.score}/100
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
