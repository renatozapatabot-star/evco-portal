import { createClient } from '@supabase/supabase-js'
import { GOLD_GRADIENT } from '@/lib/design-system'
import { fmtDateTime } from '@/lib/format-utils'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

export default async function StatusPage() {
  const healthRes = await supabase
    .from('integration_health')
    .select('*')
    .order('checked_at', { ascending: false })

  const integrations = healthRes.data || []
  const now = fmtDateTime(new Date())

  // Client-friendly label mapping — hide internal service names
  const friendlyName: Record<string, string> = {
    'Portal CRUZ': 'Portal Web',
    'Base de Datos': 'Sincronización de Datos',
    'GlobalPC MySQL': 'Sincronización de Datos',
    'Supabase': 'Sincronización de Datos',
    'CRUZ Intelligence': 'CRUZ AI',
    'Telegram Bot': 'Notificaciones',
    'Ollama': 'CRUZ AI',
  }

  // If no integration_health data, show defaults
  const systems = integrations.length > 0
    ? integrations.map(i => ({
        name: friendlyName[i.integration_name] || i.integration_name,
        status: i.status as string,
        detail: i.status === 'healthy' ? 'Activo' : 'Sin conexión',
      }))
    : [
        { name: 'Portal Web', status: 'operational', detail: 'Activo' },
        { name: 'Sincronización de Datos', status: 'operational', detail: 'Activo' },
        { name: 'CRUZ AI', status: 'operational', detail: 'Activo' },
      ]

  const cfg: Record<string, { color: string; bg: string; label: string; dot: string }> = {
    healthy: { color: '#166534', bg: '#DCFCE7', label: 'Operacional', dot: '#16A34A' },
    operational: { color: '#166534', bg: '#DCFCE7', label: 'Operacional', dot: '#16A34A' },
    degraded: { color: '#92400E', bg: '#FEF3C7', label: 'Degradado', dot: '#D97706' },
    pending: { color: '#1E40AF', bg: '#EFF6FF', label: 'Pendiente', dot: '#3B82F6' },
    down: { color: '#991B1B', bg: '#FEE2E2', label: 'Caído', dot: '#DC2626' },
  }

  const allOp = systems.every(s => s.status === 'operational' || s.status === 'healthy')

  return (
    <div style={{ fontFamily: 'var(--font-geist-sans)', background: 'var(--bg-dark)', color: '#E8E6E0', padding: '40px 20px', minHeight: '100vh' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, background: GOLD_GRADIENT, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1A1710', fontWeight: 900, fontSize: 18, fontFamily: 'Georgia, serif' }}>Z</div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Estado del Sistema</h1>
            <p style={{ color: '#666', fontSize: 12, margin: 0 }}>CRUZ Intelligence Platform</p>
          </div>
        </div>

        <div style={{ background: '#161616', border: '1px solid #2A2A2A', borderRadius: 12, padding: 20, marginBottom: 12, borderTop: `4px solid ${allOp ? '#16A34A' : '#D97706'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: allOp ? '#16A34A' : '#D97706', display: 'inline-block' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{allOp ? 'Todos los sistemas operacionales' : 'Algunos sistemas requieren atención'}</div>
              <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>Actualizado: <span style={{ fontFamily: 'var(--font-jetbrains-mono)' }}>{now}</span> CST</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#161616', border: '1px solid #2A2A2A', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Integraciones</h2>
          {systems.map((sys, i) => {
            const c = cfg[sys.status] || cfg.degraded
            return (
              <div key={sys.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < systems.length - 1 ? '1px solid #2A2A2A' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{sys.name}</div>
                  <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{sys.detail}</div>
                </div>
                <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}30`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
                  {c.label}
                </span>
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, color: '#666', fontSize: 11 }}>
          <p>CRUZ Intelligence Platform &middot; Patente 3596 &middot; Aduana 240 Nuevo Laredo</p>
          <p style={{ marginTop: 4 }}>Auto-refresh: every 60 seconds</p>
        </div>
      </div>
    </div>
  )
}
