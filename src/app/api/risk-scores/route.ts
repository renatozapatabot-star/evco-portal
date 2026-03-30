import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { COMPANY_ID } from '@/lib/client-config'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const { data: traficos } = await supabase.from('traficos')
    .select('trafico, estatus, fecha_llegada, pedimento, descripcion_mercancia')
    .eq('company_id', COMPANY_ID).eq('estatus', 'En Proceso').limit(500)

  const { data: docs } = await supabase.from('documents')
    .select('trafico_id, doc_type').limit(5000)

  const { data: entradas } = await supabase.from('entradas')
    .select('trafico, tiene_faltantes, mercancia_danada').eq('company_id', COMPANY_ID).limit(5000)

  const docMap: Record<string, Set<string>> = {}
  ;(docs || []).forEach((d: any) => { if (!docMap[d.trafico_id]) docMap[d.trafico_id] = new Set(); docMap[d.trafico_id].add(d.doc_type) })

  const entMap: Record<string, { faltantes: boolean; danada: boolean }> = {}
  ;(entradas || []).forEach((e: any) => {
    if (!entMap[e.trafico]) entMap[e.trafico] = { faltantes: false, danada: false }
    if (e.tiene_faltantes) entMap[e.trafico].faltantes = true
    if (e.mercancia_danada) entMap[e.trafico].danada = true
  })

  const now = Date.now()
  const scores: Record<string, { score: number; factors: string[] }> = {}

  ;(traficos || []).forEach((t: any) => {
    let score = 0
    const factors: string[] = []

    // Days since arrival
    if (t.fecha_llegada) {
      const days = Math.floor((now - new Date(t.fecha_llegada).getTime()) / 86400000)
      if (days > 14) { score += 20; factors.push(`${days} días sin cruce (+20)`) }
      else if (days > 7) { score += 10; factors.push(`${days} días sin cruce (+10)`) }
    }

    // Missing documents
    const docSet = docMap[t.trafico]
    if (!docSet || docSet.size === 0) { score += 20; factors.push('Sin documentos (+20)') }
    else if (docSet.size < 3) { score += 10; factors.push(`Solo ${docSet.size} docs (+10)`) }

    // No USMCA cert
    if (!docSet?.has('usmca_cert') && !docSet?.has('certificado_origen')) {
      score += 10; factors.push('Sin cert USMCA (+10)')
    }

    // Faltantes
    const ent = entMap[t.trafico]
    if (ent?.faltantes) { score += 15; factors.push('Entrada con faltantes (+15)') }
    if (ent?.danada) { score += 15; factors.push('Mercancía dañada (+15)') }

    // No pedimento assigned
    if (!t.pedimento) { score += 10; factors.push('Sin pedimento asignado (+10)') }

    scores[t.trafico] = { score: Math.min(score, 100), factors }
  })

  return NextResponse.json({ scores, count: Object.keys(scores).length })
}
