/**
 * ZAPATA AI · Routine R5 — Weekly Client Reports
 *
 * Called Monday 6:00 AM Central. Iterates every active client, generates
 * a weekly summary per tenant, POSTs each summary to that client's
 * Mensajería thread (internal_only=false so the client sees it).
 *
 * Two-step flow:
 *   1. GET /api/routines/weekly-client-reports → list of active clients + state
 *   2. For each, routine composes message, POSTs with { companyId, summary }
 *
 * Replaces the manual multi-cliente reports spec.
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyRoutineRequest, routineOk, routineError } from '@/lib/routines/auth'
import { createThread } from '@/lib/mensajeria/threads'
import { computeARAging } from '@/lib/contabilidad/aging'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ClientSnapshot {
  companyId: string
  name: string
  claveCliente: string | null
  active: boolean
  weeklyStats: {
    traficosProcessed: number
    pedimentosListos: number
    crucesCompleted: number
    pendingDocs: number
    tmecEligibleCount: number
  }
  cxc: {
    totalUSD: number
    vencidoUSD: number
    count: number
  }
}

interface ListResponse {
  generatedAt: string
  windowDays: number
  clients: ClientSnapshot[]
}

interface PostRequest {
  companyId: string
  summary: string
}

export async function POST(request: NextRequest) {
  const auth = verifyRoutineRequest(request, 'weekly-client-reports')
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({})) as Partial<PostRequest & { mode: 'list' | 'post' }>
  const mode: 'list' | 'post' = body?.mode === 'post' ? 'post' : 'list'

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()
  const sevenDaysAgoIso = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const ninetyDaysAgoIso = new Date(now.getTime() - 90 * 86_400_000).toISOString()

  try {
    if (mode === 'post') {
      // Step 2: post a composed summary to a specific client's thread.
      if (!body?.companyId || !body?.summary) {
        return routineError('VALIDATION_ERROR', 'companyId and summary required in post mode', 400)
      }
      const dateStr = now.toLocaleDateString('es-MX', { timeZone: 'America/Chicago', day: '2-digit', month: 'long', year: 'numeric' })
      const threadRes = await createThread({
        companyId: body.companyId,
        subject: `Reporte semanal · ${dateStr}`,
        firstMessageBody: body.summary,
        role: 'system',
        authorName: 'Renato Zapata & Company',
        internalOnly: false, // client-visible
      })
      if (!threadRes.data) {
        return routineError('INTERNAL_ERROR', `thread create failed: ${threadRes.error?.message ?? 'unknown'}`)
      }
      return routineOk({ companyId: body.companyId, thread: { id: threadRes.data.id, posted: true } })
    }

    // Step 1: list active clients + their week stats.
    const { data: companiesRows, error: coErr } = await sb
      .from('companies')
      .select('company_id, name, clave_cliente, active')
      .eq('active', true)
      .limit(200)
    if (coErr) {
      return routineError('INTERNAL_ERROR', `companies query failed: ${coErr.message}`)
    }
    const companies = (companiesRows ?? []) as Array<{
      company_id: string; name: string | null; clave_cliente: string | null; active: boolean
    }>

    const snapshots: ClientSnapshot[] = []
    for (const c of companies) {
      const [
        traficosRes,
        pedimentosRes,
        crucesRes,
        pendingDocsRes,
        tmecRes,
        arResult,
      ] = await Promise.all([
        sb.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', c.company_id).gte('created_at', sevenDaysAgoIso).limit(1),
        // Pedimentos listos = paid pedimento, awaiting cruce, recent arrival
        // (90d). Recency excludes historical ghosts where sync never
        // backfilled fecha_cruce. Cruces last 7d = real fecha_cruce.
        sb.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', c.company_id).eq('estatus', 'Pedimento Pagado').is('fecha_cruce', null).gte('fecha_llegada', ninetyDaysAgoIso).limit(1),
        sb.from('traficos').select('id', { count: 'exact', head: true }).eq('company_id', c.company_id).gte('fecha_cruce', sevenDaysAgoIso).limit(1),
        sb.from('expediente_documentos').select('id', { count: 'exact', head: true }).eq('company_id', c.company_id).eq('is_required', true).is('storage_path', null).limit(1),
        sb.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', c.company_id).eq('pais_origen', 'USA').limit(1),
        computeARAging(sb, c.company_id),
      ])

      const cxcVencido = arResult.byBucket.filter(b => b.bucket !== '0-30').reduce((a, b) => a + b.amount, 0)
      const cxcCount = arResult.byBucket.filter(b => b.bucket !== '0-30').reduce((a, b) => a + b.count, 0)

      snapshots.push({
        companyId: c.company_id,
        name: c.name ?? c.company_id,
        claveCliente: c.clave_cliente,
        active: c.active,
        weeklyStats: {
          traficosProcessed: traficosRes.count ?? 0,
          pedimentosListos: pedimentosRes.count ?? 0,
          crucesCompleted: crucesRes.count ?? 0,
          pendingDocs: pendingDocsRes.count ?? 0,
          tmecEligibleCount: tmecRes.count ?? 0,
        },
        cxc: {
          totalUSD: Math.round(arResult.total),
          vencidoUSD: Math.round(cxcVencido),
          count: cxcCount,
        },
      })
    }

    // Filter out clients with no activity (avoid spamming inactive tenants)
    const active = snapshots.filter(s => s.weeklyStats.traficosProcessed > 0 || s.weeklyStats.crucesCompleted > 0 || s.cxc.count > 0)

    const payload: ListResponse = {
      generatedAt: now.toISOString(),
      windowDays: 7,
      clients: active,
    }

    return routineOk(payload)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return routineError('INTERNAL_ERROR', `weekly-client-reports failed: ${msg}`)
  }
}
