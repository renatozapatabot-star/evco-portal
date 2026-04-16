/**
 * CRUZ · Block 17 — MVE scan endpoint.
 *
 * Vercel cron calls GET `/api/mve/scan` every 30 min (see vercel.json). Scans
 * pedimentos approaching their 15-day MVE deadline, upserts rows into
 * `mve_alerts`, and fires a Telegram alert on any newly-created critical row.
 *
 * Manual admin trigger: GET `/api/mve/scan?manual=1` with a valid admin/broker
 * session. The automated cron path does not require a session (Vercel signs
 * cron requests with `x-vercel-cron`).
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { scanPedimentos, type PedimentoForScan } from '@/lib/mve-scan'
import { sendTelegram } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const isManual = url.searchParams.get('manual') === '1'
  const isCron = request.headers.get('x-vercel-cron') !== null

  // Auth: cron calls authenticated via header. Manual calls require admin/broker.
  if (isManual && !isCron) {
    const cookieStore = await cookies()
    const token = cookieStore.get('portal_session')?.value || ''
    const session = await verifySession(token)
    if (!session || (session.role !== 'admin' && session.role !== 'broker')) {
      return NextResponse.json(
        { data: null, error: { code: 'UNAUTHORIZED', message: 'Acceso restringido' } },
        { status: 401 },
      )
    }
  }

  const now = new Date()

  const { data: pedimentos, error: pErr } = await supabase
    .from('pedimentos')
    .select('id, trafico_id, company_id, pedimento_number, status, created_at')
    .not('status', 'in', '("cruzado","cancelado")')
    .limit(5000)

  if (pErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: pErr.message } },
      { status: 500 },
    )
  }

  const candidates = scanPedimentos((pedimentos || []) as PedimentoForScan[], now)

  let created = 0
  let updated = 0
  let criticalNew = 0

  for (const c of candidates) {
    // Check if an unresolved row already exists for this pedimento+deadline
    const { data: existing } = await supabase
      .from('mve_alerts')
      .select('id, severity, resolved')
      .eq('pedimento_id', c.pedimento_id)
      .eq('deadline_at', c.deadline_at)
      .maybeSingle()

    if (!existing) {
      const { error: insErr } = await supabase.from('mve_alerts').insert({
        pedimento_id: c.pedimento_id,
        trafico_id: c.trafico_id,
        company_id: c.company_id,
        severity: c.severity,
        deadline_at: c.deadline_at,
        days_remaining: c.days_remaining,
        message: c.message,
        resolved: false,
      })
      if (!insErr) {
        created++
        if (c.severity === 'critical') criticalNew++
        // V1.5 F12 — Telegram routing per-user dispatch.
        const { dispatchTelegramForEvent } = await import('@/lib/telegram/dispatch')
        void dispatchTelegramForEvent('mve_alert_raised', {
          trafico_id: c.trafico_id,
          company_id: c.company_id,
          pedimento_number: c.pedimento_id,
          days_remaining: c.days_remaining,
          severity: c.severity,
        })
      }
    } else if (!existing.resolved && existing.severity !== c.severity) {
      const { error: updErr } = await supabase
        .from('mve_alerts')
        .update({
          severity: c.severity,
          days_remaining: c.days_remaining,
          message: c.message,
        })
        .eq('id', existing.id)
      if (!updErr) {
        updated++
        if (c.severity === 'critical') criticalNew++
      }
    }
  }

  if (criticalNew > 0) {
    await sendTelegram(
      `🔴 MVE · ${criticalNew} alerta${criticalNew === 1 ? '' : 's'} crítica${
        criticalNew === 1 ? '' : 's'
      } detectada${criticalNew === 1 ? '' : 's'} (vencimiento en &lt;3 días)`,
    )
  }

  return NextResponse.json({
    data: {
      scanned: (pedimentos || []).length,
      created,
      updated,
      critical: criticalNew,
    },
    error: null,
  })
}
