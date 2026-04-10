import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import { PATENTE, ADUANA } from '@/lib/client-config'
import { verifySession } from '@/lib/session'
import { PedimentoPDF } from './pdf-document'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(sessionToken)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = request.cookies.get('company_id')?.value ?? ''
  const clientClave = request.cookies.get('company_clave')?.value ?? ''
  const clientName = decodeURIComponent(request.cookies.get('company_name')?.value ?? 'Cliente')

  const traficoId = request.nextUrl.searchParams.get('trafico')
  if (!traficoId) return NextResponse.json({ error: 'Missing trafico param' }, { status: 400 })

  // Fetch tráfico
  const { data: trafico } = await supabase
    .from('traficos')
    .select('*')
    .eq('trafico', traficoId)
    .eq('company_id', companyId)
    .single()

  if (!trafico) return NextResponse.json({ error: 'Tráfico no encontrado' }, { status: 404 })

  // Fetch facturas for this tráfico
  const { data: facturas } = await supabase
    .from('aduanet_facturas')
    .select('*')
    .eq('referencia', traficoId)
    .eq('clave_cliente', clientClave)
    .limit(100)

  // Fetch partidas
  const { data: partidas } = await supabase
    .from('globalpc_partidas')
    .select('fraccion_arancelaria, fraccion, descripcion, cantidad, precio_unitario')
    .eq('cve_trafico', traficoId)
    .limit(500)

  // Aggregate factura values
  const facArr = facturas ?? []
  const valorUSD = facArr.reduce((s: number, f: Record<string, unknown>) => s + (Number(f.valor_usd) || 0), 0)
  const dta = facArr.reduce((s: number, f: Record<string, unknown>) => s + (Number(f.dta) || 0), 0)
  const igi = facArr.reduce((s: number, f: Record<string, unknown>) => s + (Number(f.igi) || 0), 0)
  const iva = facArr.reduce((s: number, f: Record<string, unknown>) => s + (Number(f.iva) || 0), 0)
  const tipoCambio = facArr.length > 0 ? Number((facArr[0] as Record<string, unknown>).tipo_cambio) || 17.5 : 17.5
  const proveedor = facArr.length > 0 ? String((facArr[0] as Record<string, unknown>).proveedor || '') : ''

  const partidasForPDF = (partidas ?? []).map((p: Record<string, unknown>) => ({
    fraccion: String(p.fraccion_arancelaria || p.fraccion || ''),
    descripcion: String(p.descripcion || ''),
    cantidad: Number(p.cantidad) || 0,
    valorUSD: Number(p.precio_unitario) || 0,
  }))

  const today = new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Chicago',
  })

  const buffer = await renderToBuffer(
    PedimentoPDF({
      clientName,
      patente: PATENTE,
      aduana: ADUANA,
      date: today,
      pedimento: trafico.pedimento || 'Sin asignar',
      trafico: traficoId,
      fechaPago: trafico.fecha_pago,
      fechaLlegada: trafico.fecha_llegada,
      regimen: trafico.regimen,
      proveedor,
      descripcion: trafico.descripcion_mercancia || '',
      valorUSD,
      dta,
      igi,
      iva,
      tipoCambio,
      partidas: partidasForPDF,
    })
  )

  const filename = `Pedimento-${(trafico.pedimento || traficoId).replace(/\s/g, '_')}-${clientClave}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
