/**
 * CRUZ · V1.5 F17 — Pedimento PDF live preview.
 *
 * GET /api/pedimento/[id]/preview
 *   → application/pdf bytes of the current pedimento snapshot.
 *
 * NO side effects. No DB writes. No workflow events. No decision log.
 * Used by the editor's right-rail live preview; debounced to ~2s by caller.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { renderPedimentoPdf } from '@/lib/pedimento/render-pdf'
import type {
  PedimentoRow,
  DestinatarioRow,
  CompensacionRow,
  PagoVirtualRow,
  GuiaRow,
  TransportistaRow,
  CandadoRow,
  DescargaRow,
  CuentaGarantiaRow,
  ContribucionRow,
  PedimentoFacturaRow,
  FullPedimento,
  PedimentoPartidaLite,
} from '@/lib/pedimento-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Partida enrichment now routes via partidasByTrafico (M16 phantom sweep).

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  const { id: pedimentoId } = await params

  const { data: pedRow, error: pedErr } = await supabase
    .from('pedimentos')
    .select('*')
    .eq('id', pedimentoId)
    .maybeSingle<PedimentoRow>()
  if (pedErr || !pedRow) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Pedimento no encontrado' } },
      { status: 404 },
    )
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  if (!isInternal && pedRow.company_id !== session.companyId) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Sin acceso al pedimento' } },
      { status: 403 },
    )
  }

  const { partidasByTrafico } = await import('@/lib/queries/partidas-by-trafico')

  const [
    destinatarios, compensaciones, pagos, guias, transportistas,
    candados, descargas, cuentas, contribuciones, facturas, partidasEnriched,
  ] = await Promise.all([
    supabase.from('pedimento_destinatarios').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_compensaciones').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_pagos_virtuales').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_guias').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_transportistas').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_candados').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_descargas').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_cuentas_garantia').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_contribuciones').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_facturas').select('*').eq('pedimento_id', pedimentoId),
    partidasByTrafico(supabase, pedRow.company_id, pedRow.trafico_id, { limit: 2000 }),
  ])

  const partidas: PedimentoPartidaLite[] = partidasEnriched.map(p => ({
    fraccion: p.fraccion,
    cantidad: p.cantidad,
    pais_origen: p.pais_origen,
    valor_comercial: p.valor_comercial,
  }))

  const full: FullPedimento = {
    parent: pedRow,
    destinatarios: (destinatarios.data as DestinatarioRow[] | null) ?? [],
    compensaciones: (compensaciones.data as CompensacionRow[] | null) ?? [],
    pagos_virtuales: (pagos.data as PagoVirtualRow[] | null) ?? [],
    guias: (guias.data as GuiaRow[] | null) ?? [],
    transportistas: (transportistas.data as TransportistaRow[] | null) ?? [],
    candados: (candados.data as CandadoRow[] | null) ?? [],
    descargas: (descargas.data as DescargaRow[] | null) ?? [],
    cuentas_garantia: (cuentas.data as CuentaGarantiaRow[] | null) ?? [],
    contribuciones: (contribuciones.data as ContribucionRow[] | null) ?? [],
    facturas: (facturas.data as PedimentoFacturaRow[] | null) ?? [],
    partidas,
  }

  try {
    const bytes = await renderPedimentoPdf(full)
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'no-store, max-age=0',
        'Content-Disposition': 'inline; filename="pedimento-preview.pdf"',
      },
    })
  } catch (err) {
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: err instanceof Error ? err.message : 'Fallo al generar vista previa',
        },
      },
      { status: 500 },
    )
  }
}
