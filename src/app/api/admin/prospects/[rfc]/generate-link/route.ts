/**
 * POST /api/admin/prospects/[rfc]/generate-link
 *
 * Admin-only. Generates a 7-day magic link Tito can forward to a prospect.
 * The link points at /prospect/[token] which renders that prospect's own
 * importer-of-record cockpit.
 *
 * Flow:
 *   1. Verify portal session — only admin/broker/operator can issue links
 *      (clients/warehouse/contabilidad have no prospect-acquisition role).
 *   2. Validate RFC format. Reject malformed before touching the DB.
 *   3. Resolve identity (razon_social) from aduanet_facturas. Required —
 *      we will not issue a link for an RFC we have zero evidence of.
 *   4. Sign a prospect token (HMAC, kind="prospect", rfc-bound, 7d TTL).
 *   5. Record the issuance in prospect_link_issuance (RFC + token hash +
 *      issued_by + expiry). Storing only the hash means the token itself
 *      stays out of the DB — even a service-role read can't replay it.
 *   6. Return { url, expires_at, razon_social, prospect_total_pedimentos,
 *      prospect_total_valor_usd } so the caller can confirm to Tito what
 *      data the prospect will see.
 *
 * Audit: writes to audit_log so every issuance is traceable to the
 * portal user that triggered it.
 *
 * Note on the table: prospect_link_issuance is created by
 * supabase/migrations/20260513_prospect_view_log.sql. If the migration
 * has not been applied yet (Block FF Phase 0 verification confirmed it
 * is currently un-applied), this route still returns the URL but skips
 * the DB write and warns in the response. The cockpit works either way.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySession, signProspectToken, hashProspectToken } from '@/lib/session'
import { resolveProspectIdentity, getProspectByRfc } from '@/lib/prospect-data'
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = new Set(['admin', 'broker', 'operator'])
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7

interface RouteParams {
  params: Promise<{ rfc: string }>
}

export async function POST(req: NextRequest, ctx: RouteParams) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'No hay sesión válida.' } }, { status: 401 })
  }
  if (!ALLOWED_ROLES.has(session.role)) {
    return NextResponse.json({ data: null, error: { code: 'FORBIDDEN', message: 'Tu rol no puede generar enlaces de prospecto.' } }, { status: 403 })
  }

  const { rfc: rfcParam } = await ctx.params
  const cleanRfc = rfcParam.trim().toUpperCase()
  if (!/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/.test(cleanRfc)) {
    return NextResponse.json({ data: null, error: { code: 'INVALID_RFC', message: 'RFC inválido.' } }, { status: 400 })
  }

  const supabase = createServerClient()

  const identity = await resolveProspectIdentity(supabase, cleanRfc)
  if (!identity || !identity.razon_social) {
    return NextResponse.json(
      { data: null, error: { code: 'NO_PROSPECT_DATA', message: 'No tenemos registros públicos para este RFC en Aduana 240.' } },
      { status: 404 },
    )
  }

  const prospect = await getProspectByRfc(supabase, cleanRfc)
  if (!prospect || prospect.empty) {
    return NextResponse.json(
      { data: null, error: { code: 'EMPTY_PROSPECT', message: 'El RFC existe pero no tiene operaciones registradas.' } },
      { status: 422 },
    )
  }

  let token: string
  try {
    token = await signProspectToken(cleanRfc, TOKEN_TTL_SECONDS)
  } catch (err) {
    return NextResponse.json(
      { data: null, error: { code: 'TOKEN_FAILED', message: (err as Error).message } },
      { status: 500 },
    )
  }

  const tokenHash = await hashProspectToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString()
  const issuedBy = session.companyId

  let issuance_id: string | null = null
  let issuance_warning: string | null = null
  try {
    const { data: row, error } = await supabase
      .from('prospect_link_issuance')
      .insert({
        rfc: cleanRfc,
        token_hash: tokenHash,
        issued_by: issuedBy,
        expires_at: expiresAt,
      })
      .select('id')
      .single()
    if (error) {
      issuance_warning = error.message
    } else {
      issuance_id = row?.id ?? null
    }
  } catch (err) {
    issuance_warning = (err as Error).message
  }

  // Best-effort audit log entry. Audit is append-only — never block on failure.
  try {
    await supabase.from('audit_log').insert({
      action: 'prospect_link_generated',
      actor_id: issuedBy,
      company_id: issuedBy,
      metadata: {
        rfc: cleanRfc,
        razon_social: prospect.razon_social,
        total_pedimentos: prospect.total_pedimentos,
        total_valor_usd: prospect.total_valor_usd,
        issuance_id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    })
  } catch {
    // ignore — issuance is the source of truth
  }

  // Build absolute URL so Tito can paste it directly into WhatsApp/email.
  const origin = req.headers.get('origin')
    || (req.headers.get('host') ? `https://${req.headers.get('host')}` : 'https://portal.renatozapata.com')
  const url = `${origin}/prospect/${encodeURIComponent(token)}`

  return NextResponse.json({
    data: {
      url,
      token,
      expires_at: expiresAt,
      issuance_id,
      rfc: cleanRfc,
      razon_social: prospect.razon_social,
      total_pedimentos: prospect.total_pedimentos,
      total_valor_usd: prospect.total_valor_usd,
      primary_patente: prospect.primary_patente,
      primary_patente_is_us: prospect.primary_patente_is_us,
    },
    error: null,
    warning: issuance_warning,
  })
}
