/**
 * POST /api/leads/[id]/convert — lead → client conversion.
 *
 * When a deal closes, this endpoint creates the companies row (the
 * tenant record that downstream sync + RLS keys off), stamps the
 * lead with `converted_at` + `client_code_assigned`, moves the
 * lead to stage='won', and emits a `system` activity on the timeline.
 *
 * Admin/broker only. CSRF-protected via middleware.
 *
 * Body:
 *   company_id    — REQUIRED, slug (3-40 chars, [a-z0-9-]). Unique
 *                   across companies. Becomes the tenant key used by
 *                   every tenant-scoped table.
 *   clave_cliente — OPTIONAL, GlobalPC clave (4-digit numeric).
 *                   Populated later if not known at conversion.
 *   language      — OPTIONAL, 'es' | 'en'. Defaults to 'es'.
 *
 * Guardrails:
 *   - Idempotent: if the lead already has client_code_assigned, we
 *     return the existing tenant rather than creating a duplicate.
 *   - Unique: if the requested company_id already exists, we return
 *     400 and do NOT touch the companies row (prevents hijacking an
 *     active tenant by converting a lead into its slug).
 *   - Slug hygiene: only [a-z0-9-], 3-40 chars, no leading/trailing
 *     dash, no consecutive dashes. Rejects everything else with 400.
 */

import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/auth/session-guards'
import { createServerClient } from '@/lib/supabase-server'
import type { LeadRow } from '@/lib/leads/types'
import { writeActivity } from '@/lib/leads/activities'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CLAVE_RE = /^\d{1,10}$/

function json(
  status: number,
  data: unknown,
  error: { code: string; message: string } | null = null,
) {
  return NextResponse.json({ data, error }, { status })
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error: authError } = await requireAdminSession()
  if (authError) return authError
  const { id } = await ctx.params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, null, {
      code: 'VALIDATION_ERROR',
      message: 'invalid_json',
    })
  }

  const rawCompanyId = typeof body.company_id === 'string' ? body.company_id.trim() : ''
  const companyId = rawCompanyId.toLowerCase()
  if (companyId.length < 3 || companyId.length > 40 || !SLUG_RE.test(companyId)) {
    return json(400, null, {
      code: 'VALIDATION_ERROR',
      message: 'invalid_company_id',
    })
  }

  const rawClave = typeof body.clave_cliente === 'string' ? body.clave_cliente.trim() : ''
  if (rawClave && !CLAVE_RE.test(rawClave)) {
    return json(400, null, {
      code: 'VALIDATION_ERROR',
      message: 'invalid_clave_cliente',
    })
  }
  const claveCliente = rawClave || null

  const language = body.language === 'en' ? 'en' : 'es'

  const supabase = createServerClient()

  // 1. Load the lead
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle<LeadRow>()
  if (leadErr) {
    return json(500, null, { code: 'INTERNAL_ERROR', message: 'fetch_failed' })
  }
  if (!lead) {
    return json(404, null, { code: 'NOT_FOUND', message: 'lead_not_found' })
  }

  // 2. Idempotency: if already converted, return the existing tenant.
  if (lead.client_code_assigned) {
    return json(
      200,
      {
        lead,
        company_id: lead.client_code_assigned,
        already_converted: true,
      },
    )
  }

  // 3. Uniqueness: refuse to overwrite an existing company_id.
  const { data: existing, error: existErr } = await supabase
    .from('companies')
    .select('company_id')
    .eq('company_id', companyId)
    .maybeSingle()
  if (existErr) {
    return json(500, null, { code: 'INTERNAL_ERROR', message: 'fetch_failed' })
  }
  if (existing) {
    return json(400, null, {
      code: 'CONFLICT',
      message: 'company_id_already_exists',
    })
  }

  // 4. Insert the tenant row.
  const { error: insertErr } = await supabase.from('companies').insert({
    company_id: companyId,
    name: lead.firm_name,
    clave_cliente: claveCliente,
    rfc: lead.rfc,
    contact_name: lead.contact_name,
    contact_email: lead.contact_email,
    contact_phone: lead.contact_phone,
    aduana: lead.aduana,
    language,
    active: true,
    onboarded_at: new Date().toISOString(),
  })
  if (insertErr) {
    return json(500, null, { code: 'INTERNAL_ERROR', message: 'tenant_create_failed' })
  }

  // 5. Stamp the lead.
  const nowIso = new Date().toISOString()
  const { data: updatedLead, error: updateErr } = await supabase
    .from('leads')
    .update({
      client_code_assigned: companyId,
      converted_at: nowIso,
      stage: 'won',
    })
    .eq('id', id)
    .select('*')
    .maybeSingle<LeadRow>()
  if (updateErr || !updatedLead) {
    // Rollback the tenant row to keep the system consistent.
    await supabase.from('companies').delete().eq('company_id', companyId)
    return json(500, null, { code: 'INTERNAL_ERROR', message: 'lead_update_failed' })
  }

  // 6. Emit a system activity on the timeline. Best-effort.
  await writeActivity(supabase, {
    lead_id: id,
    kind: 'system',
    summary: `Convertido a cliente · tenant ${companyId}${claveCliente ? ` · clave ${claveCliente}` : ''}`,
    metadata: {
      company_id: companyId,
      clave_cliente: claveCliente,
      language,
    },
    actor_user_id: null,
    actor_name: session.role,
    occurred_at: nowIso,
  })

  return json(201, {
    lead: updatedLead,
    company_id: companyId,
    already_converted: false,
  })
}
