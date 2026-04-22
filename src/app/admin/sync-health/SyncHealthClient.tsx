'use client'

/**
 * Admin-only sync health dashboard client.
 *
 * Reads from `/api/health/data-integrity` — the single source of truth
 * shared with the ship-gate. The endpoint returns:
 *   · per-table freshness (windowed row counts)
 *   · per-sync-type health classified against the registry cadence
 *   · split verdicts (tables / critical syncs / non-critical syncs)
 *   · summary counts for the top-of-page pills
 *
 * Polls every 60s. Surfaces the critical / non-critical split
 * explicitly so operators see at a glance which reds matter for the
 * ship gate and which are "FYI, someone should look at the weekly
 * backfill."
 */

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { GlassCard } from '@/components/aguila/GlassCard'
import { TEXT_PRIMARY, TEXT_MUTED, TEXT_SECONDARY } from '@/lib/design-system'

type Band = 'green' | 'amber' | 'red' | 'unknown'

interface TableRow {
  name: string
  rows_windowed: number
  rows_total: number
  health: Band
  window_column: string | null
  window_days: number | null
  error?: string
}

interface SyncRow {
  sync_type: string
  label: string | null
  last_success_at: string | null
  last_attempt_at: string | null
  last_attempt_status: string | null
  minutes_ago: number | null
  failed_since_last_success: number
  cadence_minutes: number | null
  minutes_overdue: number
  critical: boolean
  known: boolean
  cron: string | null
  description: string | null
  health: Band
  reason: string | null
}

interface BandCounts {
  green: number
  amber: number
  red: number
  unknown: number
}

interface HealthPayload {
  tenant: string
  generated_at: string
  tables: TableRow[]
  sync_types: SyncRow[]
  tables_verdict: Band
  critical_syncs_verdict: Band
  non_critical_syncs_verdict: Band
  verdict: Band
  summary: {
    tables: BandCounts
    critical_syncs: BandCounts
    non_critical_syncs: BandCounts
  }
}

const TONE_COLOR: Record<Band, string> = {
  green: 'var(--portal-status-green-fg)',
  amber: 'var(--portal-status-amber-fg)',
  red: 'var(--portal-status-red-fg)',
  unknown: TEXT_MUTED,
}

const BAND_LABEL: Record<Band, string> = {
  green: 'Verde',
  amber: 'Amber',
  red: 'Rojo',
  unknown: 'Sin datos',
}

function fmtAge(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  if (min < 24 * 60) return `${Math.round(min / 60)} h`
  return `${Math.round(min / (60 * 24))} d`
}

function fmtCadence(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `cada ${min} min`
  if (min < 24 * 60) return `cada ${Math.round(min / 60)} h`
  return `cada ${Math.round(min / (60 * 24))} d`
}

function fmtCount(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString('es-MX')
}

