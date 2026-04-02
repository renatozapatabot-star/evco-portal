import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest) {
  const companyId = request.cookies.get('company_id')?.value ?? ''
  const [trafRes, entRes] = await Promise.all([
    supabase.from('traficos').select('trafico, estatus, transportista_extranjero, transportista_mexicano, fecha_llegada, peso_bruto').eq('company_id', companyId).not('transportista_extranjero', 'is', null).gte('fecha_llegada', PORTAL_DATE_FROM).limit(5000),
    supabase.from('entradas').select('trafico, tiene_faltantes, mercancia_danada').eq('company_id', companyId).limit(10000),
  ])

  const traficos = trafRes.data || []
  const entradas = entRes.data || []

  const entMap: Record<string, { f: number; d: number; t: number }> = {}
  entradas.forEach((e: any) => {
    if (!entMap[e.trafico]) entMap[e.trafico] = { f: 0, d: 0, t: 0 }
    entMap[e.trafico].t++
    if (e.tiene_faltantes) entMap[e.trafico].f++
    if (e.mercancia_danada) entMap[e.trafico].d++
  })

  const carriers: Record<string, { shipments: number; peso: number; faltantes: number; danos: number; entradas: number; cruzados: number }> = {}
  traficos.forEach((t: any) => {
    const c = t.transportista_extranjero
    if (!c) return
    if (!carriers[c]) carriers[c] = { shipments: 0, peso: 0, faltantes: 0, danos: 0, entradas: 0, cruzados: 0 }
    carriers[c].shipments++
    carriers[c].peso += t.peso_bruto || 0
    if ((t.estatus || '').toLowerCase().includes('cruz')) carriers[c].cruzados++
    const ent = entMap[t.trafico]
    if (ent) { carriers[c].entradas += ent.t; carriers[c].faltantes += ent.f; carriers[c].danos += ent.d }
  })

  const ranked = Object.entries(carriers)
    .filter(([, c]) => c.shipments >= 3)
    .sort((a, b) => b[1].shipments - a[1].shipments)
    .map(([name, c]) => {
      const incidentRate = c.entradas > 0 ? (c.faltantes + c.danos) / c.entradas : 0
      const score = Math.max(0, Math.round(100 - incidentRate * 1000))
      return {
        name, shipments: c.shipments, cruzados: c.cruzados,
        avg_peso: c.shipments > 0 ? Math.round(c.peso / c.shipments) : 0,
        faltantes_rate: c.entradas > 0 ? +((c.faltantes / c.entradas) * 100).toFixed(1) : 0,
        danos_rate: c.entradas > 0 ? +((c.danos / c.entradas) * 100).toFixed(1) : 0,
        completion_rate: c.shipments > 0 ? +((c.cruzados / c.shipments) * 100).toFixed(1) : 0,
        score,
      }
    })

  return NextResponse.json({ carriers: ranked, total_traficos: traficos.length })
}
