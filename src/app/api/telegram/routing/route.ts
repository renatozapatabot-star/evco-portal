/**
 * AGUILA · V1.5 F12 — Telegram routing read/write.
 *
 * Admin + self: authenticated user can manage their own routes. Admins
 * can additionally create/update rows on behalf of team members (still
 * written via service role — RLS covers the non-admin path).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { ROUTABLE_EVENT_KINDS } from '@/lib/telegram/formatters'

export const runtime = 'nodejs'

const BodySchema = z.object({
  user_id: z.string().uuid().nullable().optional(),
  chat_id: z.string().min(1),
  event_kind: z.enum(ROUTABLE_EVENT_KINDS as unknown as [string, ...string[]]),
  enabled: z.boolean().optional(),
  company_id: z.string().optional().nullable(),
})

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function getSessionContext() {
  const c = await cookies()
  const role = c.get('user_role')?.value ?? ''
  const userId = c.get('user_id')?.value ?? ''
  const companyId = c.get('company_id')?.value ?? ''
  return { role, userId, companyId }
}

export async function GET() {
  const { role, userId } = await getSessionContext()
  if (!role) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 },
    )
  }

  const sb = svc()
  const query = sb.from('telegram_routing').select('*').order('event_kind', { ascending: true })
  const { data, error } =
    role === 'admin' || role === 'broker' ? await query : await query.eq('user_id', userId)

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }
  return NextResponse.json({ data: data ?? [], error: null })
}

export async function POST(req: NextRequest) {
  const { role, userId, companyId } = await getSessionContext()
  if (!role) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 },
    )
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 },
    )
  }

  // Non-admins can only target themselves.
  const targetUserId =
    role === 'admin' || role === 'broker' ? parsed.data.user_id ?? userId : userId
  if (!targetUserId) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'user_id requerido' } },
      { status: 400 },
    )
  }

  const sb = svc()
  const row = {
    user_id: targetUserId,
    chat_id: parsed.data.chat_id,
    event_kind: parsed.data.event_kind,
    enabled: parsed.data.enabled ?? true,
    company_id: parsed.data.company_id ?? companyId ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await sb
    .from('telegram_routing')
    .upsert(row, { onConflict: 'user_id,event_kind' })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }
  return NextResponse.json({ data, error: null })
}
