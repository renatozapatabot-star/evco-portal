import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getSystemStatus() {
  const results: Record<string, any> = {}
  try {
    const start = Date.now()
    const { count } = await supabase.from('traficos').select('*', { count: 'exact', head: true }).eq('company_id', 'evco')
    results.supabase = { status: 'operational', ms: Date.now() - start, count }
  } catch (e: any) {
    results.supabase = { status: 'degraded', error: e.message }
  }
  return results
}

export const dynamic = 'force-dynamic'

export default async function StatusPage() {
  const status = await getSystemStatus()
  const now = new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const systems = [
    { name: 'Portal EVCO', status: 'operational', detail: 'evco-portal.vercel.app' },
    { name: 'Base de Datos', status: status.supabase.status, detail: status.supabase.status === 'operational' ? `${status.supabase.ms}ms · ${(status.supabase.count || 0).toLocaleString()} tráficos` : status.supabase.error },
    { name: 'GlobalPC Sync', status: 'pending', detail: 'IP whitelist pendiente — 50.84.32.162' },
    { name: 'CRUZ Intelligence', status: 'operational', detail: 'Throne · Laredo TX · qwen3.5:35b activo' },
  ]

  const cfg: Record<string, { color: string; bg: string; label: string; dot: string }> = {
    operational: { color: '#166534', bg: '#DCFCE7', label: 'Operacional', dot: '#16A34A' },
    degraded: { color: '#92400E', bg: '#FEF3C7', label: 'Degradado', dot: '#D97706' },
    pending: { color: '#1E40AF', bg: '#EFF6FF', label: 'Pendiente', dot: '#3B82F6' },
    down: { color: '#991B1B', bg: '#FEE2E2', label: 'Caído', dot: '#DC2626' },
  }

  const allOp = systems.every(s => s.status === 'operational')

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: '#F7F6F3', color: '#18160F', padding: '40px 20px', minHeight: '100vh' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ width: 40, height: 40, background: '#0D2340', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 18 }}>E</div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Estado del Sistema</h1>
            <p style={{ color: '#9C9690', fontSize: 12, margin: 0 }}>Renato Zapata & Company · CRUZ Platform</p>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E6E3DC', borderRadius: 12, padding: 20, marginBottom: 12, borderTop: `4px solid ${allOp ? '#16A34A' : '#D97706'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: allOp ? '#16A34A' : '#D97706', display: 'inline-block' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{allOp ? 'Todos los sistemas operacionales' : 'Algunos sistemas requieren atención'}</div>
              <div style={{ color: '#9C9690', fontSize: 12, marginTop: 2 }}>Actualizado: {now} CST</div>
            </div>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #E6E3DC', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#9C9690', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>Componentes</h2>
          {systems.map((sys, i) => {
            const c = cfg[sys.status] || cfg.degraded
            return (
              <div key={sys.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: i < systems.length - 1 ? '1px solid #E6E3DC' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{sys.name}</div>
                  <div style={{ color: '#9C9690', fontSize: 12, marginTop: 2 }}>{sys.detail}</div>
                </div>
                <span style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}30`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, display: 'inline-block' }} />
                  {c.label}
                </span>
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, color: '#9C9690', fontSize: 11 }}>
          <p>CRUZ Intelligence Platform · Patente 3596 · Aduana 240 Nuevo Laredo</p>
          <p style={{ marginTop: 4 }}><a href="https://evco-portal.vercel.app" style={{ color: '#B8860B' }}>evco-portal.vercel.app</a></p>
        </div>
      </div>
    </div>
  )
}
