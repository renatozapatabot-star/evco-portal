/**
 * Cron-invoked · GET /api/admin/patentes-watch
 *
 * Scans patentes for E_FIRMA / FIEL / renewal expiry and fires Mensajería
 * alerts at 90d, 60d, 30d, and when expired (day-0). Each alert level is
 * keyed separately via workflow_events so each tripwire fires exactly once.
 *
 * Because there is no tenant company_id on `patentes`, the Mensajería thread
 * is opened on a dedicated internal company code configured via
 * PATENTES_INTERNAL_COMPANY_ID (falls back to the broker's admin company).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyMensajeria } from '@/lib/mensajeria/notify'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type CertKind = 'efirma' | 'fiel' | 'renewal'
type Tripwire = 90 | 60 | 30 | 0

const CERT_COLS: Record<CertKind, { column: string; label: string }> = {
  efirma: { column: 'efirma_expiry', label: 'E_FIRMA' },
  fiel: { column: 'fiel_expiry', label: 'FIEL' },
  renewal: { column: 'patent_renewal_date', label: 'Renovación' },
}

const TRIPWIRES: Tripwire[] = [90, 60, 30, 0]

function forbidden() {
  return NextResponse.json(
    { data: null, error: { code: 'FORBIDDEN', message: 'cron secret missing or wrong' } },
    { status: 403 },
  )
}

interface PatenteRow {
  id: string
  numero: string
  nombre: string
  efirma_expiry: string | null
  fiel_expiry: string | null
  patent_renewal_date: string | null
  active: boolean
}

function severityBody(tripwire: Tripwire, label: string, numero: string, expiry: string): {
  subject: string
  body: string
} {
  if (tripwire === 0) {
    return {
      subject: `⛔ ${label} VENCIDA · Patente ${numero}`,
      body: `${label} para Patente ${numero} venció hoy (${expiry}). Operaciones suspendidas hasta renovación.`,
    }
  }
  const leader = tripwire === 30 ? 'URGENTE' : tripwire === 60 ? 'Atención' : 'Recordatorio'
  return {
    subject: `${label} vence en ${tripwire}d · Patente ${numero}`,
    body: `${leader}: ${label} para Patente ${numero} vence en ${tripwire} días (${expiry}). Renovar pronto.`,
  }
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

  const companyId = process.env.PATENTES_INTERNAL_COMPANY_ID || 'internal'

  const { data, error } = await supabase
    .from('patentes')
    .select('id, numero, nombre, efirma_expiry, fiel_expiry, patent_renewal_date, active')
    .eq('active', true)
  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 },
    )
  }

  const today = new Date()
  const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())

  interface Candidate {
    patenteId: string
    numero: string
    kind: CertKind
    tripwire: Tripwire
    expiry: string
  }

  const candidates: Candidate[] = []
  for (const row of (data ?? []) as PatenteRow[]) {
    for (const kind of Object.keys(CERT_COLS) as CertKind[]) {
      const expiry = (row as unknown as Record<string, string | null>)[CERT_COLS[kind].column]
      if (!expiry) continue
      const expiryMs = Date.UTC(
        Number(expiry.slice(0, 4)),
        Number(expiry.slice(5, 7)) - 1,
        Number(expiry.slice(8, 10)),
      )
      const days = Math.floor((expiryMs - todayMs) / 86_400_000)
      for (const tripwire of TRIPWIRES) {
        if (days === tripwire) {
          candidates.push({ patenteId: row.id, numero: row.numero, kind, tripwire, expiry })
        }
      }
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ data: { checked: 0, notified: 0 }, error: null })
  }

  // Dedup via workflow_events — one row per (patente_id, kind, tripwire).
  const eventTypes = TRIPWIRES.map((t) => `patente_expiry_${t}`)
  const { data: seenRows } = await supabase
    .from('workflow_events')
    .select('event_type, trigger_id, payload')
    .in('event_type', eventTypes)
    .in('trigger_id', candidates.map((c) => c.patenteId))
  const seen = new Set<string>()
  for (const ev of (seenRows ?? []) as Array<{ event_type: string; trigger_id: string | null; payload: Record<string, unknown> | null }>) {
    const kind = (ev.payload && typeof ev.payload === 'object' ? (ev.payload as Record<string, string>).kind : '') ?? ''
    seen.add(`${ev.trigger_id}:${ev.event_type}:${kind}`)
  }

  let notified = 0
  for (const c of candidates) {
    const eventType = `patente_expiry_${c.tripwire}`
    const key = `${c.patenteId}:${eventType}:${c.kind}`
    if (seen.has(key)) continue

    const { subject, body } = severityBody(c.tripwire, CERT_COLS[c.kind].label, c.numero, c.expiry)
    const res = await notifyMensajeria({
      companyId,
      subject,
      body,
      internalOnly: true,
      actor: { role: 'system', name: 'ZAPATA AI Patentes' },
    })
    if (res.error) continue

    await supabase.from('workflow_events').insert({
      workflow: 'compliance',
      event_type: eventType,
      trigger_id: c.patenteId,
      company_id: companyId,
      payload: {
        kind: c.kind,
        numero: c.numero,
        expiry: c.expiry,
        thread_id: res.data?.threadId ?? null,
      },
    })
    notified++
  }

  return NextResponse.json({ data: { checked: candidates.length, notified }, error: null })
}
