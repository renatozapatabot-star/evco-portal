/**
 * POST /api/prospect/[token]/cta
 *
 * Conversion endpoint on the prospect cockpit. The prospect submits an
 * (optional) phone + message; we route an alert to Tito + Renato IV via
 * Telegram so they can call back within 24h.
 *
 * Telegram is the correct channel here per CLAUDE.md:
 *   "Telegram stays for pipeline health alerts, nightly sync reports,
 *    system failures."
 * A prospect-CTA-conversion is an INTERNAL alert to Tito, not a client-
 * facing message — it precedes the relationship. Mensajería governs
 * client-facing communication, which begins after Tito's first reply.
 *
 * Token verification is the only auth layer (no CSRF — the token IS the
 * credential, presented in the URL by a prospect we don't yet know).
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyProspectToken, hashProspectToken } from '@/lib/session'
import { resolveProspectIdentity, getProspectByRfc } from '@/lib/prospect-data'
import { createServerClient } from '@/lib/supabase-server'
import { sendTelegram } from '@/lib/telegram'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ token: string }>
}

interface CTAPayload {
  phone?: string | null
  message?: string | null
}

const MAX_PHONE_LEN = 32
const MAX_MESSAGE_LEN = 1000

function sanitizeShort(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, maxLen)
  return trimmed.length > 0 ? trimmed : null
}

export async function POST(req: NextRequest, ctx: RouteParams) {
  const { token: tokenParam } = await ctx.params
  const decoded = decodeURIComponent(tokenParam)

  const verified = await verifyProspectToken(decoded)
  if (!verified) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_TOKEN', message: 'Enlace inválido o expirado.' } },
      { status: 401 },
    )
  }

  let body: CTAPayload = {}
  try {
    body = (await req.json()) as CTAPayload
  } catch {
    body = {}
  }

  const phone = sanitizeShort(body.phone, MAX_PHONE_LEN)
  const message = sanitizeShort(body.message, MAX_MESSAGE_LEN)

  const supabase = createServerClient()

  const [identity, prospect, tokenHash] = await Promise.all([
    resolveProspectIdentity(supabase, verified.rfc),
    getProspectByRfc(supabase, verified.rfc),
    hashProspectToken(decoded).catch(() => null),
  ])

  const headerList = req.headers
  const xff = headerList.get('x-forwarded-for') ?? ''
  const ip = xff.split(',')[0]?.trim() || null
  const userAgent = headerList.get('user-agent') ?? null

  // Best-effort logging — never block the alert on a missing table.
  try {
    await supabase.from('prospect_view_log').insert({
      rfc: verified.rfc,
      token_hash: tokenHash,
      event_type: 'cta_click',
      event_data: { phone, message_length: message?.length ?? 0 },
      ip,
      user_agent: userAgent,
    })
  } catch {
    // ignore — logging is opportunistic
  }

  // Update trade_prospects status if that table exists.
  try {
    await supabase
      .from('trade_prospects')
      .update({ status: 'contacted', contacted_at: new Date().toISOString() })
      .eq('rfc', verified.rfc)
  } catch {
    // table may not exist — silent
  }

  const valorUsd = prospect?.total_valor_usd ?? 0
  const pedimentos = prospect?.total_pedimentos ?? 0
  const razon = identity?.razon_social || verified.rfc
  const valorLabel = valorUsd >= 1_000_000
    ? `$${(valorUsd / 1_000_000).toFixed(1)}M USD`
    : `$${Math.round(valorUsd / 1_000)}K USD`

  const telegramMessage = [
    `🎯 <b>PROSPECTO PIDIÓ HABLAR</b>`,
    ``,
    `<b>${razon}</b>`,
    `RFC <code>${verified.rfc}</code>`,
    ``,
    `${pedimentos} pedimentos · ${valorLabel} en Aduana 240`,
    `Patente actual: ${prospect?.primary_patente || '—'}${prospect?.primary_patente_is_us ? ' (nosotros)' : ''}`,
    ``,
    phone ? `📞 ${phone}` : '📞 No dejó teléfono',
    message ? `\n💬 "${message}"` : '',
    ``,
    `Responder en 24h.`,
  ].filter(Boolean).join('\n')

  // Telegram alert — fire-and-forget. Wrapper is non-throwing.
  void sendTelegram(telegramMessage)

  // Best-effort audit
  try {
    await supabase.from('audit_log').insert({
      action: 'prospect_cta_clicked',
      actor_id: 'prospect',
      company_id: 'prospect',
      metadata: {
        rfc: verified.rfc,
        razon_social: razon,
        phone_provided: !!phone,
        message_length: message?.length ?? 0,
        token_hash: tokenHash,
        ip,
      },
    })
  } catch {
    // ignore
  }

  return NextResponse.json({
    data: {
      ok: true,
      message: 'Renato Zapata III te contactará en 24 horas.',
    },
    error: null,
  })
}
