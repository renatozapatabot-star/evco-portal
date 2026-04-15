/**
 * AGUILA · Routine R1 — Morning Briefing
 *
 * Called daily ~6:45 AM Central by Claude Routines (see
 * `.routines/01-morning-briefing.md`). Pulls Tito's executive state
 * snapshot and returns structured JSON. Routine then summarizes and
 * POSTs to a Mensajería thread.
 *
 * Cross-tenant aggregate (core-invariants rule 31 — service role, no
 * company_id filter). Internal-only thread visibility.
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyRoutineRequest, routineOk, routineError } from '@/lib/routines/auth'
import { createThread } from '@/lib/mensajeria/threads'
import { computeARAging } from '@/lib/contabilidad/aging'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MOTION_STATUSES = ['En Proceso', 'Documentacion', 'En Aduana', 'Pedimento Pagado']

interface BriefingPayload {
  generatedAt: string
  activeTraficos: { total: number; byStatus: Array<{ status: string; count: number }> }
  semaforo: { rojo: number; amarillo: number; verde: number }
  pendingDocuments: number
  mveThisWeek: { critical: number; warning: number; total: number }
  cxcVencido: { totalUSD: number; count: number }
  entradasLast24h: number
  thread?: { id: string; posted: boolean }
}

export async function POST(request: NextRequest) {
  const auth = verifyRoutineRequest(request, 'morning-briefing')
  if (!auth.ok) return auth.response

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()
  const weekEndIso = new Date(now.getTime() + 7 * 86_400_000).toISOString()
  const last24hIso = new Date(now.getTime() - 86_400_000).toISOString()

  const body = await request.json().catch(() => ({}))
  const postToThread: boolean = body?.postToThread !== false
  const summary: string | undefined = typeof body?.summary === 'string' ? body.summary : undefined

  try {
    // Aggregate pulls — all cross-tenant, service-role bypasses RLS.
    const [
      traficosRows,
      docsPending,
      mveRows,
      entradasRecent,
      arResult,
    ] = await Promise.all([
      sb.from('traficos').select('estatus').in('estatus', MOTION_STATUSES).limit(5000),
      sb.from('expediente_documentos').select('id', { count: 'exact', head: true }).eq('is_required', true).is('storage_path', null).limit(1),
      sb.from('mve_alerts').select('severity').eq('resolved', false).lte('deadline_at', weekEndIso).limit(500),
      sb.from('entradas').select('id', { count: 'exact', head: true }).gte('fecha_llegada_mercancia', last24hIso).limit(1),
      computeARAging(sb, null),
    ])

    const byStatus = new Map<string, number>()
    for (const r of (traficosRows.data ?? []) as Array<{ estatus: string | null }>) {
      const s = r.estatus ?? 'Sin estado'
      byStatus.set(s, (byStatus.get(s) ?? 0) + 1)
    }
    const activeTotal = Array.from(byStatus.values()).reduce((a, b) => a + b, 0)

    // Semáforo: derive from traficos rows if carrier column exists; otherwise placeholder
    const { data: semaRows } = await sb
      .from('traficos')
      .select('semaforo')
      .in('estatus', MOTION_STATUSES)
      .limit(5000)
    const sema = { rojo: 0, amarillo: 0, verde: 0 }
    for (const r of (semaRows ?? []) as Array<{ semaforo: string | null }>) {
      const s = (r.semaforo ?? '').toLowerCase()
      if (s.includes('rojo')) sema.rojo++
      else if (s.includes('amarillo') || s.includes('naranja')) sema.amarillo++
      else if (s.includes('verde')) sema.verde++
    }

    const mve = (mveRows.data ?? []) as Array<{ severity: string }>
    const mveCritical = mve.filter(m => m.severity === 'critical').length
    const mveWarning = mve.filter(m => m.severity === 'warning').length

    // CxC vencido = AR aging buckets beyond 0-30
    const cxcVencidoUsd = arResult.byBucket
      .filter(b => b.bucket !== '0-30')
      .reduce((acc, b) => acc + b.amount, 0)
    const cxcVencidoCount = arResult.byBucket
      .filter(b => b.bucket !== '0-30')
      .reduce((acc, b) => acc + b.count, 0)

    const payload: BriefingPayload = {
      generatedAt: now.toISOString(),
      activeTraficos: {
        total: activeTotal,
        byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
      },
      semaforo: sema,
      pendingDocuments: docsPending.count ?? 0,
      mveThisWeek: { critical: mveCritical, warning: mveWarning, total: mve.length },
      cxcVencido: { totalUSD: Math.round(cxcVencidoUsd), count: cxcVencidoCount },
      entradasLast24h: entradasRecent.count ?? 0,
    }

    if (postToThread && summary) {
      // Use 'internal' company_id so the thread lives in the broker-wide bucket.
      // Tito reads it from his owner cockpit / admin Mensajería feed.
      const dateStr = now.toLocaleDateString('es-MX', { timeZone: 'America/Chicago', day: '2-digit', month: 'long', year: 'numeric' })
      const threadRes = await createThread({
        companyId: 'internal',
        subject: `Briefing matutino · ${dateStr}`,
        firstMessageBody: summary,
        role: 'system',
        authorName: 'AGUILA Routines',
        internalOnly: true,
      })
      if (threadRes.data) {
        payload.thread = { id: threadRes.data.id, posted: true }
      } else {
        payload.thread = { id: '', posted: false }
      }
    }

    return routineOk(payload)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return routineError('INTERNAL_ERROR', `morning-briefing failed: ${msg}`)
  }
}
