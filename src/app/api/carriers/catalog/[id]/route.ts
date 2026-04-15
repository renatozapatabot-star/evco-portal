/**
 * ZAPATA AI · Block 12 — GET/PATCH/DELETE /api/carriers/catalog/[id]
 *
 * Per-carrier admin ops. Internal roles only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { CarrierUpdateSchema, type CarrierFull } from '@/lib/carriers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const INTERNAL_ROLES = new Set(['admin', 'broker', 'operator'])

async function guard(request: NextRequest) {
  const session = await verifySession(
    request.cookies.get('portal_session')?.value ?? '',
  )
  if (!session) {
    return {
      response: NextResponse.json(
        { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
        { status: 401 },
      ),
    }
  }
  if (!INTERNAL_ROLES.has(session.role)) {
    return {
      response: NextResponse.json(
        { data: null, error: { code: 'FORBIDDEN', message: 'Sin permisos' } },
        { status: 403 },
      ),
    }
  }
  return { session }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const check = await guard(request)
  if ('response' in check) return check.response

  const { id } = await context.params
  const { data, error } = await supabase
    .from('carriers')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Transportista no encontrado' } },
      { status: 404 },
    )
  }
  return NextResponse.json({ data: data as CarrierFull, error: null })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const check = await guard(request)
  if ('response' in check) return check.response

  const { id } = await context.params
  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'JSON inválido' } },
      { status: 400 },
    )
  }
  const parsed = CarrierUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Datos inválidos',
        },
      },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('carriers')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error || !data) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: error?.message ?? 'No encontrado' } },
      { status: 404 },
    )
  }
  return NextResponse.json({ data: data as CarrierFull, error: null })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const check = await guard(request)
  if ('response' in check) return check.response

  const { id } = await context.params
  // Soft delete: mark inactive so historical pedimentos still resolve the name.
  const { error } = await supabase
    .from('carriers')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }
  return NextResponse.json({ data: { id, active: false }, error: null })
}
