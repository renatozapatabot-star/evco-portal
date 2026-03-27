import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export const dynamic = 'force-dynamic'

export default async function CRUZDashboard() {
  const [tR, eR, fR, dR, sR, a24R, bodR] = await Promise.all([
    supabase.from('traficos').select('*', { count: 'exact', head: true }).eq('company_id', 'evco'),
    supabase.from('entradas').select('*', { count: 'exact', head: true }).eq('company_id', 'evco'),
    supabase.from('aduanet_facturas').select('*', { count: 'exact', head: true }).eq('clave_cliente', '9254'),
    supabase.from('documents').select('*', { count: 'exact', head: true }),
    supabase.from('supplier_contacts').select('*', { count: 'exact', head: true }),
    supabase.from('anexo24_pedimentos').select('*', { count: 'exact', head: true }),
    supabase.from('bodega_entradas').select('*', { count: 'exact', head: true }),
  ])

  const metrics = [
    { label: 'Tráficos', value: (tR.count || 0).toLocaleString(), icon: '🚢' },
    { label: 'Entradas', value: (eR.count || 0).toLocaleString(), icon: '📦' },
    { label: 'Facturas', value: (fR.count || 0).toLocaleString(), icon: '📄' },
    { label: 'Documentos', value: (dR.count || 0).toLocaleString(), icon: '🗂️' },
    { label: 'Proveedores', value: (sR.count || 0).toLocaleString(), icon: '🏭' },
    { label: 'Anexo24', value: (a24R.count || 0).toLocaleString(), icon: '📑' },
    { label: 'Bodega', value: (bodR.count || 0).toLocaleString(), icon: '🏪' },
  ]

  const scripts = [
    { name: 'Morning Report', schedule: '6:55 AM daily' }, { name: 'T-MEC Guardian', schedule: '7:30 AM weekdays' },
    { name: 'Entradas Anomaly', schedule: '8:00 AM daily' }, { name: 'IGI Checker', schedule: '10AM+3PM weekdays' },
    { name: 'KPI Alerts', schedule: '5:00 PM weekdays' }, { name: 'Calendar Compliance', schedule: '8:30 AM Mon' },
    { name: 'Proveedor Intel', schedule: '9:00 AM Mon' }, { name: 'Tipo Cambio', schedule: '9:00 AM weekdays' },
    { name: 'Heartbeat', schedule: 'Every 30 min' }, { name: 'Error Monitor', schedule: 'Every 6 hours' },
    { name: 'GlobalPC Sync', schedule: '1:00 AM nightly' }, { name: 'DB Backup', schedule: '2:00 AM nightly' },
    { name: 'Deep Research', schedule: 'Sunday 6 AM' }, { name: 'Executive Summary', schedule: 'Sunday 7 PM' },
    { name: 'Weekly Audit PDF', schedule: 'Sunday 10 PM' }, { name: 'Audit Email', schedule: 'Sunday 10:30 PM' },
    { name: 'WSDL Doc Sync', schedule: 'After GlobalPC' },
  ]

  const routes = [
    '/', '/traficos', '/entradas', '/pedimentos', '/expedientes', '/reportes', '/cuentas',
    '/documentos', '/oca', '/usmca', '/cotizacion', '/proveedores', '/anexo24', '/soia',
    '/carriers', '/calendario', '/immex', '/mve', '/status', '/cruz', '/demo', '/login',
  ]

  const apis = [
    '/api/data', '/api/search', '/api/chat', '/api/oca', '/api/usmca', '/api/tariff',
    '/api/rfc', '/api/tipo-cambio', '/api/bridge-times', '/api/carriers', '/api/risk-scores',
    '/api/crossing-prediction', '/api/upload', '/api/revalidate', '/api/audit', '/api/webhook', '/api/auth',
  ]

  const now = new Date().toLocaleString('es-MX', { timeZone: 'America/Chicago', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ fontFamily: "Inter, -apple-system, sans-serif", background: '#08090D', color: '#fff', padding: 32, minHeight: '100vh' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(201,168,76,0.1)', border: '1.5px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#C9A84C' }}>RZ</span>
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>CRUZ Internal Dashboard</h1>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>{now} CST</div>
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '28px 0 12px' }}>DATABASE</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {metrics.map(m => (
            <div key={m.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{m.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#C9A84C', fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '28px 0 12px' }}>AUTOMATION · {scripts.length} SCRIPTS</div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, overflow: 'hidden' }}>
          {scripts.map((s, i) => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: i < scripts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block', marginRight: 8 }} />{s.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{s.schedule}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 28 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>PORTAL ROUTES · {routes.length}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {routes.map(r => <span key={r} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 4, padding: '3px 8px', fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: "'JetBrains Mono', monospace" }}>{r}</span>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>API ENDPOINTS · {apis.length}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {apis.map(r => <span key={r} style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 4, padding: '3px 8px', fontSize: 10, color: 'rgba(201,168,76,0.7)', fontFamily: "'JetBrains Mono', monospace" }}>{r}</span>)}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 32, textAlign: 'center', color: 'rgba(255,255,255,0.12)', fontSize: 10 }}>
          CRUZ Intelligence Platform · Renato Zapata & Company · Patente 3596 · Laredo TX
        </div>
      </div>
    </div>
  )
}
