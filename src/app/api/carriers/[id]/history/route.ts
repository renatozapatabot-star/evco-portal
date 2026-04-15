/**
 * GET /api/carriers/[id]/history
 *
 * Returns tráfico count for the last 90 days plus a sample of recent
 * traficos where this carrier appears either as mexican or foreign carrier.
 *
 * Matches against the carrier name (and aliases, if available). This is a
 * soft match because `traficos.transportista_*` is legacy free-text.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const INTERNAL_ROLES = new Set(['admin', 'broker', 'operator'])

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

interface Trafico {
  trafico: string
  company_id: string | null
  estatus: string | null
  fecha_llegada: string | null
  fecha_cruce: string | null
  transportista_mexicano: string | null
  transportista_extranjero: string | null
  updated_at: string | null
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return err('UNAUTHORIZED', 'Sesión inválida', 401)
  if (!INTERNAL_ROLES.has(session.role)) return err('FORBIDDEN', 'Sin permisos', 403)

  const { id } = await ctx.params

  const { data: carrier, error: carrierErr } = await supabase
    .from('carriers')
    .select('id, name, carrier_type, calificacion, active')
    .eq('id', id)
    .maybeSingle()
  if (carrierErr || !carrier) return err('NOT_FOUND', 'Transportista no encontrado', 404)

  const { data: aliases } = await supabase
    .from('carrier_aliases')
    .select('alias')
    .eq('carrier_id', id)

  const names = [
    (carrier as { name: string }).name,
    ...(((aliases ?? []) as { alias: string }[]).map((a) => a.alias)),
  ].filter(Boolean)

  if (names.length === 0) {
    return NextResponse.json({
      data: {
        carrier,
        traficos_90d: 0,
        cruzados_90d: 0,
        recent: [],
        on_time_rate: null,
      },
      error: null,
    })
  }

  const since = new Date(Date.now() - 90 * 86_400_000).toISOString()

  // Each trafico matches if either transportista_mexicano OR transportista_extranjero
  // equals any of the names. Supabase's .in() only matches one column at a time,
  // so we issue two queries and merge.
  const [mxRes, foreignRes] = await Promise.all([
    supabase
      .from('traficos')
      .select('trafico, company_id, estatus, fecha_llegada, fecha_cruce, transportista_mexicano, transportista_extranjero, updated_at')
      .in('transportista_mexicano', names)
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(500),
    supabase
      .from('traficos')
      .select('trafico, company_id, estatus, fecha_llegada, fecha_cruce, transportista_mexicano, transportista_extranjero, updated_at')
      .in('transportista_extranjero', names)
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(500),
  ])

  const byTrafico = new Map<string, Trafico>()
  for (const row of ((mxRes.data ?? []) as Trafico[])) byTrafico.set(row.trafico, row)
  for (const row of ((foreignRes.data ?? []) as Trafico[])) byTrafico.set(row.trafico, row)

  const traficos = Array.from(byTrafico.values()).sort(
    (a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''),
  )
  const cruzados = traficos.filter((t) => t.estatus === 'Cruzado' || Boolean(t.fecha_cruce)).length
  const onTimeRate = traficos.length > 0 ? cruzados / traficos.length : null

  return NextResponse.json({
    data: {
      carrier,
      traficos_90d: traficos.length,
      cruzados_90d: cruzados,
      on_time_rate: onTimeRate,
      recent: traficos.slice(0, 10).map((t) => ({
        trafico: t.trafico,
        company_id: t.company_id,
        estatus: t.estatus,
        fecha_cruce: t.fecha_cruce,
        updated_at: t.updated_at,
      })),
    },
    error: null,
  })
}
