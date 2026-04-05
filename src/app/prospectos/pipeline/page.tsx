'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Building2, DollarSign, Target, GripVertical, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Prospect {
  rfc: string
  razon_social: string
  opportunity_score: number
  total_valor_usd: number
  estimated_annual_fees_mxn: number
  status: string
  contact_name: string | null
  next_follow_up: string | null
  notes: string | null
  is_current_client: boolean
}

const COLUMNS = [
  { key: 'prospect', label: 'Prospecto', color: 'var(--gold-600)' },
  { key: 'contacted', label: 'Contactado', color: 'var(--info)' },
  { key: 'meeting', label: 'Reunión', color: '#8B5CF6' },
  { key: 'proposal', label: 'Propuesta', color: 'var(--warning)' },
  { key: 'won', label: 'Ganado', color: 'var(--success)' },
  { key: 'lost', label: 'Perdido', color: 'var(--danger)' },
]

const fmtUSD = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`
const fmtMXN = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`

export default function PipelinePage() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [dragRFC, setDragRFC] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/data?table=trade_prospects&limit=500&order_by=opportunity_score&order_dir=desc')
      .then(r => r.json())
      .then(d => setProspects((d.data ?? []).filter((p: Prospect) => !p.is_current_client)))
      .catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
      .finally(() => setLoading(false))
  }, [])

  const moveToColumn = async (rfc: string, newStatus: string) => {
    setProspects(prev => prev.map(p => p.rfc === rfc ? { ...p, status: newStatus } : p))

    // Persist to API
    const body = new URLSearchParams()
    body.set('table', 'trade_prospects')
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'trade_prospects',
        updates: { status: newStatus, updated_at: new Date().toISOString() },
        match: { rfc }
      })
    }).catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })

    // Telegram notification for important moves
    if (newStatus === 'won' || newStatus === 'contacted') {
      const p = prospects.find(pr => pr.rfc === rfc)
      if (p) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: newStatus === 'won'
              ? `🎉 Nuevo cliente ganado: ${p.razon_social || p.rfc}\nEst. honorarios: ${fmtMXN(p.estimated_annual_fees_mxn)} MXN/año\n— CRUZ 🦀`
              : `📞 Prospecto contactado: ${p.razon_social || p.rfc}\nScore: ${p.opportunity_score}/100\n— CRUZ 🦀`
          })
        }).catch((err: unknown) => { console.error("[CRUZ]", (err as Error)?.message || err) })
      }
    }
  }

  const handleDragStart = (rfc: string) => setDragRFC(rfc)
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault()
    if (dragRFC) {
      moveToColumn(dragRFC, columnKey)
      setDragRFC(null)
    }
  }

  // Pipeline value per column
  const columnStats = (key: string) => {
    const items = prospects.filter(p => p.status === key)
    return {
      count: items.length,
      value: items.reduce((s, p) => s + (p.estimated_annual_fees_mxn || 0), 0),
    }
  }

  return (
    <div className="page-enter" style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link href="/prospectos" style={{ color: 'var(--n-400)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="pg-title">Pipeline CRM</h1>
          <p className="pg-meta">Arrastra prospectos entre columnas · {prospects.length} en pipeline</p>
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(200px, 1fr))`,
        gap: 12,
        overflowX: 'auto',
        paddingBottom: 20,
        minHeight: 'calc(100vh - 160px)',
      }}>
        {COLUMNS.map(col => {
          const colProspects = prospects.filter(p => p.status === col.key)
          const stats = columnStats(col.key)

          return (
            <div key={col.key}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, col.key)}
              style={{
                background: 'var(--n-50)',
                borderRadius: 8,
                padding: 8,
                minHeight: 300,
              }}>
              {/* Column header */}
              <div style={{
                padding: '8px 10px', marginBottom: 8,
                borderBottom: `2px solid ${col.color}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {col.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--n-400)', marginTop: 2 }}>
                    {stats.count} · <span style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtMXN(stats.value)}</span>/año
                  </div>
                </div>
                <span style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: col.color, color: '#fff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                }}>
                  {stats.count}
                </span>
              </div>

              {/* Cards */}
              {loading && Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 80, borderRadius: 6, marginBottom: 6 }} />
              ))}

              {colProspects.map(p => (
                <div key={p.rfc}
                  draggable
                  onDragStart={() => handleDragStart(p.rfc)}
                  style={{
                    padding: '10px 12px', marginBottom: 6,
                    borderRadius: 6, background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    cursor: 'grab',
                    opacity: dragRFC === p.rfc ? 0.5 : 1,
                    transition: 'opacity 0.15s, box-shadow 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {(p.razon_social || p.rfc).substring(0, 25)}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: p.opportunity_score >= 70 ? 'var(--gold-600)' : 'var(--n-400)',
                      fontFamily: 'var(--font-jetbrains-mono)',
                    }}>
                      {p.opportunity_score}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--n-400)', display: 'flex', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtUSD(p.total_valor_usd)} USD</span>
                    <span style={{ color: 'var(--success)', fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtMXN(p.estimated_annual_fees_mxn)}/yr</span>
                  </div>
                  {p.next_follow_up && (
                    <div style={{ fontSize: 10, color: 'var(--warning)', marginTop: 4 }}>
                      Seguimiento: {p.next_follow_up}
                    </div>
                  )}

                  {/* Quick action buttons */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    {col.key !== 'won' && col.key !== 'lost' && (
                      <>
                        {COLUMNS.filter(c => c.key !== col.key && c.key !== 'lost').slice(0, 2).map(nextCol => (
                          <button key={nextCol.key}
                            onClick={(e) => { e.stopPropagation(); moveToColumn(p.rfc, nextCol.key) }}
                            style={{
                              flex: 1, padding: '4px 0', borderRadius: 3,
                              border: '1px solid var(--border-light)',
                              background: 'none', fontSize: 10, cursor: 'pointer',
                              color: nextCol.color,
                            }}>
                            → {nextCol.label}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {!loading && colProspects.length === 0 && (
                <div style={{
                  textAlign: 'center', padding: '24px 12px',
                  color: 'var(--n-300)', fontSize: 12,
                  border: '1px dashed var(--border-light)',
                  borderRadius: 6,
                }}>
                  Arrastra aquí
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
