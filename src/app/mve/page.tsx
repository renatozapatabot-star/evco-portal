'use client'

import { useEffect, useState, useMemo } from 'react'
import { AlertTriangle, CheckCircle, Clock, Search } from 'lucide-react'
import { getClientClaveCookie, getCompanyIdCookie } from '@/lib/client-config'
import { fmtDate as fmtDateUtil, fmtPedimento } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'
import { BG_ELEVATED } from '@/lib/design-system'

interface TraficoRow {
  trafico: string
  estatus?: string
  fecha_llegada?: string | null
  descripcion_mercancia?: string | null
  pedimento?: string | null
  [key: string]: unknown
}

const fmtId = (id: string) => {
  const clave = getClientClaveCookie()
  const clean = (id ?? '').replace(/[\u2013\u2014]/g, '-')
  return clean.startsWith(`${clave}-`) ? clean : `${clave}-${clean}`
}

const fmtDate = (s: string | null | undefined) => fmtDateUtil(s)

function getDaysLeft(deadline: Date | null) {
  if (!deadline) return null
  const diff = deadline.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export default function MvePage() {
  const isMobile = useIsMobile()
  const [rows, setRows] = useState<TraficoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  type CompAlert = { id?: string; title?: string; description?: string; due_date?: string; days_until?: number | null; severity?: string }
  const [compAlerts, setCompAlerts] = useState<CompAlert[]>([])
  const [mveDeadline, setMveDeadline] = useState<Date | null>(null)
  const daysLeft = getDaysLeft(mveDeadline)

  useEffect(() => {
    const companyId = getCompanyIdCookie()
    const clientClave = getClientClaveCookie()
    fetch(`/api/data?table=traficos&company_id=${companyId}&limit=5000&order_by=fecha_llegada&order_dir=desc`)
      .then(r => r.json())
      .then(data => setRows(data.data ?? []))
      .catch((err: unknown) => console.error('[mve] traficos fetch failed:', (err as Error).message))
      .finally(() => setLoading(false))
    // Compliance predictions for MVE
    fetch(`/api/data?table=compliance_predictions&company_id=${companyId}&limit=50&order_by=severity&order_dir=asc`)
      .then(r => r.json())
      .then(d => setCompAlerts((d.data ?? []).filter((a: Record<string, unknown>) => !a.resolved)))
      .catch((err: unknown) => console.error('[mve] compliance fetch failed:', (err as Error).message))
    // Fetch MVE deadline from deadlines table (not hardcoded)
    fetch(`/api/data?table=deadlines&company_id=${companyId}&limit=10&order_by=deadline&order_dir=desc`)
      .then(r => r.json())
      .then(d => {
        const deadlines = d.data ?? []
        const mve = deadlines.find((dl: Record<string, unknown>) => dl.type === 'MVE')
        if (mve?.deadline) setMveDeadline(new Date(mve.deadline as string))
      })
      .catch((err: unknown) => console.error('[mve] deadlines fetch failed:', (err as Error).message))
  }, [])

  const { pending, compliant } = useMemo(() => {
    const filtered = search.trim()
      ? rows.filter(r => fmtId(r.trafico).toLowerCase().includes(search.toLowerCase()) ||
          (r.descripcion_mercancia ?? '').toLowerCase().includes(search.toLowerCase()))
      : rows
    // Embarques "En Proceso" without pedimento are MVE-pending
    const pending = filtered.filter(r => (r.estatus ?? '').toLowerCase().includes('proceso'))
    const compliant = filtered.filter(r => (r.estatus ?? '').toLowerCase().includes('cruz'))
    return { pending, compliant }
  }, [rows, search])

  const isUrgent = daysLeft !== null && daysLeft <= 3
  const isToday = daysLeft !== null && daysLeft === 0

  return (
    <div className="p-6">
      {/* Deadline Banner */}
      <div
        className={`rounded-[10px] px-5 py-4 mb-5 flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}
        style={{
          background: isUrgent ? 'var(--danger-bg)' : 'var(--warning-bg)',
          border: `1px solid ${isUrgent ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
        }}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle
            size={20} strokeWidth={1.8}
            style={{ color: isUrgent ? 'var(--danger)' : 'var(--warning)' }}
          />
          <div>
            <div className="text-[14px] font-semibold" style={{ color: isUrgent ? 'var(--danger-text)' : 'var(--warning-text)' }}>
              MVE Deadline{mveDeadline ? ` — ${fmtDate(mveDeadline.toISOString())}` : ' — Cargando...'}
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: isUrgent ? 'var(--danger)' : 'var(--warning)' }}>
              Todos los embarques en proceso deben tener folio MVE (formato E2) antes de esta fecha
            </div>
          </div>
        </div>
        <div
          className={`mono text-[28px] font-bold ${isUrgent ? 'mve-dot' : ''}`}
          style={{ color: isUrgent ? 'var(--danger)' : 'var(--warning)' }}
        >
          {daysLeft !== null ? `${daysLeft}d` : '...'}
        </div>
      </div>

      {/* KPI Row */}
      <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-3'} gap-3 mb-5`}>
        <div className="rounded-[10px] p-4" style={{ background: BG_ELEVATED, border: '1px solid rgba(0,0,0,0.07)' }}>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: 'var(--text-secondary)' }}>Total Embarques</div>
          <div className="mono text-[22px] font-semibold" style={{ color: 'var(--text-primary)' }}>{rows.length.toLocaleString()}</div>
        </div>
        <div className="rounded-[10px] p-4" style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: 'var(--danger-text)' }}>Pendiente MVE</div>
          <div className="mono text-[22px] font-semibold" style={{ color: 'var(--danger)' }}>{pending.length.toLocaleString()}</div>
        </div>
        <div className="rounded-[10px] p-4" style={{ background: 'var(--success-bg)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: 'var(--success)' }}>Cruzados</div>
          <div className="mono text-[22px] font-semibold" style={{ color: 'var(--success)' }}>{compliant.length.toLocaleString()}</div>
        </div>
      </div>

      {/* Compliance Predictions */}
      {compAlerts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {compAlerts.map(alert => {
            const isCritical = alert.severity === 'critical'
            return (
              <div key={alert.id} style={{
                padding: '12px 16px', marginBottom: 8, borderRadius: 'var(--r-md)',
                background: isCritical ? 'var(--danger-bg)' : 'var(--warning-bg)',
                border: `1px solid ${isCritical ? 'var(--danger-b)' : 'var(--warning-b)'}`,
                borderLeft: `4px solid ${isCritical ? 'var(--danger)' : 'var(--warning)'}`,
              }}>
                <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: isCritical ? 'var(--danger-t)' : 'var(--warning-t)' }}>
                  {alert.title || alert.description}
                </div>
                {alert.due_date && (
                  <div style={{ fontSize: 'var(--aguila-fs-compact)', color: 'var(--slate-400)', marginTop: 4 }}>
                    Fecha límite: <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(alert.due_date)}</span> · {alert.days_until != null ? <span style={{ fontFamily: 'var(--font-mono)' }}>{alert.days_until} días</span> : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Header */}
      <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-start justify-between'} mb-4`}>
        <div>
          <h1 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>Embarques Pendientes MVE</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {pending.length} embarques en proceso requieren folio MVE antes del 31/03/2026
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-[7px] px-3 py-1.5"
          style={{ background: BG_ELEVATED, border: '1px solid rgba(0,0,0,0.09)', width: isMobile ? '100%' : 260 }}>
          <Search size={13} strokeWidth={2} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input type="text" placeholder="Buscar embarque..." value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Buscar embarque MVE"
            className="flex-1 bg-transparent outline-none text-[12.5px]" style={{ color: 'var(--text-primary)' }} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-[10px] overflow-hidden" style={{ background: BG_ELEVATED, border: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="aguila-table" aria-label="Embarques pendientes MVE">
            <thead>
              <tr>
                <th style={{ width: 160 }}>Tráfico</th>
                <th style={{ width: 130 }}>Estado</th>
                <th style={{ width: 120 }}>Fecha Llegada</th>
                <th>Mercancía</th>
                <th style={{ width: 120 }}>Pedimento</th>
                <th style={{ width: 100, textAlign: 'center' }}>MVE</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td><div className="skeleton" style={{ width: 100, height: 14 }} /></td>
                  <td><div className="skeleton" style={{ width: 80, height: 14 }} /></td>
                  <td><div className="skeleton" style={{ width: 70, height: 14 }} /></td>
                  <td><div className="skeleton" style={{ width: 140, height: 14 }} /></td>
                  <td><div className="skeleton" style={{ width: 70, height: 14 }} /></td>
                  <td><div className="skeleton" style={{ width: 60, height: 14, margin: '0 auto' }} /></td>
                </tr>
              ))}
              {!loading && pending.length === 0 && (
                <tr><td colSpan={6}>
                  <EmptyState icon="✅" title="Cumplimiento completo" description="Todos los embarques cumplen con MVE" />
                </td></tr>
              )}
              {pending.map(r => (
                <tr key={r.trafico}>
                  <td><span className="mono text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>{fmtId(r.trafico)}</span></td>
                  <td>
                    <span className="badge badge-proceso"><span className="badge-dot" />En Proceso</span>
                  </td>
                  <td className="text-[12px]" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{fmtDate(r.fecha_llegada)}</td>
                  <td className="text-[12px] max-w-[220px] truncate" style={{ color: 'var(--text-primary)' }} title={r.descripcion_mercancia ?? undefined}>
                    {r.descripcion_mercancia ?? ''}
                  </td>
                  <td>
                    {r.pedimento
                      ? <span className="ped-pill">{fmtPedimento(r.pedimento)}</span>
                      : <span style={{ color: 'var(--border)' }}>—</span>}
                  </td>
                  <td className="text-center">
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px]"
                      style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
                      Pendiente
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliant section */}
      {compliant.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={14} strokeWidth={2} style={{ color: 'var(--success)' }} />
            <span className="text-[13px] font-semibold" style={{ color: 'var(--success)' }}>
              {compliant.length} embarques cruzados
            </span>
          </div>
          <div className="rounded-[10px] overflow-hidden" style={{ background: BG_ELEVATED, border: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="overflow-x-auto" style={{ maxHeight: 300 }}>
              <table className="aguila-table" aria-label="Embarques cruzados con MVE">
                <thead>
                  <tr>
                    <th>Embarque</th>
                    <th>Fecha</th>
                    <th>Pedimento</th>
                    <th style={{ textAlign: 'center' }}>MVE</th>
                  </tr>
                </thead>
                <tbody>
                  {compliant.slice(0, 50).map(r => (
                    <tr key={r.trafico}>
                      <td><span className="mono text-[12px]" style={{ color: 'var(--text-primary)' }}>{fmtId(r.trafico)}</span></td>
                      <td className="text-[12px]" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{fmtDate(r.fecha_llegada)}</td>
                      <td>{r.pedimento ? <span className="ped-pill">{fmtPedimento(r.pedimento)}</span> : ''}</td>
                      <td className="text-center">
                        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-[4px]"
                          style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>OK</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
