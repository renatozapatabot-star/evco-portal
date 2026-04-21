import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

interface KPIData {
  totalTraficos: number
  totalValue: number
  tmecRate: number
  successRate: number
  avgCrossingDays: string | null
}

function generateFallbackSentence(data: KPIData, clientName: string): string {
  const parts = [
    `${data.totalTraficos.toLocaleString()} embarques procesados`,
    data.totalValue > 0
      ? `$${(data.totalValue / 1e6).toFixed(1)}M USD importados`
      : null,
    data.successRate > 0 ? `${data.successRate}% tasa de éxito` : null,
    data.tmecRate > 0 ? `${data.tmecRate}% con T-MEC` : null,
  ].filter(Boolean)
  return `${clientName}: ${parts.join(' · ')}.`
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const companyId = request.cookies.get('company_id')?.value ?? ''
  const clientClave = request.cookies.get('company_clave')?.value ?? ''
  const rawName = request.cookies.get('company_name')?.value
  const clientName = rawName ? decodeURIComponent(rawName) : ''

  try {
    const prefix = `${clientClave}-%`

    const [totals, cruzados, crossing, factRes] = await Promise.all([
      supabase
        .from('traficos')
        .select('importe_total', { count: 'exact' })
        .ilike('trafico', prefix)
        .gte('fecha_llegada', PORTAL_DATE_FROM),
      supabase
        .from('traficos')
        .select('*', { count: 'exact', head: true })
        .ilike('trafico', prefix)
        .eq('estatus', 'Cruzado')
        .gte('fecha_llegada', PORTAL_DATE_FROM),
      supabase
        .from('traficos')
        .select('fecha_cruce, fecha_llegada')
        .ilike('trafico', prefix)
        .not('fecha_cruce', 'is', null)
        .not('fecha_llegada', 'is', null)
        .gte('fecha_llegada', PORTAL_DATE_FROM)
        .limit(500),
      supabase
        .from('aduanet_facturas')
        .select('igi, valor_usd', { count: 'exact' })
        .eq('clave_cliente', clientClave),
    ])

    const totalCount = totals.count ?? 0
    const cruzadosCount = cruzados.count ?? 0
    const successRate = totalCount > 0
      ? Math.round((cruzadosCount / totalCount) * 100)
      : 0

    const totalValue = (totals.data ?? []).reduce(
      (s, t) => s + (Number(t.importe_total) || 0),
      0
    )

    const crossingRows = crossing.data ?? []
    const avgCrossingDays = crossingRows.length > 0
      ? (crossingRows.reduce((sum, t) => {
          const days = (new Date(t.fecha_cruce).getTime() -
                       new Date(t.fecha_llegada).getTime()) / 86400000
          return sum + days
        }, 0) / crossingRows.length).toFixed(1)
      : null

    const tmecCount = (factRes.data ?? []).filter(
      (f) => f.igi !== null && Number(f.igi) > 0
    ).length
    const tmecRate = factRes.count
      ? Math.round((tmecCount / factRes.count) * 100)
      : 0

    const data: KPIData = {
      totalTraficos: totalCount,
      totalValue,
      tmecRate,
      successRate,
      avgCrossingDays,
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        sentence: generateFallbackSentence(data, clientName),
        source: 'template',
      })
    }

    const prompt = `Genera un resumen ejecutivo de 2-3 oraciones en español para Renato Zapata & Company, Patente 3596.
Datos reales: ${totalCount} embarques activos, $${totalValue.toLocaleString()} USD en operación, ${successRate}% tasa de éxito${avgCrossingDays ? `, ${avgCrossingDays} días promedio de cruce` : ''}, ${tmecRate}% utilización T-MEC.
Tono: profesional, directo, como un sistema de inteligencia aduanera reportando al director general.
Máximo 50 palabras. Sin asteriscos ni markdown. Solo las oraciones.`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 200,
          messages: [
            { role: 'user', content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      })

      if (res.ok) {
        const body = await res.json()
        const sentence = body.content?.[0]?.text?.trim()
        if (sentence) {
          // Audit log — non-fatal if table doesn't exist yet
          const tokensUsed = (body.usage?.input_tokens ?? 0) + (body.usage?.output_tokens ?? 0)
          try {
            await supabase.from('ai_audit_log').insert({
              prompt_hash: Buffer.from(prompt).toString('base64').slice(0, 32),
              model: 'claude-sonnet-4-6',
              tokens_used: tokensUsed,
              response_summary: sentence.slice(0, 100),
              user_id: 'system',
              client_code: companyId,
              timestamp: new Date().toISOString(),
            })
          } catch {
            // Audit log non-fatal
          }

          return NextResponse.json({ sentence, source: 'ai' })
        }
      }
    } catch {
      // AI call failed — fall through to template
    }

    return NextResponse.json({
      sentence: generateFallbackSentence(data, clientName),
      source: 'fallback',
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error'
    return NextResponse.json({
      sentence: `${clientName}: operaciones en curso.`,
      source: 'error',
      error: msg,
    })
  }
}
