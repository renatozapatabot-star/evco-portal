import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { z } from 'zod'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(100),
  new_password: z.string().min(6).max(100),
})

export async function POST(request: NextRequest) {
  // 1. Auth check — must have valid session
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión no válida' } },
      { status: 401 }
    )
  }

  // Only clients change passwords through this flow
  if (session.role !== 'client') {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Solo clientes pueden cambiar contraseña aquí' } },
      { status: 403 }
    )
  }

  // 2. Validate input
  const body = await request.json()
  const parsed = changePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Contraseña actual y nueva requeridas (mínimo 6 caracteres)' } },
      { status: 400 }
    )
  }

  const { current_password, new_password } = parsed.data

  if (current_password === new_password) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'La nueva contraseña debe ser diferente a la actual' } },
      { status: 400 }
    )
  }

  // 3. Verify current password matches company's portal_password
  const { data: company } = await supabase
    .from('companies')
    .select('company_id, name, portal_password')
    .eq('company_id', session.companyId)
    .single()

  if (!company) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Empresa no encontrada' } },
      { status: 404 }
    )
  }

  if (company.portal_password !== current_password) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Contraseña actual incorrecta' } },
      { status: 401 }
    )
  }

  // 4. Check new password doesn't collide with another company
  const { data: collision } = await supabase
    .from('companies')
    .select('company_id')
    .eq('portal_password', new_password)
    .neq('company_id', session.companyId)
    .limit(1)
    .maybeSingle()

  if (collision) {
    return NextResponse.json(
      { data: null, error: { code: 'CONFLICT', message: 'Esa contraseña no está disponible. Elige otra.' } },
      { status: 409 }
    )
  }

  // 5. Update password
  const { error: updateError } = await supabase
    .from('companies')
    .update({ portal_password: new_password })
    .eq('company_id', session.companyId)

  if (updateError) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'Error al actualizar contraseña' } },
      { status: 500 }
    )
  }

  // 6. Log to operator_actions
  const operatorId = request.cookies.get('operator_id')?.value || null
  supabase.from('operator_actions').insert({
    operator_id: operatorId,
    action_type: 'password_changed',
    target_table: 'companies',
    target_id: session.companyId,
    company_id: session.companyId,
    payload: { changed_by: 'client_self_service' },
  }).then(() => {}, () => {})

  // 7. Log to audit_log
  supabase.from('audit_log').insert({
    action: 'password_changed',
    resource: 'auth',
    resource_id: session.companyId,
    diff: { company: company.name },
    created_at: new Date().toISOString(),
  }).then(() => {}, () => {})

  return NextResponse.json({
    data: { success: true, message: 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.' },
    error: null,
  })
}
