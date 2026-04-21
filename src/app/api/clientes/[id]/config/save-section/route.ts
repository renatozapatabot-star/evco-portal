import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import {
  CLIENT_CONFIG_SECTIONS,
  type ClientConfigSectionId,
} from '@/lib/client-config-schema'

const EDITOR_ROLES = new Set(['broker', 'admin', 'operator'])

const SECTION_IDS = new Set<string>(CLIENT_CONFIG_SECTIONS.map(s => s.id))

interface SaveBody {
  section: ClientConfigSectionId
  value: unknown
}

function isSaveBody(body: unknown): body is SaveBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return typeof b.section === 'string' && SECTION_IDS.has(b.section) && 'value' in b
}

function isAcceptableShape(section: ClientConfigSectionId, value: unknown): boolean {
  const meta = CLIENT_CONFIG_SECTIONS.find(s => s.id === section)
  if (!meta) return false
  if (meta.kind === 'text') return value === null || typeof value === 'string'
  if (meta.kind === 'array') return Array.isArray(value)
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!EDITOR_ROLES.has(session.role)) {
    return NextResponse.json({ error: 'Rol sin permisos de edición' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  if (!isSaveBody(body)) {
    return NextResponse.json({ error: 'Cuerpo inválido (section, value requeridos)' }, { status: 400 })
  }
  if (!isAcceptableShape(body.section, body.value)) {
    return NextResponse.json({ error: `Forma inválida para sección ${body.section}` }, { status: 400 })
  }

  const supabase = createServerClient()
  const update: Record<string, unknown> = { [body.section]: body.value }

  const { data, error } = await supabase
    .from('companies')
    .update(update)
    .eq('company_id', id)
    .select('company_id, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, updated_at: data.updated_at ?? null })
}
