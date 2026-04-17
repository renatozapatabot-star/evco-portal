/**
 * PORTAL · /admin/monitor/pipeline — sync-type health dashboard.
 *
 * Block DD Phase 4.4. Admin/broker-only. Renders the same data shape
 * the ship script consumes from /api/health/data-integrity, so the
 * floor of the page matches the gate of the deploy.
 *
 * Server component · revalidates every 30s · manual refresh via link.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { PageShell, GlassCard } from '@/components/aguila'
import { ThemeSwitcher } from '@/components/portal'
import { parsePortalTheme, PORTAL_THEME_COOKIE } from '@/lib/portal/theme'

export const dynamic = 'force-dynamic'
export const revalidate = 30

type Health = 'green' | 'amber' | 'red' | 'unknown'

interface SyncTypeReading {
  sync_type: string
  last_success_at: string | null
  minutes_ago: number | null
  failed_since_last_success: number
  health: Health
}

interface TableReading {
  name: string
  rows_windowed: number
  rows_total: number
  health: Health
}

const TONE: Record<Health, string> = {
  green: 'var(--portal-green-2, #22c55e)',
  amber: 'var(--portal-amber, #fbbf24)',
  red: 'var(--portal-red, #ef4444)',
  unknown: 'var(--portal-fg-4, #7b7f8a)',
}

function formatMinutes(m: number | null): string {
  if (m == null) return 'nunca'
  if (m < 1) return 'hace <1 min'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h}h ${m - h * 60}m`
  return `hace ${Math.floor(h / 24)}d ${h % 24}h`
}

export default async function PipelineMonitorPage() {
  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')
  if (session.role !== 'admin' && session.role !== 'broker') redirect('/')

  const theme = parsePortalTheme(cookieStore.get(PORTAL_THEME_COOKIE)?.value)
  const supabase = createServerClient()

  // Build the same probe shape /api/health/data-integrity returns, inline.
  // Keeps this page self-contained so it doesn't depend on the API route
  // during SSR (avoids the internal fetch round-trip + serverless cold-start).
  const { data: syncRows } = await supabase
    .from('sync_log')
    .select('sync_type, status, started_at, completed_at')
    .order('started_at', { ascending: false })
    .limit(2000)

  const bySyncType = new Map<string, Array<{ status: string | null; completed_at: string | null; started_at: string | null }>>()
  for (const row of (syncRows ?? []) as Array<{ sync_type: string | null; status: string | null; completed_at: string | null; started_at: string | null }>) {
    if (!row.sync_type) continue
    const arr = bySyncType.get(row.sync_type) ?? []
    arr.push(row)
    bySyncType.set(row.sync_type, arr)
  }

  const readings: SyncTypeReading[] = []
  for (const [syncType, rows] of bySyncType) {
    const lastSuccess = rows.find((r) => r.status === 'success' && r.completed_at)
    const minutesAgo = lastSuccess?.completed_at
      ? Math.max(0, Math.floor((Date.now() - new Date(lastSuccess.completed_at).getTime()) / 60_000))
      : null
    let failedSince = 0
    for (const r of rows) {
      if (r.status === 'success') break
      if (r.status === 'failed' || r.status === 'error') failedSince++
    }
    let health: Health = 'unknown'
    if (minutesAgo == null) health = 'red'
    else if (minutesAgo <= 60 * 6) health = 'green'
    else if (minutesAgo <= 60 * 24) health = 'amber'
    else health = 'red'
    readings.push({
      sync_type: syncType,
      last_success_at: lastSuccess?.completed_at ?? null,
      minutes_ago: minutesAgo,
      failed_since_last_success: failedSince,
      health,
    })
  }
  readings.sort((a, b) => a.sync_type.localeCompare(b.sync_type))

  const tables: TableReading[] = []
  const TABLE_NAMES = [
    'traficos',
    'entradas',
    'expediente_documentos',
    'globalpc_productos',
    'pedimentos',
    'globalpc_facturas',
    'globalpc_partidas',
    'aduanet_facturas',
  ]
  for (const name of TABLE_NAMES) {
    try {
      const { count } = await supabase.from(name).select('*', { count: 'estimated', head: true })
      const total = count ?? 0
      tables.push({ name, rows_windowed: total, rows_total: total, health: total > 0 ? 'green' : 'red' })
    } catch {
      tables.push({ name, rows_windowed: 0, rows_total: 0, health: 'red' })
    }
  }

  const worstSync: Health = readings.reduce<Health>((acc, r) => {
    const order = { green: 0, amber: 1, unknown: 2, red: 3 } as Record<Health, number>
    return order[r.health] > order[acc] ? r.health : acc
  }, 'green')

  const verdictTone = TONE[worstSync]

  return (
    <PageShell
      title="Pipeline monitor"
      subtitle="Estado de cada sync_type y tablas base — refresh automático cada 30 s."
      maxWidth={1100}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span
          aria-hidden
          style={{
            width: 10, height: 10, borderRadius: 999, background: verdictTone,
            boxShadow: `0 0 12px ${verdictTone}`,
          }}
        />
        <span className="portal-eyebrow" style={{ color: 'var(--portal-fg-3)' }}>
          Veredicto · {worstSync.toUpperCase()}
        </span>
        <Link
          href="/admin/monitor/pipeline"
          style={{
            marginLeft: 'auto',
            fontSize: 'var(--portal-fs-tiny, 11px)',
            color: 'var(--portal-fg-3)',
            textDecoration: 'underline dashed',
          }}
        >
          Recargar
        </Link>
      </div>

      <GlassCard tier="hero" style={{ marginBottom: 16 }}>
        <h2 className="portal-eyebrow" style={{ marginBottom: 12, color: 'var(--portal-fg-3)' }}>
          Sync types · {readings.length}
        </h2>
        {readings.length === 0 ? (
          <p style={{ color: 'var(--portal-fg-4)', margin: 0 }}>Sin registros en sync_log.</p>
        ) : (
          <table className="portal-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Sync</th>
                <th style={{ textAlign: 'left' }}>Último éxito</th>
                <th style={{ textAlign: 'right' }} className="num">Fallos desde</th>
                <th style={{ textAlign: 'left' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.sync_type}>
                  <td style={{ fontFamily: 'var(--portal-font-mono)' }}>{r.sync_type}</td>
                  <td style={{ color: 'var(--portal-fg-3)' }}>{formatMinutes(r.minutes_ago)}</td>
                  <td className="num" style={{ color: r.failed_since_last_success > 0 ? 'var(--portal-amber)' : 'var(--portal-fg-4)' }}>
                    {r.failed_since_last_success}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      color: TONE[r.health], fontWeight: 500,
                    }}>
                      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: TONE[r.health] }} />
                      {r.health}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>

      <GlassCard tier="hero" style={{ marginBottom: 16 }}>
        <h2 className="portal-eyebrow" style={{ marginBottom: 12, color: 'var(--portal-fg-3)' }}>
          Tema PORTAL (live)
        </h2>
        <ThemeSwitcher initial={theme} />
      </GlassCard>

      <GlassCard tier="hero">
        <h2 className="portal-eyebrow" style={{ marginBottom: 12, color: 'var(--portal-fg-3)' }}>
          Tablas base · {tables.length}
        </h2>
        <table className="portal-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Tabla</th>
              <th style={{ textAlign: 'right' }} className="num">Filas (estimado)</th>
              <th style={{ textAlign: 'left' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr key={t.name}>
                <td style={{ fontFamily: 'var(--portal-font-mono)' }}>{t.name}</td>
                <td className="num">{t.rows_total.toLocaleString('es-MX')}</td>
                <td>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    color: TONE[t.health], fontWeight: 500,
                  }}>
                    <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: TONE[t.health] }} />
                    {t.health}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </PageShell>
  )
}
