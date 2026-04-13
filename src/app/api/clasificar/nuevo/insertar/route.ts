import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PRIVILEGED_ROLES = new Set(['operator', 'admin', 'broker'])
const PRIVILEGED_COMPANY_IDS = new Set(['admin', 'internal'])

const BodySchema = z.object({
  classification_log_id: z.string().uuid(),
  trafico_id: z.string().min(1).max(64),
})

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return err('UNAUTHORIZED', 'No autorizado', 401)
  if (!PRIVILEGED_ROLES.has(session.role)) {
    return err('FORBIDDEN', 'Solo operadores y administradores pueden insertar en tráfico', 403)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('VALIDATION_ERROR', 'Cuerpo JSON inválido', 400)
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join('; '), 400)
  }

  const { classification_log_id, trafico_id } = parsed.data

  const { data: log, error: logErr } = await supabase
    .from('classification_log')
    .select('id, company_id, description, fraccion, confidence, inserted_into_trafico')
    .eq('id', classification_log_id)
    .single()

  if (logErr || !log) return err('NOT_FOUND', 'Clasificación no encontrada', 404)

  const isPrivilegedTenant = PRIVILEGED_COMPANY_IDS.has(session.companyId)
  if (!isPrivilegedTenant && log.company_id !== session.companyId) {
    return err('FORBIDDEN', 'La clasificación pertenece a otro cliente', 403)
  }
  if (!log.fraccion) return err('VALIDATION_ERROR', 'La clasificación no tiene fracción', 422)
  if ((log.confidence ?? 0) <= 85) {
    return err('CONFIDENCE_TOO_LOW', 'Confianza insuficiente para insertar (requiere > 85)', 422)
  }
  if (log.inserted_into_trafico) {
    return err('CONFLICT', `Ya se insertó en tráfico ${log.inserted_into_trafico}`, 409)
  }

  const { data: trafico, error: trafErr } = await supabase
    .from('traficos')
    .select('trafico, company_id')
    .eq('trafico', trafico_id)
    .maybeSingle()

  if (trafErr) return err('INTERNAL_ERROR', trafErr.message, 500)
  if (!trafico) return err('NOT_FOUND', 'Tráfico no encontrado', 404)
  if (trafico.company_id !== log.company_id) {
    return err('FORBIDDEN', 'El tráfico pertenece a otro cliente', 403)
  }

  const writeback: { product_inserted: boolean; product_error: string | null } = {
    product_inserted: false,
    product_error: null,
  }

  const { error: prodErr } = await supabase.from('globalpc_productos').insert({
    company_id: log.company_id,
    cve_trafico: trafico.trafico,
    descripcion: log.description,
    fraccion: log.fraccion,
    fraccion_source: 'self_service',
    fraccion_classified_at: new Date().toISOString(),
  })

  if (prodErr) {
    writeback.product_error = prodErr.message
  } else {
    writeback.product_inserted = true
  }

  const { error: linkErr } = await supabase
    .from('classification_log')
    .update({ inserted_into_trafico: trafico.trafico })
    .eq('id', classification_log_id)

  if (linkErr) {
    return err('INTERNAL_ERROR', 'No se pudo vincular: ' + linkErr.message, 500)
  }

  return NextResponse.json({
    data: {
      classification_log_id,
      trafico_id: trafico.trafico,
      writeback,
    },
    error: null,
  })
}
