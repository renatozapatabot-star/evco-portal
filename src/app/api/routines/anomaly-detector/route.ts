/**
 * CRUZ · Routine R4 — Anomaly Detector
 *
 * Called weekly (Sunday evening Central). Scans the last 90 days of
 * partidas for:
 *   1. Price-per-unit deviations >30% vs 90d rolling avg per
 *      (fracción, proveedor) pair
 *   2. Duplicate pedimento numbers in traficos
 *
 * Returns structured anomalies. Routine composes a Spanish summary +
 * POSTs to an internal Mensajería thread. If >5 critical anomalies,
 * also opens a GitHub issue for Renato IV.
 */

import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyRoutineRequest, routineOk, routineError } from '@/lib/routines/auth'
import { createThread } from '@/lib/mensajeria/threads'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PriceAnomaly {
  fraccion: string
  proveedor: string
  companyId: string
  folio: string
  numeroItem: number | null
  currentPricePerUnit: number
  rollingAvgPerUnit: number
  deviationPct: number
  createdAt: string
}

interface DuplicatePedimento {
  pedimento: string
  patente: string | null
  aduana: string | null
  traficos: string[]
  companies: string[]
  count: number
}

interface AnomalyPayload {
  generatedAt: string
  windowDays: number
  priceAnomalies: PriceAnomaly[]
  duplicatePedimentos: DuplicatePedimento[]
  summary: { priceCount: number; duplicateCount: number; criticalCount: number }
  thread?: { id: string; posted: boolean }
}

