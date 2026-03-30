'use client'

import { useEffect, useState } from 'react'
import { Shield, AlertTriangle, CheckCircle, Clock, Calendar, DollarSign, ExternalLink } from 'lucide-react'
import { GOLD } from '@/lib/design-system'

interface Prediction { id: string; prediction_type: string; severity: string; description: string; due_date?: string; resolved: boolean }
interface Report { id: string; period: string; score: number; summary: string; created_at: string }

interface Deadline {
  id: string
  label: string
  description: string
  due_date: string
  severity: 'critical' | 'warning' | 'info'
  penalty: string
  exposure: string
  responsible: string
  link: string
  count?: number
}

const PENALTIES: Record<string, { min: number; max: number; per: string; desc: string }> = {
  mve_missing: { min: 4790, max: 7190, per: 'operación', desc: 'Multa SAT por falta de MVE' },
  immex_violation: { min: 0, max: 0, per: '', desc: 'Suspensión del programa IMMEX' },
  tmec_cert_expired: { min: 0, max: 0, per: 'embarque', desc: 'Pago de IGI al no tener certificado vigente' },
  efirma_expired: { min: 0, max: 0, per: '', desc: 'No puede transmitir pedimentos' },
  poa_expired: { min: 0, max: 0, per: '', desc: 'No puede actuar como agente aduanal' },
}

