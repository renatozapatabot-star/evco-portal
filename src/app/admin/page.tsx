import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { GOLD, GOLD_HOVER, GOLD_GRADIENT, GREEN, AMBER, RED } from '@/lib/design-system'
import { fmtDate, fmtDateTime } from '@/lib/format-utils'

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
  const [companiesRes, alertsRes, healthRes] = await Promise.all([
    supabase.from('companies').select('*').eq('active', true).order('traficos_count', { ascending: false, nullsFirst: false }),
    supabase.from('compliance_predictions').select('company_id, severity').eq('resolved', false),
    supabase.from('integration_health').select('*').order('checked_at', { ascending: false })
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

  const T = {
    bg: 'var(--bg-dark)', surface: 'var(--navy-900)', border: '#2A2A2A',
    text: '#E8E6E0', sub: '#9C9690', muted: '#666',
    gold: GOLD, green: GREEN, amber: AMBER, red: RED,
  }

  function healthBadge(score: number) {
    if (score >= 80) return { bg: 'rgba(22,163,74,0.15)', color: '#16A34A', border: 'rgba(22,163,74,0.3)' }
    if (score >= 60) return { bg: 'rgba(217,119,6,0.15)', color: '#D97706', border: 'rgba(217,119,6,0.3)' }
    return { bg: 'rgba(220,38,38,0.15)', color: 'var(--danger-500)', border: 'rgba(220,38,38,0.3)' }
  }

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'var(--font-sans)', color: T.text, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, background: GOLD_GRADIENT,
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: '#1A1710', fontFamily: 'Georgia, serif' }}>Z</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            CRUZ ADMIN — Fleet Intelligence
          </h1>
        </div>
        <p style={{ color: T.muted, fontSize: 13, margin: '4px 0 0 48px' }}>
          {totalClients} clients &middot; Aduana 240 Nuevo Laredo &middot; <span style={{ fontFamily: 'var(--font-mono)' }}>{fmtDate(new Date())}</span>
        </p>
      </div>

      {/* Fleet KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
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
              color: btn.label.includes('Nuevo') ? '#1A1710' : T.text,
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
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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

      {/* Integration Health */}
      {integrations.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', marginTop: 24 }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: T.sub, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Integration Health
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1, padding: 1 }}>
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
  )
}
