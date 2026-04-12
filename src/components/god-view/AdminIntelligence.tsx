'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  Shield,
  TrendingUp,
  Ghost,
  RefreshCw,
  Loader2,
  BarChart3,
} from 'lucide-react'

// ── Types ──

interface Anomaly {
  id: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  detected_at: string
  entity_type?: string
  entity_id?: string
}

interface GhostTrafico {
  id: string
  trafico_number: string
  company_id: string
  days_stuck: number
  last_status: string
  reason?: string
}

interface RiskEntry {
  company_id: string
  company_name: string
  risk_score: number
  risk_level: 'low' | 'medium' | 'high'
  factors: string[]
}

interface ProfitabilityEntry {
  company_id: string
  company_name: string
  revenue: number
  margin: number
  trafico_count: number
}

// ── Styles ──

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 20,
  padding: 20,
}

const sectionTitle: React.CSSProperties = {
  color: '#E6EDF3',
  fontSize: 15,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  margin: 0,
}

const mutedText: React.CSSProperties = {
  color: '#64748b',
  fontSize: 11,
}

const secondaryText: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: 13,
}

// ── Severity helpers ──

const SEVERITY_COLORS: Record<string, string> = {
  low: '#22C55E',
  medium: '#FBBF24',
  high: '#EF4444',
  critical: '#DC2626',
}

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  critical: 'Crítico',
}

const RISK_COLORS: Record<string, string> = {
  low: '#22C55E',
  medium: '#FBBF24',
  high: '#EF4444',
}

function riskLabel(level: string): string {
  if (level === 'low') return 'Bajo'
  if (level === 'medium') return 'Medio'
  return 'Alto'
}

// ── Sub-components ──

function PanelLoading({ label }: { label: string }) {
  return (
    <div style={{ ...mutedText, display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
      <Loader2 size={12} className="animate-spin" />
      Cargando {label}...
    </div>
  )
}

function PanelEmpty({ icon: Icon, message }: { icon: typeof AlertTriangle; message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <Icon size={28} style={{ color: '#64748b', marginBottom: 8 }} />
      <div style={{ color: '#94a3b8', fontSize: 12 }}>{message}</div>
    </div>
  )
}

// ── Panel A: Anomalias ──

function AnomalyPanel() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/intelligence/anomalies')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { data?: Anomaly[] }
      setAnomalies(json.data ?? [])
    } catch {
      setAnomalies([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div style={glassCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={sectionTitle}>
          <AlertTriangle size={16} style={{ color: '#EF4444' }} />
          Anomalías
          {anomalies.length > 0 && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              background: 'rgba(239,68,68,0.15)',
              color: '#EF4444',
              padding: '2px 8px',
              borderRadius: 6,
              fontWeight: 700,
            }}>
              {anomalies.length}
            </span>
          )}
        </h3>
        <button
          onClick={fetchData}
          type="button"
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4, display: 'flex' }}
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {loading ? (
        <PanelLoading label="anomalías" />
      ) : anomalies.length === 0 ? (
        <PanelEmpty icon={AlertTriangle} message="Sin anomalías detectadas" />
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {anomalies.slice(0, 8).map(a => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 10,
                borderLeft: `3px solid ${SEVERITY_COLORS[a.severity] ?? '#64748b'}`,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ ...secondaryText, lineHeight: 1.4 }}>{a.description}</div>
                {a.entity_type && (
                  <div style={{ ...mutedText, marginTop: 4 }}>
                    {a.entity_type} · {a.entity_id}
                  </div>
                )}
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: SEVERITY_COLORS[a.severity] ?? '#64748b',
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                whiteSpace: 'nowrap',
              }}>
                {SEVERITY_LABELS[a.severity] ?? a.severity}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Panel B: Matriz de Riesgo ──

