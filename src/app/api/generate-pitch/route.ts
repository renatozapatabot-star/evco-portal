import { NextRequest, NextResponse } from 'next/server'
import { getErrorMessage } from '@/lib/errors'
import { createClient } from '@supabase/supabase-js'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { rfc } = await req.json()
  if (!rfc) return NextResponse.json({ error: 'RFC required' }, { status: 400 })

  // Get prospect data
  const { data: prospect } = await supabase
    .from('trade_prospects')
    .select('*')
    .eq('rfc', rfc)
    .single()

  if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 })

  // Get sightings
  const { data: sightings } = await supabase
    .from('prospect_sightings')
    .select('*')
    .eq('prospect_rfc', rfc)
    .order('fecha_pago', { ascending: false })
    .limit(20)

  // Generate pitch with Claude
  const prompt = `Genera una propuesta comercial profesional y personalizada en español para captar como cliente a esta empresa importadora.

EMPRESA PROSPECTO:
- Razón Social: ${prospect.razon_social || 'N/A'}
- RFC: ${prospect.rfc}
- Valor total importado: $${Math.round(prospect.total_valor_usd || 0).toLocaleString()} USD
- Total pedimentos: ${prospect.total_pedimentos}
- Régimen principal: ${prospect.primary_regime || 'Importación definitiva'}
- Usa IMMEX: ${prospect.uses_immex ? 'Sí' : 'No'}
- T-MEC elegible: ${prospect.likely_tmec_eligible ? 'Sí' : 'No'}
- Ahorro T-MEC estimado: $${Math.round(prospect.tmec_savings_opportunity_mxn || 0).toLocaleString()} MXN/año
- Proveedores principales: ${prospect.top_proveedores?.map((p: { name?: string }) => p.name).join(', ') || 'N/A'}
- Operaciones recientes: ${sightings?.slice(0, 5).map((s: { pedimento?: string; valor_usd?: number; proveedor?: string }) => `${s.pedimento} ($${Math.round(s.valor_usd || 0).toLocaleString()} USD, ${s.proveedor})`).join('; ') || 'N/A'}

NUESTRA EMPRESA:
- Renato Zapata & Company
- Patente Aduanal 3596, Aduana 240 Nuevo Laredo
- Director General: Renato Zapata III
- Especialidad: Importación/exportación U.S.-México
- Tecnología: CRUZ — sistema de inteligencia aduanal con AI
- Experiencia: 50+ clientes activos
- Valor gestionado: $42M+ USD anuales

ESTRUCTURA DE LA PROPUESTA:
1. Saludo personalizado mencionando la empresa por nombre
2. "Notamos que [empresa] importa regularmente por Aduana 240..."
3. 3 beneficios específicos basados en SUS datos:
   - Si T-MEC elegible: ahorro estimado en aranceles
   - Si alto volumen: eficiencia operativa
   - Si IMMEX: experiencia en régimen temporal
4. Nuestra propuesta de valor (tecnología CRUZ, servicio personalizado)
5. Datos de contacto y siguiente paso sugerido

Tono: profesional pero cercano, como un experto hablando con otro empresario.
Máximo 400 palabras. Directo al punto.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const pitchText = data.content?.[0]?.text || 'Error generating pitch'

    // Save to prospect record
    await supabase.from('trade_prospects').update({
      notes: `[Propuesta generada ${new Date().toLocaleDateString('es-MX')}]\n\n${pitchText}`,
      updated_at: new Date().toISOString(),
    }).eq('rfc', rfc)

    return NextResponse.json({
      pitch: pitchText,
      prospect: {
        razon_social: prospect.razon_social,
        rfc: prospect.rfc,
        total_valor_usd: prospect.total_valor_usd,
        estimated_annual_fees_mxn: prospect.estimated_annual_fees_mxn,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}
