import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

/**
 * POST /api/settings/locale
 * Persists the user's preferred UI locale. Client-side localStorage is the
 * source of truth for rendering; this endpoint is best-effort durable backup
 * so preference survives browser clears + follows the user across devices
 * once auth-linked preferences become authoritative.
 *
 * Shape: { data: { locale }, error: null } | { data: null, error: {...} }
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const localeSchema = z.object({
  locale: z.enum(['es-MX', 'en-US']),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' } },
      { status: 400 },
    )
  }

  const parsed = localeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'locale must be es-MX or en-US' } },
      { status: 400 },
    )
  }
  const { locale } = parsed.data

  // Identity is cookie-based in this codebase (operator_id / company_id).
  const operatorId = req.cookies.get('operator_id')?.value
  const companyId = req.cookies.get('company_id')?.value

  // Best-effort upsert. Treat as ok if user_preferences isn't wired up yet —
  // client still works via localStorage + cookie.
  if (operatorId) {
    try {
      await supabase
        .from('user_preferences')
        .upsert(
          { user_id: operatorId, locale, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        )
    } catch { /* swallow — non-fatal */ }
  }

  // Telemetry: locale_changed
  try {
    await supabase.from('audit_log').insert({
      action: 'locale_changed',
      resource: 'user_preferences',
      resource_id: operatorId ?? companyId ?? null,
      diff: { locale },
      metadata: { event: 'locale_changed' },
      created_at: new Date().toISOString(),
    })
  } catch { /* audit failures must never break preference update */ }

  return NextResponse.json({ data: { locale }, error: null })
}
