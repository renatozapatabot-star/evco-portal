import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { GOLD } from '@/lib/design-system'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function RevenuePage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value
  if (role !== 'admin') redirect('/login')

  const { data: rev } = await supabase
    .from('financial_intelligence')
    .select('details')
    .eq('company_id', 'platform')
    .eq('metric_name', 'revenue_metrics')
    .single()

  const m = rev?.details || {}

  const cards = [
    { label: 'Clientes Activos', value: m.active_clients || 50, sub: 'Plataforma ZAPATA AI', color: GOLD },
    { label: 'Pedimentos', value: (m.pedimentos_processed || 0).toLocaleString(), sub: 'Procesados', color: 'var(--border)' },
    { label: 'Ahorro T-MEC', value: `$${((m.tmec_savings_usd || 0) / 1000).toFixed(0)}K`, sub: 'USD ahorrado', color: 'var(--success)' },
    { label: 'Documentos', value: (m.documents_processed || 0).toLocaleString(), sub: 'Auto-procesados', color: 'var(--border)' },
    { label: 'Horas Ahorradas', value: m.estimated_hours_saved || 0, sub: 'Automatización', color: GOLD },
    { label: 'Conversaciones AI', value: m.ai_conversations || 0, sub: 'ZAPATA AI queries', color: 'var(--border)' },
  ]

  const saasMonthly = (m.saas_value_monthly_mxn || 175000).toLocaleString()
  const saasAnnual = (m.saas_value_annual_mxn || 2100000).toLocaleString()

  return (
    <div style={{ fontFamily: 'var(--font-geist-sans)', color: 'var(--border)' }} className="p-4 md:px-7 md:py-6">
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Motor de Ingresos</h1>
      <p style={{ color: '#666', fontSize: 13, margin: '0 0 24px' }}>Visión ejecutiva del valor generado por ZAPATA AI</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {cards.map(c => (
          <div key={c.label} style={{ background: 'var(--navy-900)', border: '1px solid #2A2A2A', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'linear-gradient(135deg, rgba(192,197,206,0.1), rgba(168,122,34,0.05))', border: '1px solid rgba(192,197,206,0.3)', borderRadius: 12, padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Valor Plataforma (modelo SaaS)</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>50 clientes x $3,500 MXN/mes</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: GOLD }}>MX${saasMonthly}<span style={{ fontSize: 14, fontWeight: 400, color: '#666' }}>/mes</span></div>
          </div>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Valor anualizado</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: GOLD }}>MX${saasAnnual}<span style={{ fontSize: 14, fontWeight: 400, color: '#666' }}>/año</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
