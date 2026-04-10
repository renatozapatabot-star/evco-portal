import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import { PATENTE, ADUANA } from '@/lib/client-config'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { verifySession } from '@/lib/session'
import { Anexo24PDF } from './pdf-document'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_PDF_ROWS = 2000

interface PartidaRow {
  cve_trafico: string
  fraccion_arancelaria?: string | null
  fraccion?: string | null
  descripcion?: string | null
  cantidad?: number | null
  precio_unitario?: number | null
  [k: string]: unknown
}

interface TraficoRow {
  trafico: string
  pedimento?: string | null
  fecha_pago?: string | null
  fecha_llegada?: string | null
  proveedores?: string | null
  regimen?: string | null
  pais_procedencia?: string | null
  [k: string]: unknown
}

interface ProvRow {
  cve_proveedor?: string
  nombre?: string
}

function isT(regimen: string | null): boolean {
  const r = (regimen ?? '').toUpperCase()
  return r === 'ITE' || r === 'ITR' || r === 'IMD'
}

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const companyId = request.cookies.get('company_id')?.value ?? ''
  const clientClave = request.cookies.get('company_clave')?.value ?? ''
  const rawName = request.cookies.get('company_name')?.value
  const clientName = rawName ? decodeURIComponent(rawName) : ''

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('from') || PORTAL_DATE_FROM
  const dateTo = searchParams.get('to') || null

  try {
    // Fetch data in parallel
    const [partidaRes, traficoRes, provRes] = await Promise.all([
      supabase
        .from('globalpc_partidas')
        .select('*')
        .eq('company_id', companyId)
        .limit(10000),
      supabase
        .from('traficos')
        .select('trafico, pedimento, fecha_pago, fecha_llegada, proveedores, regimen, pais_procedencia')
        .eq('company_id', companyId)
        .gte('fecha_llegada', dateFrom)
        .limit(5000),
      supabase
        .from('globalpc_proveedores')
        .select('cve_proveedor, nombre')
        .eq('company_id', companyId)
        .limit(5000),
    ])

    const partidas: PartidaRow[] = Array.isArray(partidaRes.data) ? partidaRes.data : []
    const traficos: TraficoRow[] = Array.isArray(traficoRes.data) ? traficoRes.data : []
    const proveedores: ProvRow[] = Array.isArray(provRes.data) ? provRes.data : []

    // Build lookup maps
    const traficoMap = new Map<string, TraficoRow>()
    traficos.forEach(t => { if (t.trafico) traficoMap.set(t.trafico, t) })

    const supplierMap = new Map<string, string>()
    proveedores.forEach(p => { if (p.cve_proveedor && p.nombre) supplierMap.set(p.cve_proveedor, p.nombre) })

    const resolveProvs = (raw: string | null): string => {
      if (!raw) return '—'
      return raw.split(',').map(s => s.trim()).filter(Boolean)
        .map(code => supplierMap.get(code) || code).join(', ')
    }

    // Enrich partidas
    const sorted = [...partidas].sort((a, b) => (a.cve_trafico || '').localeCompare(b.cve_trafico || ''))
    const enriched: Array<{
      rowNum: number; pedimento: string; fecha: string; fraccion: string
      descripcion: string; cantidad: number; valorUSD: number
      proveedor: string; origen: string; tmec: boolean
    }> = []

    let num = 0
    for (const p of sorted) {
      const ctx = traficoMap.get(p.cve_trafico)
      const fecha = ctx?.fecha_pago || ctx?.fecha_llegada || null

      // Apply date filter
      if (dateTo && fecha && fecha > dateTo) continue
      if (dateFrom && fecha && fecha < dateFrom) continue

      num++
      enriched.push({
        rowNum: num,
        pedimento: ctx?.pedimento || 'Pendiente',
        fecha: fecha || '',
        fraccion: p.fraccion_arancelaria || p.fraccion || '—',
        descripcion: p.descripcion || '—',
        cantidad: Number(p.cantidad) || 0,
        valorUSD: Number(p.precio_unitario) || 0,
        proveedor: resolveProvs(ctx?.proveedores || null),
        origen: ctx?.pais_procedencia || '—',
        tmec: isT(ctx?.regimen || null),
      })
    }

    // KPIs
    const totalPartidas = enriched.length
    const totalValueUSD = enriched.reduce((s, r) => s + r.valorUSD, 0)
    const uniqueFracciones = new Set(enriched.map(r => r.fraccion).filter(f => f !== '—')).size
    const tmecCount = enriched.filter(r => r.tmec).length
    const tmecPct = totalPartidas > 0 ? Math.round((tmecCount / totalPartidas) * 100) : 0
    const uniqueSuppliers = new Set(enriched.map(r => r.proveedor).filter(p => p !== '—')).size

    // Truncate for PDF performance
    const truncated = enriched.length > MAX_PDF_ROWS
    const pdfPartidas = truncated ? enriched.slice(0, MAX_PDF_ROWS) : enriched

    const now = new Date()
    const dateStr = now.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Chicago',
    })

    const dateRange = (searchParams.get('from') || searchParams.get('to'))
      ? { from: dateFrom, to: dateTo || dateStr }
      : null

    const pdfBuffer = await renderToBuffer(
      Anexo24PDF({
        clientName,
        patente: PATENTE,
        aduana: ADUANA,
        date: dateStr,
        dateRange,
        totalRows: enriched.length,
        truncated,
        kpis: { totalPartidas, totalValueUSD, uniqueFracciones, tmecPct, uniqueSuppliers },
        partidas: pdfPartidas,
      })
    )

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="ADUANA-Anexo24-${clientClave}-${now.toISOString().split('T')[0]}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error generando PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