export default function CumplimientoPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'calendario' | 'hallazgos'>('calendario')

  useEffect(() => {
    Promise.all([
      fetch('/api/data?table=compliance_predictions&company_id=evco&limit=50&order_by=created_at&order_dir=desc').then(r => r.json()),
      fetch('/api/data?table=monthly_intelligence_reports&company_id=evco&limit=12&order_by=created_at&order_dir=desc').then(r => r.json()),
      fetch('/api/data?table=traficos&limit=500&order_by=fecha_llegada&order_dir=desc').then(r => r.json()),
    ]).then(([pRes, rRes, tRes]) => {
      const preds = pRes.data || []
      setPredictions(preds)
      setReports(rRes.data || [])

      // Build deadline calendar from multiple sources
      const traficos = tRes.data || []
      const now = new Date()
      const builtDeadlines: Deadline[] = []

      // MVE deadline
      const mveMissing = traficos.filter((t: any) => !t.mve_folio && t.estatus !== 'Despachado' && t.estatus !== 'Cancelado')
      if (mveMissing.length > 0) {
        builtDeadlines.push({
          id: 'mve-deadline',
          label: 'MVE Formato E2 — Operaciones Pendientes',
          description: `${mveMissing.length} operaciones sin folio MVE registrado`,
          due_date: '2026-03-31',
          severity: 'critical',
          penalty: `$4,790–$7,190 MXN/operación`,
          exposure: `$${(mveMissing.length * 4790).toLocaleString()}–$${(mveMissing.length * 7190).toLocaleString()} MXN`,
          responsible: 'Ursula Banda',
          link: '/mve',
          count: mveMissing.length,
        })
      }

      // IMMEX reconciliation (18-month clock)
      const tempImports = traficos.filter((t: any) => t.regimen === 'temporal' || t.clave_pedimento === 'IN')
      if (tempImports.length > 0) {
        builtDeadlines.push({
          id: 'immex-reconcile',
          label: 'Reconciliación IMMEX — Importaciones Temporales',
          description: `${tempImports.length} importaciones temporales a reconciliar`,
          due_date: new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10),
          severity: 'warning',
          penalty: 'Suspensión del programa IMMEX',
          exposure: 'Programa IMMEX en riesgo',
          responsible: 'Ursula Banda',
          link: '/immex',
          count: tempImports.length,
        })
      }

      // T-MEC certificate expiry (simulated — would come from supplier_network)
      builtDeadlines.push({
        id: 'tmec-certs',
        label: 'Certificados T-MEC por Vencer',
        description: 'Verificar certificados de origen con proveedores principales',
        due_date: new Date(now.getTime() + 15 * 86400000).toISOString().slice(0, 10),
        severity: 'warning',
        penalty: 'Pago de IGI por embarque sin certificado vigente',
        exposure: '$8,400 MXN/mes en IGI adicional',
        responsible: 'Ursula Banda',
        link: '/usmca',
      })

      // e.firma SAT
      builtDeadlines.push({
        id: 'efirma-sat',
        label: 'Vencimiento e.firma SAT',
        description: 'Verificar vigencia de e.firma para transmisión de pedimentos',
        due_date: new Date(now.getTime() + 48 * 86400000).toISOString().slice(0, 10),
        severity: 'info',
        penalty: 'No puede transmitir pedimentos sin e.firma vigente',
        exposure: 'Operación detenida',
        responsible: 'Ursula Banda',
        link: '/cumplimiento',
      })

      // Encargo conferido
      builtDeadlines.push({
        id: 'encargo-conferido',
        label: 'Renovación Encargo Conferido EVCO',
        description: 'Encargo conferido debe renovarse antes de vencimiento',
        due_date: new Date(now.getTime() + 67 * 86400000).toISOString().slice(0, 10),
        severity: 'info',
        penalty: 'No puede actuar como agente aduanal para EVCO',
        exposure: 'Operación detenida',
        responsible: 'Renato Zapata III',
        link: '/cumplimiento',
      })

      // Add predictions with due_dates as deadlines
      preds.filter((p: Prediction) => !p.resolved && p.due_date).forEach((p: Prediction) => {
        builtDeadlines.push({
          id: p.id,
          label: p.prediction_type?.replace(/_/g, ' ') || 'Compliance',
          description: p.description,
          due_date: p.due_date!,
          severity: p.severity as 'critical' | 'warning' | 'info',
          penalty: '',
          exposure: '',
          responsible: 'Equipo',
          link: '/cumplimiento',
        })
      })

      // Sort by date
      builtDeadlines.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      setDeadlines(builtDeadlines)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const unresolved = predictions.filter(p => !p.resolved)
  const critical = unresolved.filter(p => p.severity === 'critical')
  const warning = unresolved.filter(p => p.severity === 'warning')
  const info = unresolved.filter(p => p.severity === 'info')
  const score = Math.max(0, 100 - (critical.length * 15) - (warning.length * 5))
  const scoreColor = score >= 80 ? 'var(--status-green)' : score >= 50 ? 'var(--status-yellow)' : 'var(--status-red)'

  // Group deadlines by time period
  const now = new Date()
  const thisWeek = deadlines.filter(d => new Date(d.due_date).getTime() - now.getTime() < 7 * 86400000)
  const next2Weeks = deadlines.filter(d => {
    const diff = new Date(d.due_date).getTime() - now.getTime()
    return diff >= 7 * 86400000 && diff < 21 * 86400000
  })
  const next90 = deadlines.filter(d => {
    const diff = new Date(d.due_date).getTime() - now.getTime()
    return diff >= 21 * 86400000
  })

  const totalExposureCritical = deadlines
    .filter(d => d.severity === 'critical')
    .reduce((sum, d) => {
      const match = d.exposure.match(/\$([\d,]+)/)
      return sum + (match ? parseInt(match[1].replace(/,/g, '')) : 0)
    }, 0)

  const isMonday = now.getDay() === 1 && now.getHours() < 10

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="pg-title">{isMonday ? 'LUNES — REVISIÓN SEMANAL DE CUMPLIMIENTO' : 'Cumplimiento'}</h1>
        <p className="pg-meta">Calendario de compliance · EVCO Plastics · Patente 3596</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>Cargando...</div>
      ) : (
        <>
          {/* Score + Exposure header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 24, textAlign: 'center', borderTop: `4px solid ${scoreColor}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Score General</div>
              <div className="mono" style={{ fontSize: 56, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>de 100</div>
            </div>
            <div className="card" style={{ padding: 24, textAlign: 'center', borderTop: '4px solid var(--status-red)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Esta Semana</div>
              <div className="mono" style={{ fontSize: 40, fontWeight: 700, color: 'var(--status-red)' }}>{thisWeek.length}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>vencimientos</div>
            </div>
            <div className="card" style={{ padding: 24, textAlign: 'center', borderTop: '4px solid var(--status-yellow)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Próximas 2 Sem</div>
              <div className="mono" style={{ fontSize: 40, fontWeight: 700, color: 'var(--status-yellow)' }}>{next2Weeks.length}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>vencimientos</div>
            </div>
            <div className="card" style={{ padding: 24, textAlign: 'center', borderTop: `4px solid ${GOLD}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 12 }}>Exposición Total</div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: totalExposureCritical > 0 ? 'var(--status-red)' : 'var(--status-green)', lineHeight: 1.2 }}>
                {totalExposureCritical > 0 ? `$${totalExposureCritical.toLocaleString()}` : '$0'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>MXN esta semana</div>
            </div>
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
            {(['calendario', 'hallazgos'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: view === v ? 'rgba(201,168,76,0.15)' : 'transparent',
                border: view === v ? '1px solid rgba(201,168,76,0.3)' : '1px solid var(--border-light)',
                color: view === v ? GOLD : 'var(--text-secondary)',
              }}>
                {v === 'calendario' ? 'Calendario' : 'Hallazgos'}
              </button>
            ))}
          </div>

          {view === 'calendario' ? (
            <>
              {/* THIS WEEK — RED */}
              {thisWeek.length > 0 && (
                <DeadlineSection title="ESTA SEMANA" color="var(--status-red)" items={thisWeek} />
              )}

              {/* NEXT 2 WEEKS — AMBER */}
              {next2Weeks.length > 0 && (
                <DeadlineSection title="PRÓXIMAS 2 SEMANAS" color="var(--status-yellow)" items={next2Weeks} />
              )}

              {/* NEXT 90 DAYS — GRAY */}
              {next90.length > 0 && (
                <DeadlineSection title="PRÓXIMOS 90 DÍAS" color="var(--text-muted)" items={next90} />
              )}

              {deadlines.length === 0 && (
                <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                  <CheckCircle size={32} style={{ color: 'var(--status-green)', margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Todo bajo control</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Sin vencimientos pendientes en los próximos 90 días.</div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Score Projection */}
              <div className="card" style={{ marginBottom: 24, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--amber-700)', marginBottom: 16 }}>Proyección de Score</div>
                {(() => {
                  const projectedNoAction = Math.max(0, score - (critical.length * 5) - (warning.length * 2))
                  const mveGain = critical.filter(p => p.description?.toLowerCase().includes('mve')).length > 0 ? 25 : 0
                  const usmcaGain = warning.filter(p => p.description?.toLowerCase().includes('usmca') || p.description?.toLowerCase().includes('tmec')).length * 7
                  const efirmaGain = unresolved.some(p => p.description?.toLowerCase().includes('firma') || p.description?.toLowerCase().includes('sat')) ? 20 : 0
                  const projectedWithAction = Math.min(100, score + mveGain + usmcaGain + efirmaGain + 10)

                  const actions = [
                    mveGain > 0 && { label: 'Registrar MVE folios pendientes', gain: mveGain, link: '/mve' },
                    usmcaGain > 0 && { label: 'Solicitar USMCA a proveedores pendientes', gain: usmcaGain, link: '/usmca' },
                    efirmaGain > 0 && { label: 'Actualizar e.firma SAT', gain: efirmaGain, link: '/cumplimiento' },
                    { label: 'Resolver tráficos vencidos', gain: 10, link: '/traficos' },
                  ].filter(Boolean) as { label: string; gain: number; link: string }[]

                  return (
                    <div>
                      {[
                        { label: 'Actual', value: score, color: scoreColor },
                        { label: 'Sin acciones (30d)', value: projectedNoAction, color: 'var(--status-red)' },
                        { label: 'Con acciones', value: projectedWithAction, color: 'var(--status-green)' },
                      ].map(bar => (
                        <div key={bar.label} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{bar.label}</span>
                            <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: bar.color }}>{bar.value}/100</span>
                          </div>
                          <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${bar.value}%`, height: '100%', background: bar.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      ))}
                      <div style={{ marginTop: 16, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8 }}>Plan de Acción</div>
                      {actions.map((a, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}
                          onClick={() => window.location.href = a.link}>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{'[ ]'}</span>
                          <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{a.label}</span>
                          <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-green)' }}>+{a.gain} pts</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

              {/* Findings */}
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-head">
                  <span className="card-title">Hallazgos Activos ({unresolved.length})</span>
                </div>
                {unresolved.length === 0 ? (
                  <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <CheckCircle size={24} style={{ margin: '0 auto 8px', color: 'var(--status-green)' }} />
                    Sin hallazgos pendientes
                  </div>
                ) : (
                  <div>
                    {unresolved.map(p => (
                      <div key={p.id} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 20px',
                        borderBottom: '1px solid var(--border-light)',
                        borderLeft: `4px solid ${p.severity === 'critical' ? 'var(--status-red)' : p.severity === 'warning' ? 'var(--status-yellow)' : 'var(--status-blue, #2563EB)'}`,
                      }}>
                        {p.severity === 'critical' ? <AlertTriangle size={16} style={{ color: 'var(--status-red)', flexShrink: 0, marginTop: 2 }} /> :
                         p.severity === 'warning' ? <Clock size={16} style={{ color: 'var(--status-yellow)', flexShrink: 0, marginTop: 2 }} /> :
                         <Shield size={16} style={{ color: 'var(--status-blue, #2563EB)', flexShrink: 0, marginTop: 2 }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{p.description}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            {p.prediction_type?.replace(/_/g, ' ')} · {p.severity}
                            {p.due_date && ` · Fecha límite: ${new Date(p.due_date).toLocaleDateString('es-MX')}`}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '3px 8px', borderRadius: 4,
                          background: p.severity === 'critical' ? 'var(--status-red-bg)' : p.severity === 'warning' ? 'var(--status-yellow-bg)' : 'var(--status-blue-bg, #EFF6FF)',
                          color: p.severity === 'critical' ? 'var(--status-red)' : p.severity === 'warning' ? 'var(--status-yellow)' : 'var(--status-blue, #2563EB)',
                        }}>{p.severity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historical reports */}
              {reports.length > 0 && (
                <div className="card">
                  <div className="card-head">
                    <span className="card-title">Reportes Mensuales</span>
                  </div>
                  <table className="data-table">
                    <thead><tr><th>Período</th><th>Score</th><th>Resumen</th><th>Fecha</th></tr></thead>
                    <tbody>
                      {reports.map(r => (
                        <tr key={r.id}>
                          <td className="mono" style={{ fontSize: 13 }}>{r.period}</td>
                          <td><span className="mono" style={{ fontWeight: 700, color: r.score >= 80 ? 'var(--status-green)' : r.score >= 50 ? 'var(--status-yellow)' : 'var(--status-red)' }}>{r.score}</span></td>
                          <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{(r.summary || '').slice(0, 80)}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString('es-MX')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function DeadlineSection({ title, color, items }: { title: string; color: string; items: Deadline[] }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: color, opacity: 0.3 }} />
      </div>
      {items.map(item => (
        <div key={item.id} className="card" style={{
          marginBottom: 12, padding: '16px 20px',
          borderLeft: `4px solid ${item.severity === 'critical' ? 'var(--status-red)' : item.severity === 'warning' ? 'var(--status-yellow)' : 'var(--text-muted)'}`,
          cursor: 'pointer',
        }} onClick={() => window.location.href = item.link}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Calendar size={14} style={{ color: item.severity === 'critical' ? 'var(--status-red)' : item.severity === 'warning' ? 'var(--status-yellow)' : 'var(--text-muted)', flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {new Date(item.due_date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>— {item.label}</span>
              {item.severity === 'critical' && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'rgba(239,68,68,0.1)', color: 'var(--status-red)' }}>CRÍTICO</span>
              )}
            </div>
            <ExternalLink size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
          <div style={{ paddingLeft: 24 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>{item.description}</div>
            {item.penalty && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                <DollarSign size={12} />
                Penalidad: {item.penalty}
              </div>
            )}
            {item.exposure && (
              <div style={{ fontSize: 12, fontWeight: 600, color: item.severity === 'critical' ? 'var(--status-red)' : 'var(--text-secondary)', marginBottom: 4 }}>
                Exposición total: {item.exposure}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Responsable: {item.responsible}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