export function SyncHealthClient() {
  const [snap, setSnap] = useState<HealthPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/health/data-integrity?tenant=evco')
      .then((r) => r.json().then((body) => ({ ok: r.ok, status: r.status, body })))
      .then(({ ok, body }) => {
        // The endpoint returns 503 on red verdict but still has a valid
        // body — treat the body as the truth.
        if (!body || body.error) {
          setError(body?.error?.message ?? 'Error')
        } else if (!body.tables) {
          setError(`Respuesta inválida (status ${ok ? 'ok' : 'err'})`)
        } else {
          setSnap(body as HealthPayload)
          setError(null)
        }
      })
      .catch((e) => setError(e?.message ?? 'Network error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  if (error && !snap) {
    return (
      <div style={{ padding: 24, color: 'var(--portal-status-red-fg)' }}>
        Error cargando sync status: {error}
      </div>
    )
  }

  const criticalSyncs = (snap?.sync_types ?? []).filter((s) => s.critical)
  const nonCriticalSyncs = (snap?.sync_types ?? []).filter((s) => !s.critical)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
      {/* Refresh + last-poll header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Última lectura
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_SECONDARY, fontFamily: 'var(--font-mono)' }}>
            {snap?.generated_at ? new Date(snap.generated_at).toLocaleString('es-MX', { timeZone: 'America/Chicago' }) : '—'}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: TEXT_PRIMARY, fontSize: 'var(--aguila-fs-compact)', fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
            minHeight: 40,
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Actualizando…' : 'Refrescar'}
        </button>
      </div>

      {/* Summary row — the "at a glance" the task asked for */}
      {snap && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          <SummaryPill
            label="Críticos"
            band={snap.critical_syncs_verdict}
            counts={snap.summary.critical_syncs}
            total={criticalSyncs.length}
            hint="Contribuyen al ship-gate"
          />
          <SummaryPill
            label="No críticos"
            band={snap.non_critical_syncs_verdict}
            counts={snap.summary.non_critical_syncs}
            total={nonCriticalSyncs.length}
            hint="Informativo — no bloquea deploy"
          />
          <SummaryPill
            label="Tablas"
            band={snap.tables_verdict}
            counts={snap.summary.tables}
            total={snap.tables.length}
            hint="Integridad por tenant (EVCO)"
          />
          <SummaryPill
            label="Verdict general"
            band={snap.verdict}
            counts={null}
            total={null}
            hint={snap.verdict === 'red' ? 'Ship-gate bloqueado' : snap.verdict === 'amber' ? 'Observar' : 'Todo en orden'}
          />
        </div>
      )}

      {/* Critical syncs — block ship gate when red */}
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Syncs críticos — bloquean ship-gate
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, fontFamily: 'var(--font-mono)' }}>
            {criticalSyncs.length}
          </div>
        </div>
        {criticalSyncs.length === 0 ? (
          <GlassCard size="card" style={{ padding: 24, textAlign: 'center', color: TEXT_MUTED }}>
            Sin registros en el registro crítico.
          </GlassCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {criticalSyncs.map((s) => (
              <SyncCard key={s.sync_type} sync={s} />
            ))}
          </div>
        )}
      </section>

      {/* Non-critical syncs — reported, never flip ship-gate */}
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Syncs no críticos — solo informativos
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, fontFamily: 'var(--font-mono)' }}>
            {nonCriticalSyncs.length}
          </div>
        </div>
        {nonCriticalSyncs.length === 0 ? (
          <GlassCard size="card" style={{ padding: 24, textAlign: 'center', color: TEXT_MUTED }}>
            Ningún sync no-crítico registrado.
          </GlassCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {nonCriticalSyncs.map((s) => (
              <SyncCard key={s.sync_type} sync={s} />
            ))}
          </div>
        )}
      </section>

      {/* Tables grid — tenant-windowed freshness */}
      <section>
        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Tablas — frescura por fuente (EVCO)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {(snap?.tables ?? []).map((t) => (
            <GlassCard key={t.name} size="card" style={{ minHeight: 110, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: TEXT_PRIMARY, fontFamily: 'var(--font-mono)' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 2 }}>
                    {fmtCount(t.rows_windowed)} en ventana · {fmtCount(t.rows_total)} total
                  </div>
                </div>
                <span
                  aria-hidden
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: TONE_COLOR[t.health],
                    boxShadow: `0 0 6px ${TONE_COLOR[t.health]}`,
                    marginTop: 6,
                  }}
                />
              </div>
              <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t.window_column
                  ? `ventana ${t.window_days}d en ${t.window_column}`
                  : 'lifetime (catálogo)'}
              </div>
              {t.error && (
                <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-status-red-fg)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.error}
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Components ────────────────────────────────────────────────────────

function SummaryPill({
  label,
  band,
  counts,
  total,
  hint,
}: {
  label: string
  band: Band
  counts: BandCounts | null
  total: number | null
  hint: string
}) {
  return (
    <GlassCard size="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-kpi-mid)', fontWeight: 800, color: TEXT_PRIMARY, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
            {BAND_LABEL[band]}
          </div>
          {counts && total != null && (
            <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {counts.green}/{total} verde
              {counts.amber > 0 && ` · ${counts.amber} amber`}
              {counts.red > 0 && ` · ${counts.red} rojo`}
              {counts.unknown > 0 && ` · ${counts.unknown} s/d`}
            </div>
          )}
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 6 }}>
            {hint}
          </div>
        </div>
        <span
          aria-hidden
          style={{
            width: 12, height: 12, borderRadius: '50%',
            background: TONE_COLOR[band],
            boxShadow: `0 0 10px ${TONE_COLOR[band]}`,
            flexShrink: 0,
          }}
        />
      </div>
    </GlassCard>
  )
}

function SyncCard({ sync }: { sync: SyncRow }) {
  const displayName = sync.label ?? sync.sync_type
  return (
    <GlassCard size="card" style={{ minHeight: 120, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            {sync.sync_type}
            {sync.cadence_minutes != null && ` · ${fmtCadence(sync.cadence_minutes)}`}
          </div>
        </div>
        <span
          aria-hidden
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: TONE_COLOR[sync.health],
            boxShadow: `0 0 6px ${TONE_COLOR[sync.health]}`,
            marginTop: 6,
            flexShrink: 0,
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: TEXT_PRIMARY, fontFamily: 'var(--font-mono)' }}>
          {fmtAge(sync.minutes_ago)}
        </span>
        <span style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          desde el último éxito
        </span>
      </div>
      {sync.reason && (
        <div
          style={{
            fontSize: 'var(--aguila-fs-meta)',
            color: sync.health === 'red'
              ? 'var(--portal-status-red-fg)'
              : sync.health === 'amber'
                ? 'var(--portal-status-amber-fg)'
                : TEXT_MUTED,
            marginTop: 8,
          }}
        >
          {sync.reason}
        </div>
      )}
      {sync.failed_since_last_success > 0 && sync.reason?.startsWith('Atrasado') !== true && sync.reason?.startsWith('Por encima') !== true && (
        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--portal-status-amber-fg)', marginTop: 4 }}>
          {sync.failed_since_last_success} fallo(s) desde el último éxito
        </div>
      )}
      {sync.cron && (
        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 6, fontFamily: 'var(--font-mono)' }}>
          cron: {sync.cron}
        </div>
      )}
    </GlassCard>
  )
}