export async function POST(request: NextRequest) {
  const auth = verifyRoutineRequest(request, 'anomaly-detector')
  if (!auth.ok) return auth.response

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()
  const ninetyDaysAgoIso = new Date(now.getTime() - 90 * 86_400_000).toISOString()
  const sevenDaysAgoIso = new Date(now.getTime() - 7 * 86_400_000).toISOString()

  const body = await request.json().catch(() => ({}))
  const postToThread: boolean = body?.postToThread !== false
  const summary: string | undefined = typeof body?.summary === 'string' ? body.summary : undefined
  const deviationThreshold: number = Number(body?.deviationThreshold ?? 30)

  try {
    // 1. Price anomalies — join partidas with productos to get fracción.
    //    We process in JS because the aggregation (per fracción × proveedor)
    //    needs historical window logic.
    const { data: partidasRaw, error: partErr } = await sb
      .from('globalpc_partidas')
      .select('id, folio, numero_item, cve_proveedor, cve_producto, precio_unitario, cantidad, company_id, created_at')
      .gte('created_at', ninetyDaysAgoIso)
      .not('precio_unitario', 'is', null)
      .not('cantidad', 'is', null)
      .limit(10000)
    if (partErr) {
      return routineError('INTERNAL_ERROR', `partidas query failed: ${partErr.message}`)
    }
    const partidas = (partidasRaw ?? []) as Array<{
      id: string; folio: string; numero_item: number | null
      cve_proveedor: string | null; cve_producto: string | null
      precio_unitario: number; cantidad: number
      company_id: string | null; created_at: string
    }>

    // Resolve producto → fracción
    const productoCves = Array.from(new Set(partidas.map(p => p.cve_producto).filter(Boolean))) as string[]
    const { data: productos } = await sb
      .from('globalpc_productos')
      .select('cve_producto, fraccion, company_id')
      .in('cve_producto', productoCves)
      .limit(10000)
    const productoToFraccion = new Map<string, string>()
    for (const p of (productos ?? []) as Array<{ cve_producto: string; fraccion: string | null; company_id: string | null }>) {
      if (p.fraccion) productoToFraccion.set(`${p.company_id}:${p.cve_producto}`, p.fraccion)
    }

    // Build per-(fraccion × proveedor) windows
    interface Sample { pricePerUnit: number; createdAt: string; partida: (typeof partidas)[number] }
    const buckets = new Map<string, Sample[]>()
    for (const p of partidas) {
      const fraccion = productoToFraccion.get(`${p.company_id}:${p.cve_producto}`)
      if (!fraccion || !p.cve_proveedor || p.cantidad <= 0) continue
      const key = `${fraccion}::${p.cve_proveedor}`
      const ppu = Number(p.precio_unitario) / Number(p.cantidad)
      if (!isFinite(ppu) || ppu <= 0) continue
      const arr = buckets.get(key) ?? []
      arr.push({ pricePerUnit: ppu, createdAt: p.created_at, partida: p })
      buckets.set(key, arr)
    }

    const priceAnomalies: PriceAnomaly[] = []
    for (const [key, samples] of buckets.entries()) {
      if (samples.length < 4) continue // not enough signal
      // Recent = samples from the last 7 days. Baseline = everything else.
      const recent = samples.filter(s => s.createdAt >= sevenDaysAgoIso)
      const baseline = samples.filter(s => s.createdAt < sevenDaysAgoIso)
      if (recent.length === 0 || baseline.length < 3) continue
      const avgBaseline = baseline.reduce((a, b) => a + b.pricePerUnit, 0) / baseline.length
      for (const r of recent) {
        const deviation = ((r.pricePerUnit - avgBaseline) / avgBaseline) * 100
        if (Math.abs(deviation) >= deviationThreshold) {
          const [fraccion, proveedor] = key.split('::')
          priceAnomalies.push({
            fraccion,
            proveedor,
            companyId: r.partida.company_id ?? '',
            folio: r.partida.folio,
            numeroItem: r.partida.numero_item,
            currentPricePerUnit: Number(r.pricePerUnit.toFixed(4)),
            rollingAvgPerUnit: Number(avgBaseline.toFixed(4)),
            deviationPct: Number(deviation.toFixed(1)),
            createdAt: r.createdAt,
          })
        }
      }
    }
    // Sort by absolute deviation desc, cap at top 25
    priceAnomalies.sort((a, b) => Math.abs(b.deviationPct) - Math.abs(a.deviationPct))
    const topAnomalies = priceAnomalies.slice(0, 25)

    // 2. Duplicate pedimentos — same pedimento serial on different tráficos
    //    UNDER THE SAME (patente, aduana). Pedimento numbers are unique per
    //    (DD AD PPPP, SSSSSSS) tuple, NOT per serial alone. Same 7-digit
    //    serial across different patentes is legal and not a duplicate.
    //    Also skip stub rows (patente NULL = orphaned trafico, never
    //    executed, can't legally be a duplicate of anything).
    const { data: pedRows } = await sb
      .from('traficos')
      .select('trafico, pedimento, company_id, aduana, patente')
      .not('pedimento', 'is', null)
      .neq('pedimento', '')
      .not('patente', 'is', null)
      .gte('updated_at', ninetyDaysAgoIso)
      .limit(10000)
    const dupMap = new Map<string, { pedimento: string; patente: string | null; aduana: string | null; traficos: Set<string>; companies: Set<string> }>()
    for (const r of (pedRows ?? []) as Array<{ trafico: string; pedimento: string; company_id: string | null; aduana: string | null; patente: string | null }>) {
      if (!r.pedimento || r.pedimento.trim() === '') continue
      const key = `${r.patente ?? '-'}::${r.aduana ?? '-'}::${r.pedimento}`
      const entry = dupMap.get(key) ?? { pedimento: r.pedimento, patente: r.patente, aduana: r.aduana, traficos: new Set(), companies: new Set() }
      entry.traficos.add(r.trafico)
      if (r.company_id) entry.companies.add(r.company_id)
      dupMap.set(key, entry)
    }
    const duplicatePedimentos: DuplicatePedimento[] = Array.from(dupMap.values())
      .filter(v => v.traficos.size > 1)
      .map(v => ({
        pedimento: v.pedimento,
        patente: v.patente,
        aduana: v.aduana,
        traficos: Array.from(v.traficos),
        companies: Array.from(v.companies),
        count: v.traficos.size,
      }))
      .sort((a, b) => b.count - a.count)

    const criticalCount = topAnomalies.filter(a => Math.abs(a.deviationPct) >= 50).length + duplicatePedimentos.length

    const payload: AnomalyPayload = {
      generatedAt: now.toISOString(),
      windowDays: 90,
      priceAnomalies: topAnomalies,
      duplicatePedimentos,
      summary: {
        priceCount: topAnomalies.length,
        duplicateCount: duplicatePedimentos.length,
        criticalCount,
      },
    }

    if (postToThread && summary) {
      const dateStr = now.toLocaleDateString('es-MX', { timeZone: 'America/Chicago', day: '2-digit', month: 'long', year: 'numeric' })
      const threadRes = await createThread({
        companyId: 'internal',
        subject: `Anomalías semanales · ${dateStr}${criticalCount > 0 ? ' · ⚠' : ''}`,
        firstMessageBody: summary,
        role: 'system',
        authorName: 'CRUZ Routines',
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
    return routineError('INTERNAL_ERROR', `anomaly-detector failed: ${msg}`)
  }
}
