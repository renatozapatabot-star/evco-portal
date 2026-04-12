import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { createPedimento } from '@/app/actions/pedimento'
import { PedimentoLayout } from './PedimentoLayout'
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
} from '@/lib/pedimento-types'

interface TraficoLite {
  trafico: string
  company_id: string | null
  pedimento: string | null
  estatus: string | null
}

export default async function PedimentoEditorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = await params
  const traficoId = decodeURIComponent(rawId)

  const cookieStore = await cookies()
  const session = await verifySession(cookieStore.get('portal_session')?.value ?? '')
  if (!session) redirect('/login')

  const supabase = createServerClient()
  const isInternal = session.role === 'broker' || session.role === 'admin'

  let traficoQ = supabase
    .from('traficos')
    .select('trafico, company_id, pedimento, estatus')
    .eq('trafico', traficoId)
  if (!isInternal) traficoQ = traficoQ.eq('company_id', session.companyId)
  const { data: trafico } = await traficoQ.maybeSingle<TraficoLite>()

  if (!trafico) notFound()
  if (!trafico.company_id) redirect('/traficos')

  // Ensure pedimento row exists
  let pedimento: PedimentoRow | null = null
  const { data: existing } = await supabase
    .from('pedimentos')
    .select('*')
    .eq('trafico_id', traficoId)
    .eq('company_id', trafico.company_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<PedimentoRow>()

  if (existing) {
    pedimento = existing
  } else {
    const { data, error } = await createPedimento(traficoId)
    if (error || !data) redirect(`/traficos/${encodeURIComponent(traficoId)}`)
    const { data: created } = await supabase
      .from('pedimentos')
      .select('*')
      .eq('id', data.id)
      .maybeSingle<PedimentoRow>()
    pedimento = created
  }
  if (!pedimento) notFound()

  const pedimentoId = pedimento.id

  const [
    destinatarios, compensaciones, pagos, guias, transportistas,
    candados, descargas, cuentas, contribuciones, facturas,
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
  ])

  return (
    <PedimentoLayout
      trafico={{
        trafico: trafico.trafico,
        estatus: trafico.estatus,
        pedimento: trafico.pedimento,
      }}
      pedimento={pedimento}
      children_data={{
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
      }}
    />
  )
}
