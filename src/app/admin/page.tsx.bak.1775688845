import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { GOLD, GOLD_HOVER, GOLD_GRADIENT, GREEN, AMBER, RED } from '@/lib/design-system'
import { fmtDate, fmtDateTime } from '@/lib/format-utils'
import { WORKFLOW_LABELS, WORKFLOW_ORDER } from '@/lib/workflow-events'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function AdminPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value
  if (role !== 'admin') redirect('/login')

  // Parallel data fetch
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [companiesRes, alertsRes, healthRes, workflowEventsRes, recentClassRes] = await Promise.all([
    supabase.from('companies').select('*').eq('active', true).order('traficos_count', { ascending: false, nullsFirst: false }),
    supabase.from('compliance_predictions').select('company_id, severity').eq('resolved', false),
    supabase.from('integration_health').select('*').order('checked_at', { ascending: false }),
    supabase.from('workflow_events')
      .select('workflow, status, created_at')
      .gte('created_at', since24h)
      .order('created_at', { ascending: false })
      .limit(1000),
    supabase.from('globalpc_productos')
      .select('company_id, cve_producto, descripcion, fraccion, fraccion_source, fraccion_classified_at')
      .not('fraccion_classified_at', 'is', null)
      .order('fraccion_classified_at', { ascending: false })
      .limit(50),
  ])

  const companies = companiesRes.data || []
  const alerts = alertsRes.data || []
  const integrations = healthRes.data || []

  // Fleet KPIs
  const totalClients = companies.length
  const totalTraficos = companies.reduce((s, c) => s + (c.traficos_count || 0), 0)
  const totalAlerts = alerts.length
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length
  const needAttention = companies.filter(c => (c.health_score || 0) < 50).length
  const avgHealth = companies.length > 0
    ? Math.round(companies.reduce((s, c) => s + (c.health_score || 0), 0) / companies.length)
    : 0

  // Alert counts per company
  const alertMap: Record<string, number> = {}
  alerts.forEach(a => { alertMap[a.company_id] = (alertMap[a.company_id] || 0) + 1 })

  // Workflow Health aggregation (24h)
  const wfEvents = workflowEventsRes.data || []
  const recentClassifications = recentClassRes.data || []
  const stuckThresholdMs = 10 * 60 * 1000
  const now = Date.now()

  const wfByStatus: Record<string, number> = {}
  const wfByType: Record<string, { total: number; completed: number; failed: number }> = {}
  let stuckCount = 0
  let oldestStuckAge = 0

  for (const evt of wfEvents) {
    wfByStatus[evt.status] = (wfByStatus[evt.status] || 0) + 1
    if (!wfByType[evt.workflow]) wfByType[evt.workflow] = { total: 0, completed: 0, failed: 0 }
    wfByType[evt.workflow].total++
    if (evt.status === 'completed') wfByType[evt.workflow].completed++
    if (evt.status === 'failed' || evt.status === 'dead_letter') wfByType[evt.workflow].failed++
    if (evt.status === 'pending') {
      const age = now - new Date(evt.created_at).getTime()
      if (age > stuckThresholdMs) {
        stuckCount++
        if (age > oldestStuckAge) oldestStuckAge = age
      }
    }
  }
  const oldestStuckMin = Math.round(oldestStuckAge / 60000)
  const totalWfEvents = wfEvents.length
  const failedOrDead = (wfByStatus['failed'] || 0) + (wfByStatus['dead_letter'] || 0)

  // Per-client sync coverage — top 10 by traficos_count, HEAD-only count queries
  const top10 = companies.slice(0, 10)
  const syncCoverageResults = await Promise.all(
    top10.map(async (c: { company_id: string; name: string }) => {
      const [totalRes, fracRes, descRes] = await Promise.all([
        supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', c.company_id),
        supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', c.company_id).not('fraccion', 'is', null),
        supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', c.company_id).not('descripcion', 'is', null),
      ])
      return { company_id: c.company_id, name: c.name, total: totalRes.count || 0, withFraccion: fracRes.count || 0, withDescripcion: descRes.count || 0 }
    })
  )
  const syncCoverage = syncCoverageResults.filter(s => s.total > 0)

  const T = {
    bg: 'var(--bg-dark)', surface: 'var(--navy-900)', border: '#2A2A2A',
    text: 'var(--border)', sub: '#9C9690', muted: '#666',
    gold: GOLD, green: GREEN, amber: AMBER, red: RED,
  }

  function healthBadge(score: number) {
    if (score >= 80) return { bg: 'rgba(22,163,74,0.15)', color: 'var(--success)', border: 'rgba(22,163,74,0.3)' }
    if (score >= 60) return { bg: 'rgba(217,119,6,0.15)', color: 'var(--warning-500, #D97706)', border: 'rgba(217,119,6,0.3)' }
    return { bg: 'rgba(220,38,38,0.15)', color: 'var(--danger-500)', border: 'rgba(220,38,38,0.3)' }
  }

  /** Color-code fraccion_source: gold=AI, green=human, gray=globalpc */
  function sourceBadge(source: string | null) {
    if (!source) return { bg: 'rgba(102,102,102,0.15)', color: T.muted, label: '—' }
    if (source === 'ai_auto_classifier') return { bg: 'rgba(201,168,76,0.15)', color: T.gold, label: 'AI' }
    if (source.startsWith('human')) return { bg: 'rgba(22,163,74,0.15)', color: T.green, label: 'Humano' }
    return { bg: 'rgba(102,102,102,0.15)', color: T.muted, label: source }
  }

  return (
    <>
    <meta httpEquiv="refresh" content="30" />
    <div style={{ fontFamily: 'var(--font-sans)', color: T.text, minHeight: '100vh' }} className="p-4 md:px-7 md:py-6">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, background: GOLD_GRADIENT,
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>Z</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            CRUZ ADMIN — Fleet Intelligence
          </h1>
        </div>
        <p style={{ color: T.muted, fontSize: 13, margin: '4px 0 0 48px' }}>
          {totalClients} clients &middot; Aduana 240 Nuevo Laredo &middot; <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(new Date())}</span>
        </p>
      </div>

      {/* Fleet KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Active Clients', value: totalClients, color: T.gold },
          { label: 'Total Tráficos', value: totalTraficos.toLocaleString(), color: T.text },
          { label: 'Compliance Alerts', value: totalAlerts, color: totalAlerts > 0 ? T.amber : T.green },
          { label: 'Critical', value: criticalAlerts, color: criticalAlerts > 0 ? T.red : T.green },
          { label: 'Need Attention', value: needAttention, color: needAttention > 0 ? T.red : T.green },
          { label: 'Fleet Health', value: `${avgHealth}%`, color: avgHealth >= 80 ? T.green : avgHealth >= 60 ? T.amber : T.red },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: 10, padding: '16px 14px' }}>
            <div style={{ color: T.muted, fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
              textTransform: 'uppercase', marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color, letterSpacing: '-0.02em' }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2.5 mb-6">
        {[
          { label: 'Sync All Clients', href: '#', action: 'sync-all' },
          { label: 'Generate Reports', href: '#', action: 'reports' },
          { label: 'Welcome Emails (Dry Run)', href: '#', action: 'emails' },
          { label: '+ Nuevo Cliente', href: '/admin/onboard', action: '' },
        ].map(btn => (
          <Link key={btn.label} href={btn.href || '#'}
            style={{ background: btn.label.includes('Nuevo') ? GOLD_GRADIENT : T.surface,
              border: `1px solid ${btn.label.includes('Nuevo') ? 'transparent' : T.border}`,
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
              color: btn.label.includes('Nuevo') ? 'var(--text-primary)' : T.text,
              textDecoration: 'none', cursor: 'pointer' }}>
            {btn.label}
          </Link>
        ))}
      </div>

      {/* Client Health Table */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: T.sub, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Client Health
          </h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }} aria-label="Estado de salud de clientes">
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {['Client', 'Clave', 'Tráficos', 'Health Score', 'Last Sync', 'Alerts', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                  color: T.muted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.map(c => {
              const score = c.health_score || 0
              const badge = healthBadge(score)
              const clientAlerts = alertMap[c.company_id] || 0
              return (
                <tr key={c.company_id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: T.sub, fontFamily: 'var(--font-mono)' }}>{c.clave_cliente || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{(c.traficos_count || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                      borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                      {score}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: T.muted, fontFamily: 'var(--font-mono)' }}>
                    {c.last_sync ? fmtDateTime(c.last_sync) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {clientAlerts > 0 ? (
                      <span style={{ background: 'rgba(220,38,38,0.15)', color: T.red, borderRadius: 20,
                        padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{clientAlerts}</span>
                    ) : (
                      <span style={{ color: T.green, fontSize: 12 }}>0</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Link href={`/?company=${c.company_id}`}
                      style={{ color: T.gold, fontSize: 12, fontWeight: 600, textDecoration: 'none', marginRight: 12 }}>
                      Ver Portal
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* ──── WORKFLOW + INTELLIGENCE SECTIONS ──── */}

      {/* Section 1: Workflow Health — last 24h */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', marginTop: 24 }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: T.sub, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Workflow Health &mdash; 24h
          </h2>
          <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
            <span style={{ color: T.green, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{wfByStatus['completed'] || 0} completed</span>
            {failedOrDead > 0 && <span style={{ color: T.red, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{failedOrDead} failed</span>}
            {stuckCount > 0 && <span style={{ color: T.amber, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{stuckCount} stuck</span>}
            <span style={{ color: T.muted, fontFamily: 'var(--font-mono)' }}>{totalWfEvents} total</span>
          </div>
        </div>

        {stuckCount > 0 && (
          <div style={{ padding: '10px 16px', borderLeft: `4px solid ${T.red}`, background: 'rgba(220,38,38,0.08)', fontSize: 13, fontWeight: 600, color: T.red }}>
            {stuckCount} evento{stuckCount > 1 ? 's' : ''} pendiente{stuckCount > 1 ? 's' : ''} atorado{stuckCount > 1 ? 's' : ''} &mdash; el mas antiguo tiene {oldestStuckMin} min
          </div>
        )}

        {totalWfEvents === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: T.muted, fontSize: 13 }}>
            Sin eventos de workflow en las ultimas 24 horas.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }} aria-label="Workflow health last 24 hours">
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {['Workflow', 'Total', 'Completados', 'Fallidos', 'Pendientes', 'Tasa'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                      color: T.muted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WORKFLOW_ORDER.filter(w => wfByType[w]).map(w => {
                  const stats = wfByType[w]
                  const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
                  const badge = healthBadge(rate)
                  return (
                    <tr key={w} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{WORKFLOW_LABELS[w]}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{stats.total}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', color: T.green }}>{stats.completed}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)', color: stats.failed > 0 ? T.red : T.muted }}>{stats.failed}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{stats.total - stats.completed - stats.failed}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                          borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Clasificaciones Recientes — last 50 */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', marginTop: 24 }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: T.sub, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Clasificaciones Recientes
          </h2>
          <p style={{ fontSize: 11, color: T.muted, margin: '4px 0 0 0' }}>
            Ultimas 50 clasificaciones de productos
          </p>
        </div>

        {recentClassifications.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: T.muted, fontSize: 13 }}>
            Sin productos clasificados.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }} aria-label="Clasificaciones recientes de productos">
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {['Cliente', 'Cve Producto', 'Fraccion', 'Fuente', 'Descripcion', 'Clasificado'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                      color: T.muted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentClassifications.map((p: Record<string, string | null>, i: number) => {
                  const sb = sourceBadge(p.fraccion_source)
                  return (
                    <tr key={`${p.company_id}-${p.cve_producto}-${i}`} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>{p.company_id}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font-mono)', color: T.sub,
                        maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.cve_producto || '\u2014'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: T.gold }}>
                        {p.fraccion}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: sb.bg, color: sb.color, borderRadius: 20,
                          padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                          {sb.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: T.sub,
                        maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.descripcion || '\u2014'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: T.muted, fontFamily: 'var(--font-mono)' }}>
                        {p.fraccion_classified_at ? fmtDateTime(p.fraccion_classified_at) : '\u2014'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Per-Client Sync Coverage */}
      {syncCoverage.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', marginTop: 24 }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: T.sub, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Cobertura de Productos por Cliente
            </h2>
            <p style={{ fontSize: 11, color: T.muted, margin: '4px 0 0 0' }}>
              Top {syncCoverage.length} clientes por traficos &mdash; cobertura GlobalPC productos
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }} aria-label="Cobertura de productos por cliente">
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {['Cliente', 'Total Productos', 'Con Fraccion', 'Con Descripcion', 'Cobertura'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600,
                      color: T.muted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syncCoverage.map(s => {
                  const coveragePct = s.total > 0 ? Math.round((s.withFraccion / s.total) * 100) : 0
                  const badge = healthBadge(coveragePct)
                  return (
                    <tr key={s.company_id} style={{ borderBottom: `1px solid ${T.border}` }}>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{s.name}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{s.total.toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{s.withFraccion.toLocaleString()}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'var(--font-mono)' }}>{s.withDescripcion.toLocaleString()}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                          borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          {coveragePct}% ({s.withFraccion.toLocaleString()} de {s.total.toLocaleString()})
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 4: PM2 Process Status — requires process_heartbeats table.
          Create table with (process_name, status, last_heartbeat, error_message)
          and wire heartbeat writer in workflow-processor, cruz-bot, fold-agent. */}

      {/* Integration Health */}
      {integrations.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', marginTop: 24 }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: T.sub, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Integration Health
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1, padding: 1 }}>
            {integrations.map(i => (
              <div key={i.integration_name} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%',
                  background: i.status === 'healthy' ? T.green : i.status === 'degraded' ? T.amber : T.red }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{i.integration_name}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{i.response_time_ms}ms</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </>
  )
}