function RiskMatrixPanel() {
  const [risks, setRisks] = useState<RiskEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/intelligence/risk')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { data?: RiskEntry[] }
      setRisks(json.data ?? [])
    } catch {
      setRisks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div style={glassCard}>
      <h3 style={sectionTitle}>
        <Shield size={16} style={{ color: '#FBBF24' }} />
        Matriz de Riesgo
      </h3>

      {loading ? (
        <PanelLoading label="riesgo" />
      ) : risks.length === 0 ? (
        <PanelEmpty icon={Shield} message="Sin datos de riesgo disponibles" />
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {risks.map(r => (
            <div
              key={r.company_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 10,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ ...secondaryText, fontWeight: 500 }}>{r.company_name}</div>
                {r.factors.length > 0 && (
                  <div style={{ ...mutedText, marginTop: 2 }}>
                    {r.factors.slice(0, 2).join(' · ')}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Score bar */}
                <div style={{
                  width: 60,
                  height: 6,
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(r.risk_score, 100)}%`,
                    height: '100%',
                    background: RISK_COLORS[r.risk_level] ?? '#64748b',
                    borderRadius: 3,
                  }} />
                </div>

                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: RISK_COLORS[r.risk_level] ?? '#64748b',
                  fontWeight: 600,
                  minWidth: 50,
                  textAlign: 'right',
                }}>
                  {r.risk_score} {riskLabel(r.risk_level)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Panel C: Rentabilidad ──

function ProfitabilityPanel() {
  const [entries, setEntries] = useState<ProfitabilityEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/intelligence/profitability')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { data?: ProfitabilityEntry[] }
      setEntries(json.data ?? [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const maxRevenue = entries.reduce((max, e) => Math.max(max, e.revenue), 1)

  return (
    <div style={glassCard}>
      <h3 style={sectionTitle}>
        <TrendingUp size={16} style={{ color: '#22C55E' }} />
        Rentabilidad
      </h3>

      {loading ? (
        <PanelLoading label="rentabilidad" />
      ) : entries.length === 0 ? (
        <PanelEmpty icon={BarChart3} message="Sin datos de rentabilidad disponibles" />
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(e => (
            <div
              key={e.company_id}
              style={{
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ ...secondaryText, fontWeight: 500 }}>{e.company_name}</span>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#E6EDF3', fontWeight: 600 }}>
                    ${(e.revenue / 1000).toFixed(1)}K USD
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: e.margin >= 30 ? '#22C55E' : e.margin >= 15 ? '#FBBF24' : '#EF4444',
                    fontWeight: 600,
                  }}>
                    {e.margin.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Revenue bar */}
              <div style={{
                width: '100%',
                height: 4,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(e.revenue / maxRevenue) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #00E5FF, #3B82F6)',
                  borderRadius: 2,
                }} />
              </div>

              <div style={{ ...mutedText, marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{e.trafico_count}</span> tráficos
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Panel D: Tráficos Fantasma ──

function GhostPanel() {
  const [ghosts, setGhosts] = useState<GhostTrafico[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/intelligence/ghosts')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { data?: GhostTrafico[] }
      setGhosts(json.data ?? [])
    } catch {
      setGhosts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div style={glassCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={sectionTitle}>
          <Ghost size={16} style={{ color: '#00E5FF' }} />
          Tráficos Fantasma
          {ghosts.length > 0 && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              background: 'rgba(0,229,255,0.12)',
              color: '#00E5FF',
              padding: '2px 8px',
              borderRadius: 6,
              fontWeight: 700,
            }}>
              {ghosts.length}
            </span>
          )}
        </h3>
        <button
          onClick={fetchData}
          type="button"
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4, display: 'flex' }}
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {loading ? (
        <PanelLoading label="fantasmas" />
      ) : ghosts.length === 0 ? (
        <PanelEmpty icon={Ghost} message="Sin tráficos fantasma detectados" />
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ghosts.map(g => (
            <div
              key={g.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 10,
              }}
            >
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#E6EDF3', fontWeight: 500 }}>
                  {g.trafico_number}
                </span>
                <div style={mutedText}>
                  {g.company_id} · {g.last_status}
                  {g.reason && ` · ${g.reason}`}
                </div>
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                color: g.days_stuck > 30 ? '#EF4444' : g.days_stuck > 14 ? '#FBBF24' : '#94a3b8',
                fontWeight: 600,
              }}>
                {g.days_stuck}d
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main AdminIntelligence Component ──

export function AdminIntelligence() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
      <AnomalyPanel />
      <RiskMatrixPanel />
      <ProfitabilityPanel />
      <GhostPanel />
    </div>
  )
}
