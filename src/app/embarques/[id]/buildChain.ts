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
  /** V1 — trafico.estatus used as fallback so "Pedimento Pagado" header
   *  + "Sin pedimento" chain contradiction can't happen. If the trafico
   *  status indicates pedimento exists, node shows linked even without
   *  a pedimentos-table row. */
  traficoEstatus?: string | null
  /** V1 — bare pedimento string from traficos.pedimento used when the
   *  pedimentos table row is absent but the number is already in traficos. */
  traficoPedimentoNumber?: string | null
}

const TRAFICO_ESTATUS_IMPLIES_PEDIMENTO = [
  'pedimento pagado', 'pagado', 'cruzado', 'liberado', 'entregado', 'firmado',
]

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
    traficoEstatus, traficoPedimentoNumber,
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
    (() => {
      // V1 · chain-truth: if the pedimentos row is absent BUT the
      // trafico.estatus says the pedimento exists (Pagado/Cruzado/etc)
      // OR traficos.pedimento carries a number, treat the node as linked
      // so the chain never contradicts the header.
      const normalizedEstatus = (traficoEstatus ?? '').trim().toLowerCase()
      const estatusImpliesPedimento = TRAFICO_ESTATUS_IMPLIES_PEDIMENTO
        .some((s) => normalizedEstatus.includes(s))
      const hasPedimentoRow = pedimento != null
      const hasPedimentoNumber = Boolean(
        pedimento?.pedimento_number ?? traficoPedimentoNumber,
      )
      const derivedStatus = hasPedimentoRow
        ? pedimentoStatus(pedimento?.status ?? null)
        : (hasPedimentoNumber || estatusImpliesPedimento ? 'linked' : 'missing')
      const derivedValue =
        pedimento?.pedimento_number
        ?? traficoPedimentoNumber
        ?? (estatusImpliesPedimento ? (traficoEstatus ?? 'Pagado') : 'Sin pedimento')
      return {
        kind: 'pedimento' as const,
        label: 'Pedimento',
        value: derivedValue,
        date: pedimento?.updated_at ?? null,
        href: hasPedimentoRow ? `/embarques/${encodeURIComponent(traficoId)}/pedimento` : null,
        status: derivedStatus,
      }
    })(),
    {
      kind: 'trafico',
      label: 'Embarque',
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
