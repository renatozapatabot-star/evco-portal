/**
 * CRUZ · Block 15 — /clientes/[id]/configuracion
 *
 * Server component. Reads the full companies row (all 12 JSONB columns +
 * notas_internas + company_id), computes initial completeness + errors,
 * then hands off to `<ConfigEditor>` client component.
 *
 * Only broker / admin / operator roles may reach this route. Clients land
 * on the detail page instead.
 */

import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_DIM,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '@/lib/design-system'
import type { ClientConfigRow } from '@/lib/client-config-schema'
import {
  computeCompleteness,
  validateClientConfig,
} from '@/lib/client-config-validation'
import { ConfigEditor } from './_components/ConfigEditor'

const EDITOR_ROLES = new Set(['broker', 'admin', 'operator'])

interface CompanyNameRow {
  company_id: string
  name: string | null
  rfc: string | null
}

export const dynamic = 'force-dynamic'

export default async function ClienteConfiguracionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!EDITOR_ROLES.has(session.role)) {
    redirect(`/clientes/${id}`)
  }

  const supabase = createServerClient()

  // M16 phantom-sweep: the 12 config sub-path columns (general, direcciones,
  // contactos, fiscal, ...) were designed as keys inside a companies.config
  // jsonb column that was never created. Read `*` and extract each key
  // from the jsonb column when present, else return empty defaults so
  // the editor loads without PostgREST 400-ing.
  const { data: row, error } = await supabase
    .from('companies')
    .select('*')
    .eq('company_id', id)
    .maybeSingle()

  if (error) {
    throw new Error(`No se pudo cargar cliente: ${error.message}`)
  }
  if (!row) notFound()

  const raw = row as Record<string, unknown>
  const config = (raw.config && typeof raw.config === 'object') ? raw.config as Record<string, unknown> : {}
  const company = {
    company_id: String(raw.company_id ?? id),
    name: (raw.name as string | null) ?? null,
    rfc: (raw.rfc as string | null) ?? null,
  } satisfies CompanyNameRow

  const initial: ClientConfigRow = {
    company_id: company.company_id,
    general: (config.general as ClientConfigRow['general']) ?? {},
    direcciones: (config.direcciones as ClientConfigRow['direcciones']) ?? [],
    contactos: (config.contactos as ClientConfigRow['contactos']) ?? [],
    fiscal: (config.fiscal as ClientConfigRow['fiscal']) ?? {},
    aduanal_defaults: (config.aduanal_defaults as ClientConfigRow['aduanal_defaults']) ?? {},
    clasificacion_defaults:
      (config.clasificacion_defaults as ClientConfigRow['clasificacion_defaults']) ?? {},
    transportistas_preferidos:
      (config.transportistas_preferidos as ClientConfigRow['transportistas_preferidos']) ?? [],
    documentos_recurrentes:
      (config.documentos_recurrentes as ClientConfigRow['documentos_recurrentes']) ?? [],
    configuracion_facturacion:
      (config.configuracion_facturacion as ClientConfigRow['configuracion_facturacion']) ?? {},
    notificaciones: (config.notificaciones as ClientConfigRow['notificaciones']) ?? {},
    permisos_especiales:
      (config.permisos_especiales as ClientConfigRow['permisos_especiales']) ?? [],
    notas_internas:
      typeof config.notas_internas === 'string' ? config.notas_internas : null,
  }

  const errors = validateClientConfig(initial)
  const completeness = computeCompleteness(initial)

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href={`/clientes/${id}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 44,
            fontSize: 'var(--aguila-fs-body)',
            color: ACCENT_SILVER_DIM,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={14} /> Volver al cliente
        </Link>
      </div>
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 'var(--aguila-fs-meta)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: ACCENT_SILVER,
          }}
        >
          Configuración del cliente
        </div>
        <h1 style={{ margin: '6px 0 0', fontSize: 26, fontWeight: 700, color: TEXT_PRIMARY }}>
          {company.name ?? 'Cliente'}
        </h1>
        <div
          style={{
            marginTop: 4,
            fontSize: 'var(--aguila-fs-compact)',
            color: TEXT_MUTED,
            fontFamily: 'var(--font-jetbrains-mono), monospace',
          }}
        >
          {company.company_id}
          {company.rfc ? ` · ${company.rfc}` : ''}
        </div>
      </header>
      <ConfigEditor
        companyId={company.company_id}
        initial={initial}
        initialCompleteness={completeness}
        initialErrors={errors}
      />
    </div>
  )
}
