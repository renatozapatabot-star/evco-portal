import { createClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const INTENTS: Record<string, string[]> = {
  query: ['cuántos', 'cuantos', 'qué', 'que', 'cuál', 'cual', 'lista', 'muestra', 'dame', 'dime'],
  action: ['prepara', 'genera', 'manda', 'envía', 'envia', 'crea', 'solicita', 'programa'],
  check: ['verifica', 'revisa', 'checa', 'confirma', 'estado'],
  report: ['reporte', 'resumen', 'informe', 'análisis', 'analisis'],
}

export function detectIntent(message: string): string {
  const lower = message.toLowerCase()
  for (const [intent, keywords] of Object.entries(INTENTS)) {
    if (keywords.some(k => lower.includes(k))) return intent
  }
  return 'query'
}

export async function getContextData(query: string, companyId: string, clientClave: string): Promise<string> {
  const q = query.toLowerCase()
  const ctx: string[] = []

  const [tc, ec, fc] = await Promise.all([
    supabase.from('traficos').select('*', { count: 'exact', head: true }).eq('company_id', companyId).gte('fecha_llegada', PORTAL_DATE_FROM),
    supabase.from('entradas').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('aduanet_facturas').select('*', { count: 'exact', head: true }).eq('clave_cliente', clientClave),
  ])
  ctx.push(`DB: ${tc.count} tráficos, ${ec.count} entradas, ${fc.count} facturas`)

  const { count: activeCount } = await supabase.from('traficos').select('*', { count: 'exact', head: true }).eq('company_id', companyId).not('estatus', 'ilike', '%cruz%').gte('fecha_llegada', PORTAL_DATE_FROM)
  ctx.push(`Tráficos activos (no cruzados): ${activeCount}`)

  if (q.includes('deteni') || q.includes('hold')) {
    const { data } = await supabase.from('traficos').select('trafico, fecha_llegada').eq('company_id', companyId).eq('estatus', 'Detenido').gte('fecha_llegada', PORTAL_DATE_FROM).limit(10)
    ctx.push(`DETENIDOS: ${JSON.stringify(data || [])}`)
  }
  if (q.includes('faltante') || q.includes('daño') || q.includes('dano')) {
    const { data } = await supabase.from('entradas').select('cve_entrada, descripcion_mercancia').eq('company_id', companyId).eq('tiene_faltantes', true).limit(10)
    ctx.push(`FALTANTES: ${JSON.stringify(data || [])}`)
  }
  if (q.includes('valor') || q.includes('financ') || q.includes('mes') || q.includes('month') || q.includes('ahorro') || q.includes('savings')) {
    const { data } = await supabase.from('aduanet_facturas').select('valor_usd, igi').eq('clave_cliente', clientClave).gte('fecha_pago', new Date(new Date().setDate(1)).toISOString().split('T')[0])
    const total = (data || []).reduce((s: number, f: { valor_usd?: number | null }) => s + (f.valor_usd || 0), 0)
    const tmecOps = (data || []).filter((f: { igi?: number | null }) => Number(f.igi) === 0).length
    ctx.push(`Este mes: ${data?.length} ops, $${total.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD, ${tmecOps} ops T-MEC`)
  }
  if (q.includes('proveedor') || q.includes('supplier') || q.includes('top')) {
    const { data } = await supabase.from('aduanet_facturas').select('proveedor, valor_usd').eq('clave_cliente', clientClave)
    const byP: Record<string, number> = {}
    ;(data || []).forEach((f: { proveedor?: string | null; valor_usd?: number | null }) => { if (f.proveedor) byP[f.proveedor] = (byP[f.proveedor] || 0) + (f.valor_usd || 0) })
    ctx.push(`Top proveedores: ${JSON.stringify(Object.entries(byP).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5))}`)
  }
  if (q.includes('tráfico') || q.includes('trafico') || q.includes('recent') || q.includes('último') || q.includes('transmit') || q.includes('listo')) {
    const { data } = await supabase.from('traficos').select('trafico, estatus, fecha_llegada, pedimento').eq('company_id', companyId).gte('fecha_llegada', PORTAL_DATE_FROM).order('fecha_llegada', { ascending: false }).limit(10)
    ctx.push(`Últimos tráficos: ${JSON.stringify(data || [])}`)
    const ready = (data || []).filter((t: { pedimento?: string | null; estatus?: string | null }) => t.pedimento && !(t.estatus || '').toLowerCase().includes('cruz'))
    ctx.push(`Listos para transmitir: ${ready.length} tráficos con pedimento`)
  }
  if (q.includes('carrier') || q.includes('transportista') || q.includes('desempeño') || q.includes('performance')) {
    const { data } = await supabase.from('traficos').select('transportista_mexicano').eq('company_id', companyId).gte('fecha_llegada', PORTAL_DATE_FROM)
    const byCarrier: Record<string, number> = {}
    ;(data || []).forEach((t: { transportista_mexicano?: string | null }) => { if (t.transportista_mexicano) byCarrier[t.transportista_mexicano] = (byCarrier[t.transportista_mexicano] || 0) + 1 })
    ctx.push(`Carriers: ${JSON.stringify(Object.entries(byCarrier).sort((a, b) => b[1] - a[1]).slice(0, 5))}`)
  }
  if (q.includes('riesgo') || q.includes('risk') || q.includes('urgente')) {
    const { data } = await supabase.from('pedimento_risk_scores').select('trafico_id, overall_score').order('overall_score', { ascending: false }).limit(5)
    ctx.push(`Mayor riesgo: ${JSON.stringify(data || [])}`)
  }
  if (q.includes('semana') || q.includes('week') || q.includes('llegada') || q.includes('arrival')) {
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7)
    const { data } = await supabase.from('traficos').select('trafico, fecha_llegada, estatus').eq('company_id', companyId)
      .gte('fecha_llegada', new Date().toISOString().split('T')[0]).lte('fecha_llegada', nextWeek.toISOString().split('T')[0]).gte('fecha_llegada', PORTAL_DATE_FROM)
    ctx.push(`Llegadas esta semana: ${JSON.stringify(data || [])}`)
  }

  const { data: comp } = await supabase.from('compliance_predictions').select('severity, resolved').eq('company_id', companyId).limit(100)
  const unresolvedComp = (comp || []).filter((p: { severity?: string; resolved?: boolean }) => !p.resolved)
  const criticalCount = unresolvedComp.filter((p: { severity?: string }) => p.severity === 'critical').length
  const warningCount = unresolvedComp.filter((p: { severity?: string }) => p.severity === 'warning').length
  const compScore = Math.max(0, 100 - (criticalCount * 15) - (warningCount * 5))
  ctx.push(`Compliance score: ${compScore}/100 (${criticalCount} critical, ${warningCount} warnings)`)

  return ctx.join('\n')
}
