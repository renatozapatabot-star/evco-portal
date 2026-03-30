'use client'

import { useEffect, useState, useMemo } from 'react'
import { Search, Filter, TrendingUp, Building2, MapPin, ChevronRight, Users, DollarSign, Target, Briefcase } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Prospect {
  id: string
  rfc: string
  razon_social: string
  aduana: string
  total_pedimentos: number
  total_valor_usd: number
  avg_valor_por_pedimento: number
  top_proveedores: { name: string }[]
  primary_regime: string | null
  uses_immex: boolean
  opportunity_score: number
  estimated_annual_value_usd: number
  estimated_annual_fees_mxn: number
  likely_tmec_eligible: boolean
  tmec_savings_opportunity_mxn: number
  high_value_importer: boolean
  is_current_client: boolean
  current_client_clave: string | null
  status: string
  assigned_to: string
  notes: string | null
  contact_name: string | null
  contact_email: string | null
  next_follow_up: string | null
  first_seen_date: string | null
  last_seen_date: string | null
  updated_at: string
}

type ScoreFilter = 'all' | 'high' | 'medium' | 'low'
type StatusFilter = 'all' | 'prospect' | 'contacted' | 'meeting' | 'proposal' | 'won' | 'lost' | 'current_client'

const fmtUSD = (n: number) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`
  return `$${Math.round(n)}`
}
const fmtMXN = (n: number) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M MXN`
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K MXN`
  return `$${Math.round(n)} MXN`
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'var(--gold-600)' : score >= 60 ? 'var(--info)' : score >= 40 ? 'var(--n-500)' : 'var(--n-300)'
  const bg = score >= 80 ? 'rgba(201,168,76,0.12)' : score >= 60 ? 'rgba(37,99,235,0.08)' : 'rgba(136,128,112,0.08)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
      color, background: bg, fontFamily: 'var(--font-data)',
    }}>
      <Target size={11} /> {score}
    </span>
  )
}

function StatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    prospect: { label: 'Prospecto', color: 'var(--gold-600)', bg: 'rgba(201,168,76,0.1)' },
    contacted: { label: 'Contactado', color: 'var(--info)', bg: 'rgba(37,99,235,0.08)' },
    meeting: { label: 'Reunión', color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
    proposal: { label: 'Propuesta', color: 'var(--warning)', bg: 'rgba(217,119,6,0.08)' },
    won: { label: 'Ganado', color: 'var(--success)', bg: 'rgba(22,163,74,0.08)' },
    lost: { label: 'Perdido', color: 'var(--danger)', bg: 'rgba(220,38,38,0.08)' },
    current_client: { label: 'Cliente', color: 'var(--success)', bg: 'rgba(22,163,74,0.08)' },
    not_interested: { label: 'No interesado', color: 'var(--n-400)', bg: 'var(--n-50)' },
  }
  const c = config[status] || config.prospect
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      color: c.color, background: c.bg,
    }}>
      {c.label}
    </span>
  )
}

export default function ProspectosPage() {
  const router = useRouter()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedRFC, setSelectedRFC] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/data?table=trade_prospects&limit=500&order_by=opportunity_score&order_dir=desc')
      .then(r => r.json())
      .then(d => setProspects(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let out = prospects
    if (scoreFilter === 'high') out = out.filter(p => p.opportunity_score >= 70)
    else if (scoreFilter === 'medium') out = out.filter(p => p.opportunity_score >= 40 && p.opportunity_score < 70)
    else if (scoreFilter === 'low') out = out.filter(p => p.opportunity_score < 40)
    if (statusFilter !== 'all') out = out.filter(p => p.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(p =>
        (p.razon_social || '').toLowerCase().includes(q) ||
        p.rfc.toLowerCase().includes(q)
      )
    }
    return out
  }, [prospects, scoreFilter, statusFilter, search])

  const selected = selectedRFC ? prospects.find(p => p.rfc === selectedRFC) : null
  const nonClients = prospects.filter(p => !p.is_current_client)
  const totalPipelineValue = nonClients.reduce((s, p) => s + (p.estimated_annual_fees_mxn || 0), 0)
  const highPriority = nonClients.filter(p => p.opportunity_score >= 70)

  const updateStatus = async (rfc: string, newStatus: string) => {
    setProspects(prev => prev.map(p => p.rfc === rfc ? { ...p, status: newStatus } : p))
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'trade_prospects', updates: { status: newStatus, updated_at: new Date().toISOString() }, match: { rfc } })
    }).catch(() => {})
  }

  return (
    <div className="page-enter" style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 className="pg-title">Prospectos</h1>
          <p className="pg-meta">Empresas cruzando Aduana 240 · Inteligencia comercial</p>
        </div>
        <Link href="/prospectos/pipeline" style={{
          padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
          background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)',
          color: 'var(--gold-600)', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Briefcase size={14} /> Pipeline CRM
        </Link>
      </div>

      {/* KPI Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Empresas', value: prospects.length, icon: Building2 },
          { label: 'Prospectos', value: nonClients.length, icon: Users },
          { label: 'Alta Prioridad', value: highPriority.length, icon: Target, color: 'var(--gold-600)' },
          { label: 'Pipeline Anual', value: fmtMXN(totalPipelineValue), icon: DollarSign, color: 'var(--success)' },
        ].map(kpi => (
          <div key={kpi.label} className="kpi-card" style={{ padding: '14px 16px' }}>
            <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <kpi.icon size={13} /> {kpi.label}
            </div>
            <div className="kpi-value" style={{ fontSize: 24, color: kpi.color }}>
              {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="tbl-controls" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {([['all', 'Todos'], ['high', 'Alta (70+)'], ['medium', 'Media'], ['low', 'Baja']] as [ScoreFilter, string][]).map(([key, label]) => (
              <button key={key} className={`f-btn${scoreFilter === key ? ' on' : ''}`}
                onClick={() => setScoreFilter(key)}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([['all', 'Todos'], ['prospect', 'Prospecto'], ['contacted', 'Contactado'], ['current_client', 'Clientes']] as [StatusFilter, string][]).map(([key, label]) => (
              <button key={key} className={`f-btn${statusFilter === key ? ' on' : ''}`}
                onClick={() => setStatusFilter(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="tbl-search">
            <Search size={11} />
            <input placeholder="RFC, razón social..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Prospect Cards */}
        <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 140, borderRadius: 8 }} />
          ))}

          {!loading && filtered.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 0', color: 'var(--n-400)' }}>
              <Target size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Sin prospectos con estos filtros</div>
            </div>
          )}

          {filtered.map(p => (
            <div key={p.rfc} onClick={() => setSelectedRFC(selectedRFC === p.rfc ? null : p.rfc)}
              style={{
                padding: '14px 16px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--bg-elevated)', border: `1px solid ${p.opportunity_score >= 80 ? 'rgba(201,168,76,0.3)' : 'var(--border-light)'}`,
                transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: selectedRFC === p.rfc ? '0 0 0 2px rgba(201,168,76,0.2)' : 'none',
                opacity: p.opportunity_score < 40 && !p.is_current_client ? 0.7 : 1,
              }}>
              {/* Card header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.razon_social || p.rfc}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--n-400)', fontFamily: 'var(--font-data)', marginTop: 2 }}>{p.rfc}</div>
                </div>
                <ScoreBadge score={p.opportunity_score} />
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--n-500)', marginBottom: 8 }}>
                <span><strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtUSD(p.total_valor_usd)}</strong> USD</span>
                <span><strong style={{ color: 'var(--text-primary)' }}>{p.total_pedimentos}</strong> pedimentos</span>
                {p.uses_immex && <span style={{ color: 'var(--info)' }}>IMMEX</span>}
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <StatusPill status={p.status} />
                {p.likely_tmec_eligible && (
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'rgba(22,163,74,0.08)', color: 'var(--success)', fontWeight: 600 }}>
                    T-MEC <span style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtMXN(p.tmec_savings_opportunity_mxn)}</span>/año
                  </span>
                )}
                {p.high_value_importer && (
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'rgba(201,168,76,0.1)', color: 'var(--gold-600)', fontWeight: 600 }}>
                    Alto valor
                  </span>
                )}
              </div>

              {/* Est. fees */}
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--n-400)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Est. honorarios: <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtMXN(p.estimated_annual_fees_mxn)}/año</strong></span>
                <span>{p.top_proveedores?.length || 0} proveedores</span>
              </div>

              {/* Expanded detail */}
              {selectedRFC === p.rfc && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    <div><span style={{ color: 'var(--n-400)' }}>Primera operación:</span><br />{p.first_seen_date || '—'}</div>
                    <div><span style={{ color: 'var(--n-400)' }}>Última operación:</span><br />{p.last_seen_date || '—'}</div>
                    <div><span style={{ color: 'var(--n-400)' }}>Régimen:</span><br />{p.primary_regime || '—'}</div>
                    <div><span style={{ color: 'var(--n-400)' }}>Valor promedio:</span><br /><span style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtUSD(p.avg_valor_por_pedimento)}</span> USD/ped</div>
                  </div>
                  {p.top_proveedores && p.top_proveedores.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      <span style={{ color: 'var(--n-400)' }}>Proveedores:</span>
                      <div style={{ color: 'var(--text-primary)', marginTop: 2 }}>
                        {p.top_proveedores.map(s => s.name).join(', ')}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {!p.is_current_client && p.status === 'prospect' && (
                      <button onClick={(e) => { e.stopPropagation(); updateStatus(p.rfc, 'contacted') }}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 4, border: 'none', background: 'var(--gold-600)', color: '#000', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                        Marcar contactado
                      </button>
                    )}
                    {p.contact_email && (
                      <a href={`mailto:${p.contact_email}`} onClick={e => e.stopPropagation()}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 4, border: '1px solid var(--border-default)', textAlign: 'center', fontSize: 12, textDecoration: 'none', color: 'var(--text-secondary)' }}>
                        Email
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
