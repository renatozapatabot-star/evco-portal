'use client'

import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'

interface RunLog {
  id: string
  run_at: string
  duration_ms: number
  proposals_generated: number
  rule_based_count: number
  llm_based_count: number
  llm_cost_usd: number
  errors: Array<{ message: string }>
  confidence_p50: number
  confidence_p90: number
}

export default function ProposalEnginePage() {
  const [logs, setLogs] = useState<RunLog[]>([])
  const [proposalCount, setProposalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/data?table=proposal_generation_log&limit=20&order_by=run_at&order_dir=desc')
        .then(r => r.json()).catch(() => ({ data: null, error: true })),
      fetch('/api/data?table=surface_proposals&limit=1')
        .then(r => r.json()).catch(() => ({ data: null, error: true })),
    ]).then(([logRes, propRes]) => {
      if (logRes.error || !logRes.data) {
        setTableExists(false)
      } else {
        setLogs(logRes.data || [])
      }
      setProposalCount(propRes.data?.length ?? 0)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="page-shell"><div style={{ padding: 32, color: '#8B949E' }}>Cargando...</div></div>

  if (!tableExists) {
    return (
      <div className="page-shell">
        <h1 className="page-title">Motor de Propuestas</h1>
        <EmptyState
          icon="⚙️"
          title="Tablas no creadas aún"
          description="Ejecuta supabase/migrations/20260410_block_j_proposal_engine.sql en el SQL Editor de Supabase para activar el motor de propuestas."
        />
      </div>
    )
  }

  const lastRun = logs[0]
  const totalGenerated = logs.reduce((s, l) => s + l.proposals_generated, 0)
  const totalLLMCost = logs.reduce((s, l) => s + (l.llm_cost_usd || 0), 0)
  const errorRuns = logs.filter(l => (l.errors?.length || 0) > 0).length

  return (
    <div className="page-shell">
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Motor de Propuestas</h1>
        <p className="page-subtitle">Genera recomendaciones para cada superficie de ADUANA</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KPI label="Última ejecución" value={lastRun ? new Date(lastRun.run_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Chicago' }) : '—'} />
        <KPI label="Propuestas activas" value={String(proposalCount)} />
        <KPI label="Generadas (20 corridas)" value={String(totalGenerated)} />
        <KPI label="Basadas en reglas" value={logs.length > 0 ? `${Math.round((logs.reduce((s, l) => s + l.rule_based_count, 0) / Math.max(totalGenerated, 1)) * 100)}%` : '—'} />
        <KPI label="Costo LLM" value={`$${totalLLMCost.toFixed(4)} USD`} />
        <KPI label="Errores" value={`${errorRuns} de ${logs.length}`} color={errorRuns > 0 ? '#DC2626' : '#16A34A'} />
      </div>

      {/* Run history */}
      <div style={{ background: 'rgba(9,9,11,0.75)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6E7681' }}>
            Últimas ejecuciones
          </span>
        </div>
        {logs.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6E7681', fontSize: 13 }}>
            Sin ejecuciones — el cron aún no ha corrido
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Hora', 'Duración', 'Generadas', 'Reglas', 'LLM', 'Costo', 'P50', 'P90', 'Errores'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6E7681', textAlign: 'left', borderBottom: '1px solid rgba(9,9,11,0.75)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => (
                <tr key={l.id} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                  <td className="font-mono" style={{ padding: '8px 12px', fontSize: 12, color: '#E6EDF3' }}>
                    {new Date(l.run_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Chicago' })}
                  </td>
                  <td className="font-mono" style={{ padding: '8px 12px', fontSize: 12, color: '#8B949E' }}>{l.duration_ms}ms</td>
                  <td className="font-mono" style={{ padding: '8px 12px', fontSize: 12, color: '#eab308', fontWeight: 600 }}>{l.proposals_generated}</td>
                  <td className="font-mono" style={{ padding: '8px 12px', fontSize: 12, color: '#16A34A' }}>{l.rule_based_count}</td>
                  <td className="font-mono" style={{ padding: '8px 12px', fontSize: 12, color: '#D97706' }}>{l.llm_based_count}</td>
                  <td className="font-mono" style={{ padding: '8px 12px', fontSize: 12, color: '#8B949E' }}>${(l.llm_cost_usd || 0).toFixed(4)}</td>
                  <td className="font-mono" style={{ padding: '8px 12px', fontSize: 12, color: '#8B949E' }}>{l.confidence_p50?.toFixed(2) ?? '—'}</td>
                  <td className="font-mono" style={{ padding: '8px 12px', fontSize: 12, color: '#8B949E' }}>{l.confidence_p90?.toFixed(2) ?? '—'}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, color: (l.errors?.length || 0) > 0 ? '#DC2626' : '#16A34A' }}>
                    {(l.errors?.length || 0) > 0 ? `${l.errors.length} error${l.errors.length !== 1 ? 'es' : ''}` : '✓'}
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

function KPI({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'rgba(9,9,11,0.75)', borderRadius: 10, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6E7681', marginBottom: 4 }}>{label}</div>
      <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: color || '#E6EDF3' }}>{value}</div>
    </div>
  )
}
