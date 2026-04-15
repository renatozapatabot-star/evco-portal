import { createClient } from '@supabase/supabase-js'
import { GOLD } from '@/lib/design-system'
import { fmtDateTime, fmtDateTimeLocal } from '@/lib/format-utils'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { requireRole } from '@/lib/route-guards'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SOURCES = [
  { key: 'globalpc_delta', label: 'GlobalPC Delta', interval: '15 min', icon: '⚡' },
  { key: 'aduanet', label: 'Aduanet Pedimentos', interval: '30 min', icon: '📋' },
  { key: 'soia', label: 'SOIA / Puentes', interval: '15 min', icon: '🚦' },
  { key: 'nightly', label: 'Nightly Pipeline', interval: '1 AM daily', icon: '🌙' },
]

export default async function OperacionesPage() {
  await requireRole(['admin'])

  // Get last runs per source
  const sourceData = await Promise.all(
    SOURCES.map(async (src) => {
      const { data } = await supabase
        .from('scrape_runs')
        .select('started_at, completed_at, status, records_found, records_new, error_message')
        .eq('source', src.key)
        .order('started_at', { ascending: false })
        .limit(5)

      const last = data?.[0]
      const minutesAgo = last?.completed_at
        ? Math.round((Date.now() - new Date(last.completed_at).getTime()) / 60000)
        : null

      const last24h = (data || []).filter(r => {
        const t = new Date(r.started_at).getTime()
        return t > Date.now() - 24 * 3600000
      })
      const totalNew24h = last24h.reduce((s, r) => s + (r.records_new || 0), 0)
      const runs24h = last24h.length

      return { ...src, last, minutesAgo, runs24h, totalNew24h, recentRuns: data || [] }
    })
  )

  // Recent status changes
  const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString()
  const { data: recentChanges } = await supabase
    .from('traficos')
    .select('trafico, estatus, updated_at, company_id')
    .gte('updated_at', twoHoursAgo)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .order('updated_at', { ascending: false })
    .limit(20)

  const allHealthy = sourceData.every(s => !s.last || s.last.status === 'success')
  const now = fmtDateTimeLocal(new Date()).split(' · ')[1] || fmtDateTimeLocal(new Date())

  const statusColor = (status: string | undefined) => {
    if (!status) return '#666'
    if (status === 'success') return 'var(--success)'
    if (status === 'running') return 'var(--warning-500, #D97706)'
    return 'var(--danger-500)'
  }

  return (
    <div style={{ fontFamily: 'var(--font-geist-sans)', color: 'var(--border)' }} className="p-4 md:px-7 md:py-6">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Operaciones Autónomas</h1>
        <p style={{ color: '#666', fontSize: 'var(--aguila-fs-body)', margin: '4px 0 0' }}>
          ZAPATA AI se observa solo &middot; {now} CST &middot;
          <span style={{ color: allHealthy ? 'var(--success)' : 'var(--danger-500)', fontWeight: 700, marginLeft: 6 }}>
            {allHealthy ? 'Todos los flujos activos' : 'Requiere atención'}
          </span>
        </p>
      </div>

      {/* Source Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {sourceData.map(src => (
          <div key={src.key} style={{
            background: 'var(--navy-900)', border: '1px solid #2A2A2A', borderRadius: 12,
            padding: 16, borderTop: `3px solid ${statusColor(src.last?.status)}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 'var(--aguila-fs-headline)' }}>{src.icon}</span>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: statusColor(src.last?.status)
              }} />
            </div>
            <div style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 700, marginBottom: 4 }}>{src.label}</div>
            <div style={{ fontSize: 'var(--aguila-fs-meta)', color: '#666', marginBottom: 12 }}>Cada {src.interval}</div>

            <div style={{ fontSize: 'var(--aguila-fs-title)', fontWeight: 800, color: GOLD }}>
              {src.totalNew24h.toLocaleString()}
              <span style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 400, color: '#666', marginLeft: 4 }}>nuevos 24h</span>
            </div>

            <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', marginTop: 8 }}>
              {src.minutesAgo !== null ? (
                src.minutesAgo < 60
                  ? `Hace ${src.minutesAgo}m`
                  : `Hace ${Math.round(src.minutesAgo / 60)}h`
              ) : 'Sin datos'}
              {src.runs24h > 0 && ` · ${src.runs24h} runs`}
            </div>

            {src.last?.error_message && (
              <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--danger-500)', marginTop: 4, lineHeight: 1.3 }}>
                {src.last.error_message.substring(0, 60)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent Activity Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div style={{ background: 'var(--navy-900)', border: '1px solid #2A2A2A', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2A' }}>
            <h2 style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 700, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Últimas Ejecuciones
            </h2>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {sourceData.flatMap(s => s.recentRuns.map(r => ({ ...r, sourceLabel: s.label, sourceIcon: s.icon })))
              .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
              .slice(0, 15)
              .map((r, i) => (
                <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid #2A2A2A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ marginRight: 6 }}>{r.sourceIcon}</span>
                    <span style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600 }}>{r.sourceLabel}</span>
                    <span style={{ fontSize: 'var(--aguila-fs-meta)', color: '#666', marginLeft: 8 }}>
                      {r.records_new > 0 ? `+${r.records_new} nuevos` : 'sin cambios'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(r.status) }} />
                    <span style={{ fontSize: 'var(--aguila-fs-meta)', color: '#666', fontFamily: 'var(--font-jetbrains-mono)' }}>
                      {fmtDateTimeLocal(r.started_at).split(' · ')[1] || fmtDateTimeLocal(r.started_at)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div style={{ background: 'var(--navy-900)', border: '1px solid #2A2A2A', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #2A2A2A' }}>
            <h2 style={{ fontSize: 'var(--aguila-fs-section)', fontWeight: 700, margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cambios de Estado (2h)
            </h2>
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {(recentChanges || []).length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#666', fontSize: 'var(--aguila-fs-body)' }}>
                Sin cambios en las últimas 2 horas
              </div>
            )}
            {(recentChanges || []).map((c, i) => (
              <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid #2A2A2A', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 'var(--aguila-fs-body)', fontWeight: 600, fontFamily: 'var(--font-jetbrains-mono)' }}>{c.trafico}</span>
                  <span style={{ fontSize: 'var(--aguila-fs-compact)', marginLeft: 8,
                    color: c.estatus === 'Cruzado' ? 'var(--success)' : c.estatus === 'Detenido' ? 'var(--danger-500)' : 'var(--warning-500, #D97706)'
                  }}>{c.estatus}</span>
                </div>
                <span style={{ fontSize: 'var(--aguila-fs-meta)', color: '#666', fontFamily: 'var(--font-jetbrains-mono)' }}>
                  {fmtDateTimeLocal(c.updated_at).split(' · ')[1] || fmtDateTimeLocal(c.updated_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
