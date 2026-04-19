/**
 * CRUZ · Block 17 — MVE Alerts list (broker/admin/operator only).
 *
 * Kept separate from `/mve` (client-facing) per core-invariant #6:
 * compliance alerts do not render on the client dashboard. This page shows
 * active mve_alerts with sort/filter + manual scan trigger.
 */

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ACCENT_SILVER, ACCENT_SILVER_DIM, GLOW_SILVER, BG_ELEVATED } from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'

type Severity = 'info' | 'warning' | 'critical'

interface MveAlert {
  id: string
  pedimento_id: string
  trafico_id: string
  company_id: string
  severity: Severity
  deadline_at: string
  days_remaining: number
  message: string | null
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

const SEVERITY_COLOR: Record<Severity, { text: string; bg: string; border: string }> = {
  critical: { text: 'var(--portal-status-red-fg)', bg: 'var(--portal-status-red-bg)', border: 'rgba(239,68,68,0.35)' },
  warning:  { text: '#FCD34D', bg: 'var(--portal-status-amber-bg)', border: 'rgba(251,191,36,0.35)' },
  info:     { text: ACCENT_SILVER, bg: 'rgba(192,197,206,0.08)', border: 'rgba(192,197,206,0.25)' },
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 }

async function emitTelemetry(event: string, metadata: Record<string, unknown>): Promise<void> {
  try {
    await fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, entityType: 'mve_alert', metadata }),
    })
  } catch {
    // telemetry is fire-and-forget
  }
}

