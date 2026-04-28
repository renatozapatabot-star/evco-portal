/**
 * POST /api/leads — capture a new prospect.
 *
 * Public endpoint: any visitor can submit. Rate limit is coarse
 * (handled upstream by Vercel + the CSRF gate that middleware.ts
 * applies to every API mutation). Writes via service-role client.
 *
 * Shape (all fields optional except firm_name):
 *   {
 *     firm_name: string
 *     contact_name?: string
 *     contact_email?: string
 *     contact_phone?: string
 *     rfc?: string
 *     notes?: string
 *     source?: LeadSource
 *     source_campaign?: string
 *     source_url?: string
 *   }
 *
 * Never exposes existing rows back to the caller — returns only
 * { ok: true, id } on success to prevent enumeration.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { LEAD_SOURCES, type LeadSource } from '@/lib/leads/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sanitize(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'invalid_json' } },
      { status: 400 },
    )
  }

  const firm_name = sanitize(body.firm_name, 200)
  if (!firm_name) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'firm_name_required' } },
      { status: 400 },
    )
  }

  const rawSource = typeof body.source === 'string' ? body.source : 'inbound'
  const source: LeadSource = (LEAD_SOURCES as readonly string[]).includes(rawSource)
    ? (rawSource as LeadSource)
    : 'inbound'

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('leads')
    .insert({
      firm_name,
      contact_name: sanitize(body.contact_name, 120),
      contact_email: sanitize(body.contact_email, 200),
      contact_phone: sanitize(body.contact_phone, 40),
      rfc: sanitize(body.rfc, 13),
      notes: sanitize(body.notes, 2000),
      source,
      source_campaign: sanitize(body.source_campaign, 120),
      source_url: sanitize(body.source_url, 500),
      stage: 'new',
    })
    .select('id')
    .single()

  if (error || !data) {
    // Don't leak DB error details to the client. Vercel captures the
    // server trace automatically; we keep this quiet so the public
    // endpoint doesn't push the console-ratchet baseline upward.
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: 'insert_failed' } },
      { status: 500 },
    )
  }

  return NextResponse.json({ data: { id: data.id }, error: null })
}
