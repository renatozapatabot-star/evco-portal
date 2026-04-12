import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import {
  computeCompleteness,
  validateClientConfig,
} from '@/lib/client-config-validation'
import type { ClientConfigRow } from '@/lib/client-config-schema'

const READER_ROLES = new Set(['broker', 'admin', 'operator'])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!READER_ROLES.has(session.role)) {
    return NextResponse.json({ error: 'Rol sin acceso a configuración' }, { status: 403 })
  }

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('companies')
    .select(
      'company_id, general, direcciones, contactos, fiscal, aduanal_defaults, clasificacion_defaults, transportistas_preferidos, documentos_recurrentes, configuracion_facturacion, notificaciones, permisos_especiales, notas_internas',
    )
    .eq('company_id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  const row = data as unknown as ClientConfigRow
  const errors = validateClientConfig(row)
  const completeness = computeCompleteness(row)

  return NextResponse.json({ errors, completeness })
}