export default function MveAlertsPage() {
  const [alerts, setAlerts] = useState<MveAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)
  const [clientFilter, setClientFilter] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/data?table=mve_alerts&limit=500&order_by=deadline_at&order_dir=asc`
      const r = await fetch(url)
      const j = await r.json()
      const rows = (j.data ?? []) as MveAlert[]
      setAlerts(rows)
    } catch (err) {
      console.error('[mve-alerts] fetch failed:', err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!loading && alerts.length > 0) {
      for (const a of alerts) {
        void emitTelemetry('mve_alert_viewed', {
          alertId: a.id,
          severity: a.severity,
          days_remaining: a.days_remaining,
        })
      }
    }
  }, [loading, alerts])

  const visible = useMemo(() => {
    let out = alerts.filter((a) => (showResolved ? true : !a.resolved))
    if (clientFilter.trim()) {
      const q = clientFilter.trim().toLowerCase()
      out = out.filter((a) => a.company_id.toLowerCase().includes(q))
    }
    return [...out].sort((a, b) => {
      const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (s !== 0) return s
      return a.deadline_at.localeCompare(b.deadline_at)
    })
  }, [alerts, showResolved, clientFilter])

  const runManualScan = useCallback(async () => {
    setScanning(true)
    setScanResult(null)
    try {
      const r = await fetch('/api/mve/scan?manual=1')
      const j = await r.json()
      if (j.error) {
        setScanResult(`Error: ${j.error.message}`)
      } else {
        const d = j.data
        setScanResult(
          `Escaneo: ${d.scanned} revisados · ${d.created} nuevos · ${d.updated} actualizados · ${d.critical} críticos`,
        )
        void emitTelemetry('mve_scan_completed', d)
        await load()
      }
    } catch (err) {
      setScanResult(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setScanning(false)
    }
  }, [load])

  const resolve = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/mve/alerts/${id}/resolve`, { method: 'PATCH' })
      const j = await r.json()
      if (!j.error) {
        void emitTelemetry('mve_alert_resolved', { alertId: id })
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, resolved: true, resolved_at: new Date().toISOString() } : a)),
        )
      }
    } catch (err) {
      console.error('[mve-alerts] resolve failed:', err instanceof Error ? err.message : String(err))
    }
  }, [])

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[20px] font-semibold" style={{ color: 'var(--portal-fg-1)' }}>
            Monitor MVE
          </h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: ACCENT_SILVER_DIM }}>
            Alertas de manifestación de valor por cliente. Auto-escaneo cada 30 min.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runManualScan}
            disabled={scanning}
            className="rounded-[8px] px-4 py-2 text-[13px] font-medium"
            style={{
              minHeight: 44,
              background: BG_ELEVATED,
              border: `1px solid ${ACCENT_SILVER_DIM}`,
              color: 'var(--portal-fg-1)',
              boxShadow: `0 0 0 1px ${GLOW_SILVER}`,
              cursor: scanning ? 'wait' : 'pointer',
              opacity: scanning ? 0.6 : 1,
            }}
          >
            {scanning ? 'Escaneando…' : 'Ejecutar escaneo manual'}
          </button>
        </div>
      </div>

      {scanResult && (
        <div
          className="rounded-[10px] px-4 py-3 mb-4 text-[12.5px]"
          style={{
            background: BG_ELEVATED,
            border: `1px solid ${ACCENT_SILVER_DIM}`,
            color: ACCENT_SILVER,
          }}
        >
          {scanResult}
        </div>
      )}

      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <label className="flex items-center gap-2 text-[12.5px]" style={{ color: ACCENT_SILVER_DIM }}>
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            style={{ minWidth: 16, minHeight: 16 }}
          />
          Mostrar resueltas
        </label>
        <input
          type="text"
          placeholder="Filtrar por cliente…"
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-[6px] px-3 py-1.5 text-[12.5px] outline-none"
          style={{
            background: BG_ELEVATED,
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--portal-fg-1)',
            minHeight: 36,
            width: 220,
          }}
        />
      </div>

      {loading && (
        <div className="text-[13px]" style={{ color: ACCENT_SILVER_DIM }}>
          Cargando alertas…
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div
          className="rounded-[10px] p-10 text-center"
          style={{
            background: BG_ELEVATED,
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="text-[28px] mb-2">✅</div>
          <div className="text-[14px] font-semibold mb-1" style={{ color: 'var(--portal-fg-1)' }}>
            Sin alertas activas
          </div>
          <div className="text-[12.5px]" style={{ color: ACCENT_SILVER_DIM }}>
            Todas las manifestaciones de valor están dentro de plazo.
          </div>
        </div>
      )}

      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {visible.map((a) => {
          const palette = SEVERITY_COLOR[a.severity]
          return (
            <article
              key={a.id}
              className="rounded-[16px] p-4"
              style={{
                background: BG_ELEVATED,
                border: `1px solid ${palette.border}`,
                boxShadow: `0 6px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`,
                opacity: a.resolved ? 0.55 : 1,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-[10.5px] font-bold uppercase tracking-[0.08em] px-2 py-1 rounded-[4px]"
                  style={{ background: palette.bg, color: palette.text, border: `1px solid ${palette.border}` }}
                >
                  {a.severity === 'critical' ? 'Crítica' : a.severity === 'warning' ? 'Urgente' : 'Informativa'}
                </span>
                <span
                  className="text-[20px] font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: palette.text }}
                >
                  {a.days_remaining}d
                </span>
              </div>

              <div className="mb-2">
                <div
                  className="text-[10px] uppercase tracking-[0.08em] mb-0.5"
                  style={{ color: ACCENT_SILVER_DIM }}
                >
                  Cliente
                </div>
                <div className="text-[13px]" style={{ color: 'var(--portal-fg-1)' }}>
                  {a.company_id}
                </div>
              </div>

              <div className="mb-2">
                <div
                  className="text-[10px] uppercase tracking-[0.08em] mb-0.5"
                  style={{ color: ACCENT_SILVER_DIM }}
                >
                  Embarque
                </div>
                <div className="text-[12.5px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--portal-fg-1)' }}>
                  {a.trafico_id}
                </div>
              </div>

              <div className="mb-3">
                <div
                  className="text-[10px] uppercase tracking-[0.08em] mb-0.5"
                  style={{ color: ACCENT_SILVER_DIM }}
                >
                  Vencimiento
                </div>
                <div className="text-[12px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--portal-fg-1)' }}>
                  {fmtDateTime(a.deadline_at)}
                </div>
              </div>

              {a.message && (
                <div className="text-[12px] mb-3" style={{ color: ACCENT_SILVER_DIM }}>
                  {a.message}
                </div>
              )}

              <div className="flex items-center gap-2">
                <a
                  href={`/embarques/${encodeURIComponent(a.trafico_id)}`}
                  className="text-[12.5px] font-medium"
                  style={{ color: ACCENT_SILVER, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
                >
                  Ver embarque →
                </a>
                {!a.resolved && (
                  <button
                    type="button"
                    onClick={() => resolve(a.id)}
                    className="ml-auto rounded-[6px] px-3 py-1.5 text-[12px] font-medium"
                    style={{
                      minHeight: 44,
                      background: 'rgba(192,197,206,0.08)',
                      border: `1px solid ${ACCENT_SILVER_DIM}`,
                      color: 'var(--portal-fg-1)',
                      cursor: 'pointer',
                    }}
                  >
                    Marcar como resuelto
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
