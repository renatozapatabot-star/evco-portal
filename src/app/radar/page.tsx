import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { GOLD, RED, AMBER, GREEN } from '@/lib/design-system'
import { fmtDateTimeLocal } from '@/lib/format-utils'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function RadarPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value
  if (role !== 'admin') redirect('/login')

  const { data: signals } = await supabase
    .from('risk_signals')
    .select('*')
    .order('detected_at', { ascending: false })
    .limit(20)

  const { data: bridgeData } = await supabase
    .from('bridge_intelligence')
    .select('bridge_name, crossing_hours')
    .eq('day_of_week', new Date().getDay())
    .order('crossing_hours', { ascending: true })
    .limit(20)

  const sevColor: Record<string, string> = { critical: RED, high: AMBER, medium: GOLD, low: GREEN }
  const sevBg: Record<string, string> = { critical: 'rgba(220,38,38,0.1)', high: 'rgba(217,119,6,0.1)', medium: 'rgba(192,197,206,0.1)', low: 'rgba(22,163,74,0.1)' }

  return (
    <div style={{ fontFamily: 'var(--font-geist-sans)', color: 'var(--border)' }} className="p-4 md:px-7 md:py-6">
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Radar de Riesgos</h1>
      <p style={{ color: '#666', fontSize: 13, margin: '0 0 24px' }}>
        Monitoreo de amenazas en tiempo real &middot; <span style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{fmtDateTimeLocal(new Date()).split(' · ')[1] || fmtDateTimeLocal(new Date())}</span> CST
      </p>

      {(!signals || signals.length === 0) ? (
        <div style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🟢</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>Sin riesgos activos</div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Condiciones normales en todos los puentes y rutas</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {signals.map((s: { severity?: string; category?: string; source?: string; title?: string; description?: string }, i: number) => (
            <div key={i} style={{
              background: sevBg[s.severity || ''] || sevBg.low,
              border: `1px solid ${sevColor[s.severity || ''] || sevColor.low}30`,
              borderRadius: 12, padding: '16px 20px', borderLeft: `4px solid ${sevColor[s.severity || ''] || sevColor.low}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: sevColor[s.severity || ''] || '#666' }}>
                  {s.severity === 'critical' ? '🔴' : s.severity === 'high' ? '🟡' : '🟢'} {s.category}
                </span>
                <span style={{ fontSize: 11, color: '#666' }}>{s.source}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{s.title}</div>
              {s.description && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>{s.description}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Bridge Summary */}
      {bridgeData && bridgeData.length > 0 && (
        <div style={{ background: 'var(--navy-900)', border: '1px solid #2A2A2A', borderRadius: 12, padding: 20, marginTop: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>Estado de Puentes</h2>
          {(() => {
            const bridgeMap: Record<string, number[]> = {}
            bridgeData.forEach((b: { bridge_name: string; crossing_hours: number }) => { if (!bridgeMap[b.bridge_name]) bridgeMap[b.bridge_name] = []; bridgeMap[b.bridge_name].push(b.crossing_hours) })
            return Object.entries(bridgeMap).map(([name, hours]) => {
              const avg = hours.reduce((a, b) => a + b, 0) / hours.length
              return (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', minHeight: 60, borderBottom: '1px solid #2A2A2A' }}>
                  <span style={{ fontSize: 14 }}>{name}</span>
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono)', color: avg > 2 ? 'var(--danger-500)' : avg > 1 ? 'var(--warning-500, #D97706)' : 'var(--success)', fontWeight: 700 }}>{Math.round(avg * 60)}min</span>
                </div>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}
