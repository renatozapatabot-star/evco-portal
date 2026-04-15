'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { GlassCard } from '@/components/aguila/GlassCard'
import { TEXT_PRIMARY, TEXT_MUTED, TEXT_SECONDARY } from '@/lib/design-system'

interface TableRow {
  name: string
  last_updated: string | null
  row_count: number | null
  age_minutes: number | null
  freshness: 'green' | 'amber' | 'red' | 'unknown'
}
interface ScriptRow {
  step: string
  last_run: string | null
  status: string | null
  duration_ms: number | null
  error_message: string | null
  age_minutes: number | null
  freshness: 'green' | 'amber' | 'red' | 'unknown'
}
interface Snapshot {
  tables: TableRow[]
  scripts: ScriptRow[]
  generated_at: string
}

const TONE_COLOR: Record<TableRow['freshness'], string> = {
  green: '#22C55E',
  amber: '#FBBF24',
  red: '#EF4444',
  unknown: TEXT_MUTED,
}

function fmtAge(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  if (min < 24 * 60) return `${Math.round(min / 60)} h`
  return `${Math.round(min / (60 * 24))} d`
}

function fmtCount(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString('es-MX')
}

export function SyncHealthClient() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/sync/status')
      .then(r => r.json())
      .then(payload => {
        if (payload.error) setError(payload.error.message ?? 'Error')
        else { setSnap(payload.data as Snapshot); setError(null) }
      })
      .catch(e => setError(e?.message ?? 'Network error'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  if (error && !snap) {
    return (
      <div style={{ padding: 24, color: '#FCA5A5' }}>
        Error cargando sync status: {error}
      </div>
    )
  }

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

      {/* Tables grid */}
      <section>
        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Tablas — frescura por fuente
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {(snap?.tables ?? []).map(t => (
            <GlassCard key={t.name} size="card" style={{ minHeight: 110, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: TEXT_PRIMARY, fontFamily: 'var(--font-mono)' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 2 }}>
                    {fmtCount(t.row_count)} filas
                  </div>
                </div>
                <span
                  aria-hidden
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: TONE_COLOR[t.freshness],
                    boxShadow: `0 0 6px ${TONE_COLOR[t.freshness]}`,
                    marginTop: 6,
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: TEXT_PRIMARY, fontFamily: 'var(--font-mono)' }}>
                  {fmtAge(t.age_minutes)}
                </span>
                <span style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  desde el último update
                </span>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Scripts grid */}
      <section>
        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Scripts — última corrida (7 días)
        </div>
        {(snap?.scripts ?? []).length === 0 ? (
          <GlassCard size="card" style={{ padding: 24, textAlign: 'center', color: TEXT_MUTED }}>
            Sin runs registrados en los últimos 7 días.
          </GlassCard>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {(snap?.scripts ?? []).map(s => (
              <GlassCard key={s.step} size="card" style={{ minHeight: 100, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: TEXT_PRIMARY, fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.step}
                    </div>
                    <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                      hace {fmtAge(s.age_minutes)}
                      {s.duration_ms != null && ` · ${(s.duration_ms / 1000).toFixed(1)}s`}
                    </div>
                  </div>
                  <span
                    aria-hidden
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: TONE_COLOR[s.freshness],
                      boxShadow: `0 0 6px ${TONE_COLOR[s.freshness]}`,
                      marginTop: 6,
                    }}
                  />
                </div>
                {s.status && (
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: s.status === 'success' ? '#22C55E' : s.status === 'failed' ? '#EF4444' : TEXT_MUTED, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {s.status}
                  </div>
                )}
                {s.error_message && (
                  <div style={{ fontSize: 'var(--aguila-fs-meta)', color: '#FCA5A5', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.error_message}
                  </div>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
