import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, unauthorized } from '@/lib/api-auth'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(request: NextRequest, { params }: { params: Promise<{ trafico_id: string }> }) {
  const auth = await authenticateApiKey(request)
  if (!auth) return unauthorized()

  const { trafico_id } = await params
  const { data } = await supabase.from('traficos').select('*').eq('trafico', trafico_id).eq('company_id', auth.company_id).single()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [riskRes, docsRes] = await Promise.all([
    supabase.from('pedimento_risk_scores').select('score, risk_factors').eq('trafico_id', trafico_id).single(),
    supabase.from('expediente_documentos').select('doc_type, nombre, file_url').or(`pedimento_id.eq.${trafico_id},pedimento_id.eq.${trafico_id.includes('-') ? trafico_id.split('-').slice(1).join('-') : trafico_id}`),
  ])

  return NextResponse.json({ ...data, risk_score: riskRes.data?.score, risk_factors: riskRes.data?.risk_factors, documents: docsRes.data || [] })
}
