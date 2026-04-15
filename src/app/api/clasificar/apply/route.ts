/**
 * POST /api/clasificar/apply
 *
 * Operator approves a bulk-classification result: writes fraccion onto
 * the globalpc_productos row and stamps it with the classification_log_id.
 * Reject is implicit (caller just doesn't call apply).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logOperatorAction } from '@/lib/operator-actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PRIVILEGED_ROLES = new Set(['operator', 'admin', 'broker'])

const BodySchema = z.object({
  producto_id: z.union([z.string(), z.number()]),
  fraccion: z.string().regex(/^\d{4}\.\d{2}\.\d{2}$/, 'Fracción XXXX.XX.XX requerida'),
  classification_log_id: z.string().uuid().optional(),
})

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value ?? '')
  if (!session) return err('UNAUTHORIZED', 'No autorizado', 401)
  if (!PRIVILEGED_ROLES.has(session.role)) return err('FORBIDDEN', 'Solo operadores', 403)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('VALIDATION_ERROR', 'JSON inválido', 400)
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join('; '), 400)
  }

  const productoId = typeof parsed.data.producto_id === 'string'
    ? Number.parseInt(parsed.data.producto_id, 10)
    : parsed.data.producto_id
  if (!Number.isFinite(productoId)) {
    return err('VALIDATION_ERROR', 'producto_id inválido', 400)
  }

  const { data: row, error: loadErr } = await supabase
    .from('globalpc_productos')
    .select('id, company_id, descripcion')
    .eq('id', productoId)
    .maybeSingle()
  if (loadErr || !row) return err('NOT_FOUND', 'Producto no encontrado', 404)

  const companyId = row.company_id as string | null
  const requestCompanyId =
    session.role === 'client'
      ? session.companyId
      : (req.cookies.get('company_id')?.value || session.companyId)
  if (session.role === 'client' && companyId !== session.companyId) {
    return err('FORBIDDEN', 'Producto de otro cliente', 403)
  }

  const { error: updErr } = await supabase
    .from('globalpc_productos')
    .update({ fraccion: parsed.data.fraccion, updated_at: new Date().toISOString() })
    .eq('id', productoId)
  if (updErr) return err('DB_ERROR', updErr.message, 500)

  await logOperatorAction({
    operatorName: `${session.companyId}:${session.role}`,
    actionType: 'clasificacion_applied',
    targetTable: 'globalpc_productos',
    targetId: String(productoId),
    companyId: companyId ?? requestCompanyId,
    payload: {
      fraccion: parsed.data.fraccion,
      classification_log_id: parsed.data.classification_log_id ?? null,
    },
  })

  return NextResponse.json({ data: { id: productoId, fraccion: parsed.data.fraccion }, error: null })
}
