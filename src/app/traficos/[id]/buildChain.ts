import type { ChainNode, ChainNodeStatus } from '@/components/aguila/ChainView'

export interface FacturaRow {
  folio: number | null
  fecha_pago: string | null
}

export interface EntradaRow {
  id: number | null
  fecha_ingreso: string | null
  fecha_llegada_mercancia: string | null
}

export interface PedimentoRow {
  id: string | null
  pedimento_number: string | null
  status: string | null
  updated_at: string | null
}

export interface TraficoChainInput {
  traficoId: string
  fechaCruce: string | null
  facturas: FacturaRow[]
  entradas: EntradaRow[]
  pedimento: PedimentoRow | null
  docCount: number
  requiredDocsCount: number
  uploadedRequiredCount: number
}

function pedimentoStatus(status: string | null): ChainNodeStatus {
  if (!status) return 'missing'
  if (status === 'cancelado') return 'error'
  if (['firmado', 'pagado', 'cruzado'].includes(status)) return 'linked'
  return 'pending'
}

function expedienteStatus(pct: number, docCount: number): ChainNodeStatus {
  if (docCount === 0) return 'missing'
  if (pct >= 80) return 'linked'
  if (pct >= 40) return 'pending'
  return 'error'
}

export function buildChain(input: TraficoChainInput): ChainNode[] {
  const {
    traficoId, fechaCruce, facturas, entradas, pedimento,
    docCount, requiredDocsCount, uploadedRequiredCount,
  } = input

  const paidFactura = facturas.find(f => f.fecha_pago)
  const facturaStatus: ChainNodeStatus =
    facturas.length === 0 ? 'missing' : paidFactura ? 'linked' : 'pending'
  const facturaDate = paidFactura?.fecha_pago ?? null
  const facturaLabel = facturas.length > 0
    ? `${facturas.length} ${facturas.length === 1 ? 'factura' : 'facturas'}`
    : 'Sin vincular'

  const latestEntrada = entradas[0] ?? null
  const entradaStatus: ChainNodeStatus =
    entradas.length === 0
      ? 'missing'
      : latestEntrada?.fecha_ingreso ? 'linked' : 'pending'
  const entradaDate =
    latestEntrada?.fecha_ingreso ?? latestEntrada?.fecha_llegada_mercancia ?? null
  const entradaLabel = entradas.length > 0
    ? `${entradas.length} ${entradas.length === 1 ? 'entrada' : 'entradas'}`
    : 'Sin vincular'

  const traficoStatus: ChainNodeStatus = fechaCruce ? 'linked' : 'pending'

  const expedientePct = requiredDocsCount > 0
    ? Math.round((uploadedRequiredCount / requiredDocsCount) * 100)
    : 0
  const expedienteLabel = docCount > 0
    ? `${docCount} docs · ${expedientePct}%`
    : 'Sin documentos'

  return [
    {
      kind: 'factura',
      label: 'Factura',
      value: facturaLabel,
      date: facturaDate,
      href: facturas.length > 0 ? `/facturas?trafico=${encodeURIComponent(traficoId)}` : null,
      status: facturaStatus,
    },
    {
      kind: 'entrada',
      label: 'Entrada',
      value: entradaLabel,
      date: entradaDate,
      href: latestEntrada?.id != null ? `/entradas/${latestEntrada.id}` : null,
      status: entradaStatus,
    },
    {
      kind: 'pedimento',
      label: 'Pedimento',
      value: pedimento?.pedimento_number ?? 'Sin pedimento',
      date: pedimento?.updated_at ?? null,
      href: pedimento ? `/traficos/${encodeURIComponent(traficoId)}/pedimento` : null,
      status: pedimentoStatus(pedimento?.status ?? null),
    },
    {
      kind: 'trafico',
      label: 'Tráfico',
      value: traficoId,
      date: fechaCruce,
      href: null,
      status: traficoStatus,
    },
    {
      kind: 'expediente',
      label: 'Expediente',
      value: expedienteLabel,
      date: null,
      href: null,
      status: expedienteStatus(expedientePct, docCount),
    },
  ]
}
