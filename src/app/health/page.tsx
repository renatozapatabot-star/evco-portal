'use client'

import { useState, useEffect } from 'react'
import { Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

interface JobHealth {
  job_name: string
  status: string
  finished_at: string | null
  started_at: string
  rows_processed: number
  rows_failed: number
  error_message: string | null
  minutes_since: number
}

function StatusDot({ minutes, status }: { minutes: number; status: string }) {
  if (status === 'failure') return <XCircle size={16} style={{ color: 'var(--portal-status-red-fg)' }} />
  if (minutes > 60) return <AlertTriangle size={16} style={{ color: 'var(--portal-status-amber-fg)' }} />
  return <CheckCircle2 size={16} style={{ color: 'var(--portal-status-green-fg)' }} />
}

export default function HealthPage() {
  const [jobs, setJobs] = useState<JobHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/data?table=job_runs&limit=50&order_by=created_at&order_dir=desc')
      .then(r => r.json())
      .then(data => {
        // Group by job_name, take latest
        const latest: Record<string, JobHealth> = {}
        for (const row of (data.data || [])) {
          if (!latest[row.job_name]) {
            const minutesSince = (Date.now() - new Date(row.finished_at || row.started_at).getTime()) / 60000
            latest[row.job_name] = { ...row, minutes_since: minutesSince }
          }
        }
        setJobs(Object.values(latest).sort((a, b) => a.job_name.localeCompare(b.job_name)))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Activity size={24} style={{ color: 'var(--portal-fg-3)' }} />
        <h1 style={{ fontSize: 'var(--aguila-fs-headline)', fontWeight: 700, color: 'var(--portal-fg-1)', margin: 0 }}>Estado del Sistema</h1>
      </div>

      {loading && <div style={{ color: 'var(--portal-fg-4)' }}>Cargando estado...</div>}
      {error && <div style={{ color: 'var(--portal-status-red-fg)' }}>Error al cargar</div>}

      {!loading && jobs.length === 0 && (
        <div className="cc-card" style={{ padding: 40, textAlign: 'center', borderRadius: 20 }}>
          <Activity size={32} style={{ color: 'var(--portal-status-green-fg)', margin: '0 auto 12px' }} />
          <div style={{ color: 'var(--portal-status-green-fg)', fontSize: 'var(--aguila-fs-section)', fontWeight: 600 }}>Sistema operativo — sin alertas</div>
          <div style={{ color: 'var(--portal-fg-4)', fontSize: 'var(--aguila-fs-compact)', marginTop: 4 }}>Todos los procesos funcionan correctamente.</div>
        </div>
      )}

      {jobs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {jobs.map(job => (
            <div key={job.job_name} className="cc-card" style={{
              padding: '14px 20px', borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <StatusDot minutes={job.minutes_since} status={job.status} />
                <div>
                  <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 600, color: 'var(--portal-fg-1)', fontFamily: 'var(--portal-font-mono, var(--font-mono))' }}>{job.job_name}</div>
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-fg-4)' }}>
                    {job.status} · {Math.round(job.minutes_since)}m ago · {job.rows_processed} rows
                  </div>
                </div>
              </div>
              {job.error_message && (
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-status-red-fg)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {job.error_message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
