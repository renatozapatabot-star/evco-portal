import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const COMPANY_ID = 'evco'; const CLAVE = '9254'

async function getContextData(query: string) {
  const q = query.toLowerCase(); const ctx: string[] = []
  const [tc, ec, fc] = await Promise.all([
    supabase.from('traficos').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    supabase.from('entradas').select('*', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    supabase.from('aduanet_facturas').select('*', { count: 'exact', head: true }).eq('clave_cliente', CLAVE),
  ])
  ctx.push(`DB: ${tc.count} tráficos, ${ec.count} entradas, ${fc.count} facturas`)
  if (q.includes('deteni') || q.includes('hold')) {
    const { data } = await supabase.from('traficos').select('trafico, fecha_llegada').eq('company_id', COMPANY_ID).eq('estatus', 'Detenido').limit(10)
    ctx.push(`DETENIDOS: ${JSON.stringify(data || [])}`)
  }
  if (q.includes('faltante') || q.includes('daño')) {
    const { data } = await supabase.from('entradas').select('cve_entrada, descripcion_mercancia').eq('company_id', COMPANY_ID).eq('tiene_faltantes', true).limit(10)
    ctx.push(`FALTANTES: ${JSON.stringify(data || [])}`)
  }
  if (q.includes('valor') || q.includes('financ') || q.includes('mes') || q.includes('month')) {
    const { data } = await supabase.from('aduanet_facturas').select('valor_usd, igi').eq('clave_cliente', CLAVE).gte('fecha_pago', new Date(new Date().setDate(1)).toISOString().split('T')[0])
    const total = (data || []).reduce((s: number, f: any) => s + (f.valor_usd || 0), 0)
    ctx.push(`Este mes: ${data?.length} ops, $${total.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`)
  }
  if (q.includes('proveedor') || q.includes('supplier') || q.includes('top')) {
    const { data } = await supabase.from('aduanet_facturas').select('proveedor, valor_usd').eq('clave_cliente', CLAVE)
    const byP: any = {}; (data || []).forEach((f: any) => { if (f.proveedor) byP[f.proveedor] = (byP[f.proveedor] || 0) + (f.valor_usd || 0) })
    ctx.push(`Top proveedores: ${JSON.stringify(Object.entries(byP).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5))}`)
  }
  if (q.includes('tráfico') || q.includes('recent') || q.includes('último')) {
    const { data } = await supabase.from('traficos').select('trafico, estatus, fecha_llegada').eq('company_id', COMPANY_ID).order('fecha_llegada', { ascending: false }).limit(5)
    ctx.push(`Últimos tráficos: ${JSON.stringify(data || [])}`)
  }
  return ctx.join('\n')
}

export async function POST(request: NextRequest) {
  const { messages } = await request.json()
  const lastMsg = messages[messages.length - 1]?.content || ''
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ response: 'ANTHROPIC_API_KEY no configurada.' })
  const context = await getContextData(lastMsg)
  const sys = `Eres CRUZ, asistente de inteligencia aduanal de Renato Zapata & Company. Acceso real a datos de EVCO Plastics (Clave 9254). Experto en aduanas mexicanas y T-MEC.\n\nDATOS:\n${context}\n\nResponde en español, conciso, max 150 palabras.`
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 400, system: sys, messages: messages.slice(-6).map((m: any) => ({ role: m.role, content: m.content })) }) })
    const data = await res.json(); return NextResponse.json({ response: data.content?.[0]?.text || 'Sin respuesta' })
  } catch (e: any) { return NextResponse.json({ response: `Error: ${e.message}` }) }
}
