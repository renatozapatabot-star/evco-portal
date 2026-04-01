import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import { PATENTE, ADUANA } from '@/lib/client-config'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { ReportesPDF } from './pdf-document'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'

interface SupplierRow {
  name: string
  shipments: number
  compliancePct: number
  avgCrossDays: number | null
  tmecPct: number
}

export async function GET(request: NextRequest) {
  const companyId = request.cookies.get('company_id')?.value ?? 'evco'
  const clientClave = request.cookies.get('company_clave')?.value ?? '9254'
  const rawName = request.cookies.get('company_name')?.value
  const clientName = rawName ? decodeURIComponent(rawName) : 'EVCO Plastics de México'

  try {
    const prefix = `${clientClave}-%`

    const [totals, cruzados, crossing, factRes, traficosWithSuppliers] = await Promise.all([
      supabase
        .from('traficos')
        .select('importe_total', { count: 'exact' })
        .ilike('trafico', prefix)
        .gte('fecha_llegada', PORTAL_DATE_FROM),
      supabase
        .from('traficos')
        .select('*', { count: 'exact', head: true })
        .ilike('trafico', prefix)
        .eq('estatus', 'Cruzado')
        .gte('fecha_llegada', PORTAL_DATE_FROM),
      supabase
        .from('traficos')
        .select('fecha_cruce, fecha_llegada')
        .ilike('trafico', prefix)
        .not('fecha_cruce', 'is', null)
        .not('fecha_llegada', 'is', null)
        .gte('fecha_llegada', PORTAL_DATE_FROM)
        .limit(500),
      supabase
        .from('aduanet_facturas')
        .select('igi, valor_usd', { count: 'exact' })
        .eq('clave_cliente', clientClave),
      supabase
        .from('traficos')
        .select('proveedores, estatus, fecha_llegada, fecha_cruce, regimen')
        .eq('company_id', companyId)
        .not('proveedores', 'is', null)
        .gte('fecha_llegada', PORTAL_DATE_FROM),
    ])

    // KPIs
    const totalCount = totals.count ?? 0
    const cruzadosCount = cruzados.count ?? 0
    const successRate = totalCount > 0
      ? Math.round((cruzadosCount / totalCount) * 100)
      : 0

    const totalValue = (totals.data ?? []).reduce(
      (s: number, t: Record<string, unknown>) => s + (Number(t.importe_total) || 0), 0
    )

    const crossingRows = crossing.data ?? []
    const avgCrossingDays = crossingRows.length > 0
      ? (crossingRows.reduce((sum: number, t: Record<string, unknown>) => {
          const days = (new Date(t.fecha_cruce as string).getTime() -
                       new Date(t.fecha_llegada as string).getTime()) / 86400000
          return sum + days
        }, 0) / crossingRows.length).toFixed(1)
      : null

    const tmecWithIGI = (factRes.data ?? []).filter(
      (f: Record<string, unknown>) => f.igi !== null && Number(f.igi) > 0
    ).length
    const tmecRate = factRes.count
      ? Math.round((tmecWithIGI / factRes.count) * 100)
      : 0

    // Supplier intelligence
    const supplierMap = new Map<string, { total: number; cruzado: number; crossDays: number[]; tmec: number }>()
    ;(traficosWithSuppliers.data ?? []).forEach((t: Record<string, unknown>) => {
      const provStr = t.proveedores as string | null
      if (!provStr) return
      const suppliers = provStr.split(',').map((s: string) => s.trim()).filter(Boolean)
      suppliers.forEach((name: string) => {
        const prev = supplierMap.get(name) || { total: 0, cruzado: 0, crossDays: [], tmec: 0 }
        prev.total++
        if (t.estatus === 'Cruzado') prev.cruzado++
        const reg = t.regimen as string | null
        if (reg === 'ITE' || reg === 'ITR') prev.tmec++
        const llegada = t.fecha_llegada as string | null
        const cruce = t.fecha_cruce as string | null
        if (llegada && cruce) {
          const days = (new Date(cruce).getTime() - new Date(llegada).getTime()) / 86400000
          if (days >= 0) prev.crossDays.push(days)
        }
        supplierMap.set(name, prev)
      })
    })

    const top5Suppliers: SupplierRow[] = [...supplierMap.entries()]
      .map(([name, s]) => ({
        name,
        shipments: s.total,
        compliancePct: s.total > 0 ? Math.round((s.cruzado / s.total) * 100) : 0,
        avgCrossDays: s.crossDays.length > 0
          ? Math.round((s.crossDays.reduce((a, b) => a + b, 0) / s.crossDays.length) * 10) / 10
          : null,
        tmecPct: s.total > 0 ? Math.round((s.tmec / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.shipments - a.shipments)
      .slice(0, 5)

    // Executive sentence — fetch from internal endpoint
    let executiveSentence = `${clientName}: ${totalCount.toLocaleString()} tráficos procesados · $${(totalValue / 1e6).toFixed(1)}M USD importados · ${successRate}% tasa de éxito.`
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'
      const summaryRes = await fetch(`${baseUrl}/api/executive-summary`, {
        signal: AbortSignal.timeout(10000),
      })
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json()
        if (summaryData.sentence) executiveSentence = summaryData.sentence
      }
    } catch {
      // Use template fallback
    }

    const now = new Date()
    const dateStr = now.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Chicago',
    })

    const pdfBuffer = await renderToBuffer(
      ReportesPDF({
        clientName: clientName,
        patente: PATENTE,
        aduana: ADUANA,
        date: dateStr,
        executiveSentence,
        kpis: {
          totalTraficos: totalCount,
          totalValueUSD: totalValue,
          successRate,
          avgCrossingDays,
          tmecRate,
        },
        suppliers: top5Suppliers,
      })
    )

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="CRUZ-Reporte-${companyId}-${now.toISOString().split('T')[0]}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error generating PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
