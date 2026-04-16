/**
 * Cron-invoked · GET /api/monitor/semaforo-watch
 *
 * Scans tráficos with `semaforo = 2` (rojo) and, for each one that has not
 * been alerted in the last 24h, opens a Mensajería thread linked to the
 * tráfico via notifyMensajeria(). Idempotency anchored on `workflow_events`
 * with `event_type = 'semaforo_rojo_notified'`.
 *
 * Protected by `CRON_SECRET` header. PM2 cron hits this every 5 minutes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyMensajeria } from '@/lib/mensajeria/notify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_PER_RUN = 100
const LOOKBACK_HOURS = 24

function forbidden() {
  return NextResponse.json(
    { data: null, error: { code: 'FORBIDDEN', message: 'cron secret missing or wrong' } },
    { status: 403 },
  )
}

function missingCredentials() {
  return NextResponse.json(
    { data: null, error: { code: 'CONFIG', message: 'CRON_SECRET env var not set' } },
    { status: 500 },
  )
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) return missingCredentials()
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (provided !== expected) return forbidden()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: redRows, error: redErr } = await supabase
    .from('traficos')
    .select('trafico, company_id, descripcion_mercancia, updated_at')
    .eq('semaforo', 2)
    .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana', 'Pedimento Pagado'])
    .order('updated_at', { ascending: false })
    .limit(MAX_PER_RUN)

  if (redErr) {
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: redErr.message } },
      { status: 500 },
    )
  }

  const traficoIds = (redRows ?? []).map((r) => r.trafico as string)
  if (traficoIds.length === 0) {
    return NextResponse.json({ data: { checked: 0, notified: 0 }, error: null })
  }

  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString()
  const { data: recentEvents } = await supabase
    .from('workflow_events')
    .select('trigger_id')
    .eq('event_type', 'semaforo_rojo_notified')
    .gte('created_at', since)
    .in('trigger_id', traficoIds)
  const alreadyNotified = new Set(
    (recentEvents ?? []).map((r: { trigger_id: string | null }) => r.trigger_id ?? ''),
  )

  let notified = 0
  for (const row of redRows ?? []) {
    const trafico = row.trafico as string
    const companyId = (row.company_id as string | null) ?? ''
    if (!companyId) continue
    if (alreadyNotified.has(trafico)) continue

    const desc = (row.descripcion_mercancia as string | null) ?? ''
    const body = `Semáforo ROJO en tráfico ${trafico}${desc ? ` · ${desc.slice(0, 80)}` : ''}. Revisa inmediatamente.`

    const res = await notifyMensajeria({
      companyId,
      subject: `Semáforo rojo · ${trafico}`,
      body,
      traficoId: trafico,
      internalOnly: true,
      actor: { role: 'system', name: 'CRUZ Monitor' },
    })
    if (res.error) {
      // Do not mark as notified so a later run retries.
      continue
    }

    await supabase.from('workflow_events').insert({
      workflow: 'crossing',
      event_type: 'semaforo_rojo_notified',
      trigger_id: trafico,
      company_id: companyId,
      payload: {
        trafico,
        thread_id: res.data?.threadId ?? null,
        push_sent: res.data?.pushSent ?? 0,
      },
    })
    notified++
  }

  return NextResponse.json({
    data: { checked: traficoIds.length, notified },
    error: null,
  })
}
