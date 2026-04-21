'use client'

import type { HeartbeatData, SyncSource } from '@/hooks/use-god-view-data'
import { fmtDateTime } from '@/lib/format-utils'

interface Props {
  heartbeat: HeartbeatData | null
  syncSources: SyncSource[]
  syncAllHealthy: boolean
  error?: string
}

interface ServiceStatus {
  label: string
  ok: boolean
  detail?: string
}

export function SystemHeartbeat({ heartbeat, syncSources, syncAllHealthy, error }: Props) {
  if (error && !heartbeat) {
    return (
      <div className="god-heartbeat god-heartbeat--error">
        <span className="god-hb-dot" style={{ background: 'var(--text-muted)' }} />
        <span className="god-hb-label">Sistema — sin datos</span>
      </div>
    )
  }

  const services: ServiceStatus[] = [
    { label: 'PM2', ok: heartbeat?.pm2_ok ?? true },
    { label: 'Supabase', ok: heartbeat?.supabase_ok ?? true },
    { label: 'Vercel', ok: heartbeat?.vercel_ok ?? true },
    { label: 'Syncs', ok: syncAllHealthy, detail: syncSources.filter(s => !s.healthy).map(s => s.source).join(', ') || undefined },
    { label: 'Email', ok: heartbeat?.sync_ok ?? true },
  ]

  const allOk = services.every(s => s.ok)
  const failing = services.filter(s => !s.ok)

  return (
    <div className={`god-heartbeat${!allOk ? ' god-heartbeat--warn' : ''}`}>
      <div className="god-hb-services">
        {services.map(s => (
          <div key={s.label} className="god-hb-service" title={s.detail || s.label}>
            <span
              className="god-hb-dot"
              style={{ background: s.ok ? 'var(--success-500, #16A34A)' : 'var(--danger-500, #DC2626)' }}
            />
            <span className="god-hb-label">{s.label}</span>
          </div>
        ))}
      </div>

      {failing.length > 0 && (
        <span className="god-hb-alert">
          {failing.map(f => f.label).join(', ')} — requiere atención
        </span>
      )}

      {heartbeat?.created_at && (
        <span className="god-hb-time font-mono">
          {fmtDateTime(heartbeat.created_at)}
        </span>
      )}
    </div>
  )
}
