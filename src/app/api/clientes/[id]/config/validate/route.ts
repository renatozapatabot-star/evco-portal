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

  // M16 phantom-sweep: the 12 config sub-path columns (general, direcciones,
  // contactos, fiscal, ...) were designed as keys inside a companies.config
  // jsonb column that was never created. Until the schema migration ships,
  // read the row with * and look for each key on the jsonb column if it
  // exists, else treat the config as empty. Validation + completeness
  // degrade gracefully to "needs input" for each section.
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('company_id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  // Extract config sub-paths from the jsonb column if present, else return
  // empty sub-rows (validators treat null/undefined as "missing").
  const raw = data as Record<string, unknown>
  const config = (raw.config && typeof raw.config === 'object') ? raw.config as Record<string, unknown> : {}
  const row: ClientConfigRow = {
    company_id: String(raw.company_id ?? id),
    general: (config.general ?? null) as ClientConfigRow['general'],
    direcciones: (config.direcciones ?? null) as ClientConfigRow['direcciones'],
    contactos: (config.contactos ?? null) as ClientConfigRow['contactos'],
    fiscal: (config.fiscal ?? null) as ClientConfigRow['fiscal'],
    aduanal_defaults: (config.aduanal_defaults ?? null) as ClientConfigRow['aduanal_defaults'],
    clasificacion_defaults: (config.clasificacion_defaults ?? null) as ClientConfigRow['clasificacion_defaults'],
    transportistas_preferidos: (config.transportistas_preferidos ?? null) as ClientConfigRow['transportistas_preferidos'],
    documentos_recurrentes: (config.documentos_recurrentes ?? null) as ClientConfigRow['documentos_recurrentes'],
    configuracion_facturacion: (config.configuracion_facturacion ?? null) as ClientConfigRow['configuracion_facturacion'],
    notificaciones: (config.notificaciones ?? null) as ClientConfigRow['notificaciones'],
    permisos_especiales: (config.permisos_especiales ?? null) as ClientConfigRow['permisos_especiales'],
    notas_internas: (config.notas_internas ?? null) as ClientConfigRow['notas_internas'],
  }
  const errors = validateClientConfig(row)
  const completeness = computeCompleteness(row)

  return NextResponse.json({ errors, completeness })
}
