/**
 * Cron-invoked · GET /api/catalogo/vencimientos-watch
 *
 * Fires Mensajería alerts at two tripwires per permit (60 and 30 days).
 * Idempotency keyed on workflow_events rows with event_type =
 * 'permit_expiry_alert_60' or 'permit_expiry_alert_30' — each (producto_id,
 * permit_kind, tripwire) combination only alerts once.
 *
 * Protected by CRON_SECRET. PM2 cron hits daily.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyMensajeria } from '@/lib/mensajeria/notify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type PermitKind = 'nom' | 'sedue' | 'semarnat'

const PERMIT_COLS: Record<PermitKind, { value: string; expiry: string; label: string }> = {
  nom: { value: 'nom_numero', expiry: 'nom_expiry', label: 'NOM' },
  sedue: { value: 'sedue_permit', expiry: 'sedue_expiry', label: 'SEDUE' },
  semarnat: { value: 'semarnat_cert', expiry: 'semarnat_expiry', label: 'SEMARNAT' },
}

const TRIPWIRES = [60, 30] as const

function forbidden() {
  return NextResponse.json(
    { data: null, error: { code: 'FORBIDDEN', message: 'cron secret missing or wrong' } },
    { status: 403 },
  )
}

interface ProductoRow {
  id: string | number
  company_id: string | null
  cve_producto: string | null
  descripcion: string | null
  fraccion: string | null
  nom_numero: string | null
  nom_expiry: string | null
  sedue_permit: string | null
  sedue_expiry: string | null
  semarnat_cert: string | null
  semarnat_expiry: string | null
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { data: null, error: { code: 'CONFIG', message: 'CRON_SECRET env var not set' } },
      { status: 500 },
    )
  }
  const provided =
    request.headers.get('x-cron-secret') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (provided !== expected) return forbidden()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Compute the day-bounded windows once — a permit triggers its 60-day
  // alert on the calendar day 60 days before expiry. We process both
  // tripwires in a single sweep.
  const today = new Date()
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const dayIso = (offset: number): string =>
    new Date(todayMs + offset * 86_400_000).toISOString().slice(0, 10)

  const horizonTopIso = dayIso(60)

  // allowlist-ok:globalpc_productos — CRON-invoked expiry watcher sweeps
  // every tenant's permits. Per-row company_id is preserved so alert
  // routing goes to the correct client via Mensajería. Gated by
  // CRON_SECRET; no client role can reach this endpoint.
  const { data, error } = await supabase
    .from('globalpc_productos')
    .select('id, company_id, cve_producto, descripcion, fraccion, nom_numero, nom_expiry, sedue_permit, sedue_expiry, semarnat_cert, semarnat_expiry')
    .or(
      `nom_expiry.lte.${horizonTopIso},sedue_expiry.lte.${horizonTopIso},semarnat_expiry.lte.${horizonTopIso}`,
    )
    .limit(1000)

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  interface Candidate {
    producto_id: string
    company_id: string
    descripcion: string
    fraccion: string | null
    kind: PermitKind
    permit: string
    expiry: string
    daysUntil: number
    tripwire: 60 | 30
  }

  const candidates: Candidate[] = []
  for (const raw of (data ?? []) as ProductoRow[]) {
    if (!raw.company_id) continue
    for (const kind of Object.keys(PERMIT_COLS) as PermitKind[]) {
      const cols = PERMIT_COLS[kind]
      const expiry = (raw as unknown as Record<string, string | null>)[cols.expiry]
      const permit = (raw as unknown as Record<string, string | null>)[cols.value]
      if (!expiry || !permit) continue
      const expiryMs = Date.UTC(
        Number(expiry.slice(0, 4)),
        Number(expiry.slice(5, 7)) - 1,
        Number(expiry.slice(8, 10)),
      )
      const daysUntil = Math.floor((expiryMs - todayMs) / 86_400_000)
      for (const tripwire of TRIPWIRES) {
        if (daysUntil === tripwire) {
          candidates.push({
            producto_id: String(raw.id),
            company_id: raw.company_id,
            descripcion: raw.descripcion ?? raw.cve_producto ?? 'producto',
            fraccion: raw.fraccion,
            kind,
            permit,
            expiry,
            daysUntil,
            tripwire,
          })
        }
      }
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ data: { checked: 0, notified: 0 }, error: null })
  }

  // Idempotency — already-sent alerts live in workflow_events.
  const eventTypes = TRIPWIRES.map((t) => `permit_expiry_alert_${t}`)
  const { data: seenRows } = await supabase
    .from('workflow_events')
    .select('event_type, trigger_id, payload')
    .in('event_type', eventTypes)
    .in('trigger_id', candidates.map((c) => c.producto_id))
  const seen = new Set<string>()
  for (const ev of (seenRows ?? []) as Array<{ event_type: string; trigger_id: string | null; payload: Record<string, unknown> | null }>) {
    const kind = (ev.payload && typeof ev.payload === 'object' ? (ev.payload as Record<string, string>).permit_kind : '') ?? ''
    seen.add(`${ev.trigger_id}:${ev.event_type}:${kind}`)
  }

  let notified = 0
  for (const c of candidates) {
    const eventType = `permit_expiry_alert_${c.tripwire}`
    const key = `${c.producto_id}:${eventType}:${c.kind}`
    if (seen.has(key)) continue

    const body = `${PERMIT_COLS[c.kind].label} ${c.permit} para ${c.descripcion} (fracción ${c.fraccion ?? '—'}) vence en ${c.tripwire} días (${c.expiry}). Renovar pronto.`
    const res = await notifyMensajeria({
      companyId: c.company_id,
      subject: `Permiso vence en ${c.tripwire} días · ${PERMIT_COLS[c.kind].label}`,
      body,
      internalOnly: true,
      actor: { role: 'system', name: 'CRUZ Catálogo' },
    })
    if (res.error) continue

    await supabase.from('workflow_events').insert({
      workflow: 'compliance',
      event_type: eventType,
      trigger_id: c.producto_id,
      company_id: c.company_id,
      payload: {
        permit_kind: c.kind,
        permit_value: c.permit,
        expiry: c.expiry,
        thread_id: res.data?.threadId ?? null,
      },
    })
    notified++
  }

  return NextResponse.json({
    data: { checked: candidates.length, notified },
    error: null,
  })
}
