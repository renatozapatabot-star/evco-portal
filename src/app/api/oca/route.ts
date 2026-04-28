import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { resolveTenantScope } from '@/lib/api/tenant-scope'
import { z } from 'zod'
import { lookupKnowledge, TMEC_RULES, TIGIE_CHAPTERS } from '@/lib/cruz-knowledge'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const ocaSchema = z.object({
  product: z.string().min(3).max(1000),
  material: z.string().max(500).optional(),
  uso: z.string().max(500).optional(),
  pais_origen: z.string().max(3).default('US'),
})

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = ocaSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Descripción del producto requerida' }, { status: 400 })
  const { product, material, uso, pais_origen } = parsed.data

  const companyId = resolveTenantScope(session, request)
  if (!companyId) return NextResponse.json({ error: 'Tenant scope required' }, { status: 400 })
  const { data: company } = await supabase
    .from('companies')
    .select('name, rfc')
    .eq('company_id', companyId)
    .maybeSingle()
  const clientName = (company?.name as string | undefined) ?? ''
  const clientRfc = (company?.rfc as string | undefined) ?? ''

  // Lookup knowledge base for context
  const knowledgeContext = lookupKnowledge(product)

  // Generate next opinion number
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('oca_database')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`)
  const opinionNum = `OCA-${year}-${String((count || 0) + 1).padStart(3, '0')}`

  const tmecCountries = ['US', 'USA', 'CA', 'CAN', 'MX', 'MEX']
  const isTmecCountry = tmecCountries.includes(pais_origen.toUpperCase())

  // Use Sonnet for classification
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API de clasificación no disponible' }, { status: 503 })
  }

  const prompt = `Eres un agente aduanal senior de México con 20 años de experiencia en clasificación arancelaria.
Emite una opinión de clasificación formal para el siguiente producto.

PRODUCTO: ${product}
${material ? `MATERIAL/COMPOSICIÓN: ${material}` : ''}
${uso ? `USO ESPECÍFICO: ${uso}` : ''}
PAÍS DE ORIGEN: ${pais_origen}
IMPORTADOR: ${clientName} (RFC ${clientRfc})
NÚMERO DE OPINIÓN: ${opinionNum}

${knowledgeContext ? `CONTEXTO DE BASE DE CONOCIMIENTO CRUZ:\n${knowledgeContext}\n` : ''}
${isTmecCountry ? `T-MEC APLICA: país de origen es miembro T-MEC.\nRegla general: ${TMEC_RULES.default.rule}` : 'T-MEC NO APLICA: país de origen fuera de T-MEC.'}

Responde ÚNICAMENTE con JSON válido:
{
  "fraccion": "XXXX.XX.XX",
  "descripcion_tigie": "Descripción oficial en la TIGIE",
  "capitulo": "XX",
  "arancel_general": "X%",
  "arancel_tmec": "${isTmecCountry ? '0% con certificado USMCA' : 'No aplica'}",
  "reglas_interpretacion": ["RGI 1: ...", "RGI 6: ..."],
  "fundamento_legal": "LIGIE Artículos aplicables, Notas de Sección/Capítulo",
  "noms_aplicables": ["NOM-XXX si aplica, o vacío"],
  "tmec_elegible": ${isTmecCountry},
  "tmec_regla_origen": "${isTmecCountry ? 'Regla específica para este capítulo' : 'N/A'}",
  "analisis": "Análisis técnico de 3-5 oraciones explicando por qué esta fracción es la correcta",
  "confianza": 0.0-1.0,
  "notas": "Cualquier advertencia o consideración especial"
}`

  try {
    const start = Date.now()
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()

    if (data.error || data.type === 'error') {
      const msg = data.error?.message || ''
      if (msg.includes('credit balance')) {
        return NextResponse.json({ error: 'Créditos de API agotados — contacta soporte' }, { status: 503 })
      }
      return NextResponse.json({ error: `Error de clasificación: ${msg}` }, { status: 500 })
    }

    const text = data.content?.[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'No se pudo generar la clasificación' }, { status: 500 })
    }

    const opinion = JSON.parse(jsonMatch[0])

    // Cost tracking
    supabase.from('api_cost_log').insert({
      model: 'claude-sonnet-4-20250514',
      input_tokens: data.usage?.input_tokens || 0,
      output_tokens: data.usage?.output_tokens || 0,
      cost_usd: ((data.usage?.input_tokens || 0) * 0.003 + (data.usage?.output_tokens || 0) * 0.015) / 1000,
      action: 'oca_classification',
      client_code: companyId,
      latency_ms: Date.now() - start,
    }).then(() => {}, (e) => console.error('[audit-log] oca cost:', e.message))

    // Save to oca_database
    await supabase.from('oca_database').insert({
      opinion_number: opinionNum,
      product_description: product,
      material: material || null,
      uso: uso || null,
      fraccion: opinion.fraccion,
      confidence: opinion.confianza,
      analysis: opinion,
      company_id: companyId,
      pais_origen,
      created_by: 'CRUZ',
    }).then(() => {}, (e) => console.error('[audit-log] oca save:', e.message))

    // Audit log
    supabase.from('audit_log').insert({
      action: 'oca_generated',
      details: {
        opinion_number: opinionNum,
        fraccion: opinion.fraccion,
        product: product.substring(0, 100),
        confidence: opinion.confianza,
        company_id: companyId,
      },
      actor: 'CRUZ',
      timestamp: new Date().toISOString(),
    }).then(() => {}, (e) => console.error('[audit-log] oca generated:', e.message))

    return NextResponse.json({
      opinion_number: opinionNum,
      ...opinion,
      importador: clientName,
      rfc: clientRfc,
      firmado_por: 'Renato Zapata III — Director General',
      patente: '3596',
      aduana: '240',
      disclaimer: 'Opinión sujeta a verificación. No constituye resolución definitiva del SAT.',
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error generando clasificación'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
